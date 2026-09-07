from datetime import date as date_cls, datetime, timedelta
import logging
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import OwnerAccess, require_owner, verify_api_key
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from firebase_admin import firestore

from firebase_config import db
from staff_eligibility import normalize_service_id, resolve_staff_canonical_service_ids, staff_service_ids
from stylist_schedule import (
    DEFAULT_BUFFER_MINUTES,
    format_time_range,
    get_available_slots_for_day,
    is_slot_available,
    parse_booking_datetime,
    parse_time_value,
    validate_appointment_datetime,
)

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "No-show"]
CONFLICT_STATUSES = {"Cancelled", "Rejected"}
OWNER_STATUS_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled", "Rescheduled"},
    "Confirmed": {"Completed", "Cancelled", "Rescheduled"},
    "Rescheduled": {"Confirmed", "Cancelled", "Rescheduled"},
    "Completed": set(),
    "Cancelled": set(),
    "No-show": set(),
}


class BookingUnavailableError(ValueError):
    def __init__(self, reason: str, conflict_range: str | None = None):
        self.reason = reason
        self.conflict_range = conflict_range
        details = f"Stylist is unavailable due to {reason}"
        if conflict_range:
            details = f"{details} ({conflict_range})"
        super().__init__(details)


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    salon_id: str = Field(..., min_length=1)
    customer_name: str = Field(..., min_length=1)
    customer_email: str = Field(..., min_length=1)
    customer_phone: str | None = Field(default=None, min_length=1)
    notes: str | None = Field(default=None, min_length=1)
    service_id: str = Field(..., min_length=1)
    service_name: str = Field(..., min_length=1)
    stylist_id: str = Field(..., min_length=1)
    stylist_name: str = Field(..., min_length=1)
    appointment_date: str = Field(..., min_length=1)
    appointment_time: str = Field(..., min_length=1)
    duration_minutes: int = Field(..., gt=0)
    amount: int = Field(..., ge=0)

    @field_validator(
        "salon_id",
        "customer_name",
        "customer_email",
        "service_id",
        "service_name",
        "stylist_id",
        "stylist_name",
        "appointment_date",
        "appointment_time",
        mode="before",
    )
    @classmethod
    def strip_and_validate_required(cls, value):
        if value is None:
            raise ValueError("This field is required.")
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("customer_email")
    @classmethod
    def validate_email(cls, value: str):
        if "@" not in value:
            raise ValueError("customer_email must be a valid email address.")
        return value

    @field_validator("appointment_date")
    @classmethod
    def validate_date_format(cls, value: str):
        try:
            date_cls.fromisoformat(value)
        except ValueError as exc:  # pragma: no cover - defensive validation
            raise ValueError("appointment_date must be in YYYY-MM-DD format.") from exc
        return value

    @field_validator("appointment_time")
    @classmethod
    def validate_time_format(cls, value: str):
        try:
            parse_time_value(value)
        except ValueError as exc:  # pragma: no cover - defensive validation
            raise ValueError("appointment_time must be a valid time like 10:30 AM.") from exc
        return value

    @model_validator(mode="after")
    def validate_future_slot(self):
        try:
            validate_appointment_datetime(self.appointment_date, self.appointment_time)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        return self


class BookingStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["Pending", "Confirmed", "Completed", "Cancelled", "No-show"]
    cancellation_reason: str | None = Field(default=None, max_length=500)

    @field_validator("cancellation_reason", mode="before")
    @classmethod
    def strip_cancellation_reason(cls, value):
        if value is None:
            return value
        if not isinstance(value, str):
            raise ValueError("cancellation_reason must be a string.")
        return value.strip()


class BookingCancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cancellation_reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("cancellation_reason", mode="before")
    @classmethod
    def strip_reason(cls, value):
        if not isinstance(value, str):
            raise ValueError("cancellation_reason must be a string.")
        return value.strip()


class BookingRescheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    staff_id: str = Field(..., min_length=1)
    appointment_date: str = Field(..., min_length=1)
    appointment_time: str = Field(..., min_length=1)
    reschedule_reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("staff_id", "appointment_date", "appointment_time", "reschedule_reason", mode="before")
    @classmethod
    def strip_reschedule_fields(cls, value):
        if not isinstance(value, str):
            raise ValueError("This field must be a string.")
        return value.strip()

    @field_validator("appointment_date")
    @classmethod
    def validate_reschedule_date(cls, value: str):
        try:
            date_cls.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("appointment_date must be in YYYY-MM-DD format.") from exc
        return value
    @field_validator("appointment_time")
    @classmethod
    def validate_reschedule_time(cls, value: str):
        try:
            parse_time_value(value)
        except ValueError as exc:
            raise ValueError("appointment_time must be a valid time like 10:30 AM.") from exc
        return value


class BookingServiceMappingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service_id: str = Field(..., min_length=1)


class BookingResponse(BaseModel):
    id: str
    salon_id: str
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    notes: str | None = None
    service_id: str | None = None
    service_name: str
    stylist_id: str
    stylist_name: str
    appointment_date: str
    appointment_time: str
    duration_minutes: int
    amount: int
    status: str
    created_at: str | None = None
    updated_at: str | None = None
    updated_by: str | None = None
    cancelled_at: str | None = None
    cancelled_by: str | None = None
    cancellation_reason: str | None = None
    previous_start_at: str | None = None
    previous_end_at: str | None = None
    rescheduled_at: str | None = None
    rescheduled_by: str | None = None
    reschedule_reason: str | None = None
    version: int = 1
    needs_service_mapping: bool = False
    service_mapping_error: str | None = None


def _serialize_firestore_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date_cls):
        return value.isoformat()
    return value


def _to_frontend_booking(doc_id: str, payload: dict):
    frontend_payload = {"id": doc_id}
    for key, value in payload.items():
        frontend_payload[key] = _serialize_firestore_value(value)
    return BookingResponse(**frontend_payload)


def _resolve_booking_service_id(booking_data: dict, salon_id: str) -> str:
    service_id = booking_data.get("service_id")
    if isinstance(service_id, str) and service_id.strip():
        try:
            service_snapshot = db.collection("services").document(service_id.strip()).get()
        except (KeyError, AttributeError):
            service_snapshot = None
        service_data = service_snapshot.to_dict() if service_snapshot else {}
        if service_snapshot and service_snapshot.exists:
            if service_data.get("salon_id") != salon_id:
                raise HTTPException(status_code=422, detail="Booking service is invalid for this salon.")
            _log_eligibility("canonical_service_resolution", service_id_present=True, service_id_source="booking", resolved=True, resolved_service_name=service_data.get("name"))
            return service_id.strip()
        _log_eligibility("stale_service_id", booking_service_id=service_id.strip())

    service_name = booking_data.get("service_name")
    if not isinstance(service_name, str) or not service_name.strip():
        raise HTTPException(status_code=422, detail="Booking has no service identifier. Update the booking before continuing.")
    matches = []
    try:
        service_docs = db.collection("services").where("salon_id", "==", salon_id).stream()
    except (KeyError, AttributeError):
        service_docs = None
    if service_docs is None and isinstance(service_id, str) and service_id.strip():
        return service_id.strip()
    normalized_service_name = service_name.strip().casefold().replace("’", "'")
    for service_doc in service_docs:
        service_data = service_doc.to_dict() or {}
        candidate_name = service_data.get("name", "").strip().casefold().replace("’", "'")
        if candidate_name == normalized_service_name:
            matches.append(service_doc.id)
    if len(matches) != 1:
        detail = "No matching salon service was found" if not matches else "Multiple salon services match this booking name"
        raise HTTPException(status_code=422, detail=f"{detail}; choose or restore a canonical service ID before continuing.")
    _log_eligibility("legacy_service_resolution", service_id_present=False, service_id_source="legacy_name", resolved=True, resolved_service_name=service_name.strip())
    return matches[0]


def _booking_with_canonical_service_id(booking_data: dict, salon_id: str) -> dict:
    normalized = dict(booking_data)
    normalized["service_id"] = _resolve_booking_service_id(normalized, salon_id)
    return normalized


def _booking_for_owner_list(doc_id: str, data: dict, salon_id: str):
    try:
        normalized = _booking_with_canonical_service_id(data, salon_id)
    except HTTPException as exc:
        normalized = dict(data)
        normalized["service_id"] = data.get("service_id")
        normalized["needs_service_mapping"] = True
        normalized["service_mapping_error"] = str(exc.detail)
    return _to_frontend_booking(doc_id, normalized).model_dump()


def _eligible_staff_for_service(salon_id: str, service_id: str, exclude_staff_id: str | None = None):
    eligible = []
    candidate_ids = []
    for staff_doc in db.collection("staff").where("salon_id", "==", salon_id).stream():
        staff_data = staff_doc.to_dict() or {}
        candidate_ids.append(staff_doc.id)
        filter_reasons = []
        if staff_data.get("is_active", True) is not True:
            filter_reasons.append("inactive")
        if staff_data.get("bookable", True) is not True:
            filter_reasons.append("unbookable")
        if staff_data.get("archived_at") is not None:
            filter_reasons.append("archived")
        if staff_data.get("is_demo") is True or staff_data.get("protected") is True:
            filter_reasons.append("protected")
        if service_id not in resolve_staff_canonical_service_ids(db, staff_data):
            filter_reasons.append("different_service")
        if staff_doc.id == exclude_staff_id:
            filter_reasons.append("current_stylist")
        _log_eligibility("staff_candidate", staff_id=staff_doc.id, reasons=filter_reasons)
        if filter_reasons:
            continue
        eligible.append({"id": staff_doc.id, "name": staff_data.get("name", "")})
    _log_eligibility("staff_summary", salon_id=salon_id, service_id=service_id, candidate_ids=candidate_ids, eligible_count=len(eligible))
    return eligible


def _log_eligibility(event: str, **fields):
    if os.getenv("APP_ENV", "").casefold() in {"local", "test", "development"}:
        logger.info("booking_eligibility_%s", event, extra={key: value for key, value in fields.items() if key not in {"service_name"}})


def _build_conflict_response_detail(exc: BookingUnavailableError, payload: BookingCreateRequest):
    detail = {
        "error": "slot_unavailable",
        "message": str(exc) or "This time slot is no longer available. Please choose another time.",
        "reason": getattr(exc, "reason", "overlap"),
        "stylist_id": payload.stylist_id,
        "appointment_date": payload.appointment_date,
        "appointment_time": payload.appointment_time,
    }
    conflict_range = getattr(exc, "conflict_range", None)
    if conflict_range:
        detail["conflict_range"] = conflict_range
    return detail


# TODO: Add transactional double-booking prevention before production use.
# The current server-side check is a best-effort guard and should be replaced by a
# stricter database transaction or a unique slot reservation mechanism.
def _booking_overlap_conflict(
    salon_id: str,
    stylist_id: str,
    appointment_date: str,
    appointment_time: str,
    duration_minutes: int,
    exclude_booking_id: str | None = None,
    buffer_minutes: int = DEFAULT_BUFFER_MINUTES,
):
    request_start = parse_booking_datetime(appointment_date, appointment_time)
    request_end = request_start + timedelta(minutes=duration_minutes)
    padded_start = request_start - timedelta(minutes=buffer_minutes)
    padded_end = request_end + timedelta(minutes=buffer_minutes)

    query = (
        db.collection("bookings")
        .where("stylist_id", "==", stylist_id)
        .where("appointment_date", "==", appointment_date)
    )
    for booking_doc in query.stream():
        if booking_doc.id == exclude_booking_id:
            continue

        booking_data = booking_doc.to_dict() or {}
        if booking_data.get("status") in CONFLICT_STATUSES:
            continue
        if booking_data.get("salon_id") and booking_data.get("salon_id") != salon_id:
            continue

        existing_start = parse_booking_datetime(
            booking_data.get("appointment_date", appointment_date),
            booking_data.get("appointment_time", appointment_time),
        )
        existing_end = existing_start + timedelta(
            minutes=int(booking_data.get("duration_minutes", 0) or 0)
        )
        if request_start < existing_end and existing_start < request_end:
            return "overlap", format_time_range(existing_start, existing_end)

        if padded_start < existing_end and existing_start < padded_end:
            return "overlap", format_time_range(existing_start, existing_end)

    slot_available = is_slot_available(
        db,
        salon_id,
        stylist_id,
        appointment_date,
        appointment_time,
        duration_minutes,
        buffer_minutes=buffer_minutes,
        exclude_booking_id=exclude_booking_id,
    )
    if not slot_available:
        return "unavailable", "stylist availability window"

    return None, None


@firestore.transactional
def _create_booking_transaction(transaction, payload: BookingCreateRequest):
    appointment_date = payload.appointment_date
    appointment_time = payload.appointment_time
    duration_minutes = payload.duration_minutes

    request_start = validate_appointment_datetime(appointment_date, appointment_time)
    request_end = request_start + timedelta(minutes=duration_minutes)
    padded_start = request_start - timedelta(minutes=DEFAULT_BUFFER_MINUTES)
    padded_end = request_end + timedelta(minutes=DEFAULT_BUFFER_MINUTES)

    bookings_query = (
        db.collection("bookings")
        .where("stylist_id", "==", payload.stylist_id)
        .where("appointment_date", "==", appointment_date)
    )
    booking_docs = list(transaction.get(bookings_query))
    for booking_doc in booking_docs:
        booking_data = booking_doc.to_dict() or {}
        if booking_data.get("status") in CONFLICT_STATUSES:
            continue

        existing_start = parse_booking_datetime(
            booking_data.get("appointment_date", appointment_date),
            booking_data.get("appointment_time", appointment_time),
        )
        existing_duration = int(booking_data.get("duration_minutes", 0) or 0)
        existing_end = existing_start + timedelta(minutes=existing_duration)
        if padded_start < existing_end and existing_start < padded_end:
            raise BookingUnavailableError(
                "overlap",
                format_time_range(existing_start, existing_end),
            )

    schedule_query = (
        db.collection("stylist_schedule")
        .where("salon_id", "==", payload.salon_id)
        .where("stylist_id", "==", payload.stylist_id)
    )
    schedule_docs = list(transaction.get(schedule_query))
    for schedule_doc in schedule_docs:
        schedule_data = schedule_doc.to_dict() or {}
        kind = schedule_data.get("kind")
        if kind == "recurring_break":
            if int(schedule_data.get("day_of_week", -1)) != request_start.weekday():
                continue
            break_start = datetime.combine(
                request_start.date(),
                parse_time_value(schedule_data.get("start_time", "09:00")),
            )
            break_end = datetime.combine(
                request_start.date(),
                parse_time_value(schedule_data.get("end_time", "18:00")),
            )
            if request_start < break_end and break_start < request_end:
                raise BookingUnavailableError("stylist break", format_time_range(break_start, break_end))
        elif kind == "leave":
            leave_start_date = date_cls.fromisoformat(schedule_data.get("start_date", appointment_date))
            leave_end_date = date_cls.fromisoformat(schedule_data.get("end_date", appointment_date))
            if not (leave_start_date <= request_start.date() <= leave_end_date):
                continue

            leave_start_time = schedule_data.get("start_time")
            leave_end_time = schedule_data.get("end_time")
            if leave_start_time and leave_end_time:
                leave_start = datetime.combine(
                    request_start.date(),
                    parse_time_value(leave_start_time),
                )
                leave_end = datetime.combine(
                    request_start.date(),
                    parse_time_value(leave_end_time),
                )
                if request_start < leave_end and leave_start < request_end:
                    raise BookingUnavailableError("stylist leave", format_time_range(leave_start, leave_end))
            else:
                raise BookingUnavailableError(
                    "stylist leave",
                    f"{leave_start_date.isoformat()} to {leave_end_date.isoformat()}",
                )

    booking_ref = db.collection("bookings").document()
    booking_data = {
        "salon_id": payload.salon_id,
        "customer_name": payload.customer_name,
        "customer_email": payload.customer_email,
        "customer_phone": payload.customer_phone,
        "notes": payload.notes,
        "service_id": payload.service_id,
        "service_name": payload.service_name,
        "stylist_id": payload.stylist_id,
        "stylist_name": payload.stylist_name,
        "appointment_date": payload.appointment_date,
        "appointment_time": payload.appointment_time,
        "duration_minutes": payload.duration_minutes,
        "amount": payload.amount,
        "status": "Pending",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    transaction.set(booking_ref, booking_data)
    return booking_ref.id


@router.get("/ping")
async def ping_bookings():
    return {"message": "bookings ok"}


@router.post("/", response_model=dict)
async def create_booking(payload: BookingCreateRequest):
    transaction = db.transaction()
    try:
        booking_id = _create_booking_transaction(transaction, payload)
    except BookingUnavailableError as exc:
        raise HTTPException(
            status_code=409,
            detail=_build_conflict_response_detail(exc, payload),
        ) from exc
    except Exception as exc:  # pragma: no cover - real Firestore issue
        raise HTTPException(status_code=500, detail=f"Unable to save booking: {exc}") from exc

    saved_booking = db.collection("bookings").document(booking_id).get().to_dict() or {}
    saved_booking["id"] = booking_id
    returned_booking = _to_frontend_booking(booking_id, saved_booking)

    return {"id": booking_id, "booking": returned_booking.model_dump()}


@router.get("/availability", response_model=dict)
async def salon_availability(
    salon_id: str = Query(..., description="Salon ID to inspect availability for."),
    date: str = Query(..., description="Requested appointment date in YYYY-MM-DD format."),
    duration_minutes: int = Query(..., gt=0, description="Requested service duration in minutes."),
    service_id: str | None = None,
):
    try:
        date_cls.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format.") from exc

    schedule_docs = list(
        db.collection("stylist_schedule")
        .where("salon_id", "==", salon_id)
        .stream()
    )
    stylist_ids = []
    for schedule_doc in schedule_docs:
        schedule_data = schedule_doc.to_dict() or {}
        stylist_id = schedule_data.get("stylist_id")
        if stylist_id and stylist_id not in stylist_ids:
            stylist_ids.append(stylist_id)

    if service_id:
        eligible_ids = {staff["id"] for staff in _eligible_staff_for_service(salon_id, service_id)}
        stylist_ids = [stylist_id for stylist_id in stylist_ids if stylist_id in eligible_ids]

    slot_map: dict[str, list[str]] = {}
    for stylist_id in stylist_ids:
        available_slots = get_available_slots_for_day(
            db,
            salon_id,
            stylist_id,
            date,
            duration_minutes,
            buffer_minutes=DEFAULT_BUFFER_MINUTES,
        )
        for slot_time in available_slots:
            slot_map.setdefault(slot_time, []).append(stylist_id)

    available_slots = [
        {
            "time": slot_time,
            "stylists": [{"id": stylist_id} for stylist_id in sorted(slot_map[slot_time])],
        }
        for slot_time in sorted(slot_map.keys(), key=lambda value: parse_time_value(value))
    ]

    return {
        "salon_id": salon_id,
        "date": date,
        "duration_minutes": duration_minutes,
        "available_slots": available_slots,
    }


@router.get("/eligible-stylists", response_model=dict)
async def eligible_stylists(
    salon_id: str = Query(...),
    service_id: str = Query(...),
):
    service_snapshot = db.collection("services").document(service_id).get()
    service_data = service_snapshot.to_dict() or {}
    if not service_snapshot.exists or service_data.get("salon_id") != salon_id or service_data.get("is_active", True) is not True:
        raise HTTPException(status_code=422, detail="Selected service is not available at this salon.")
    return {"service_id": service_id, "stylists": _eligible_staff_for_service(salon_id, service_id)}


@router.get("/", response_model=dict, dependencies=[Depends(verify_api_key)])
async def list_bookings(
    salon_id: str | None = Query(None, description="Optional salon scope to validate."),
    owner: OwnerAccess = Depends(require_owner),
):
    normalized_salon_id = owner["salon_id"]
    if salon_id and salon_id.strip() != normalized_salon_id:
        raise HTTPException(status_code=403, detail="You are not authorized to access this salon.")

    try:
        query = db.collection("bookings").where("salon_id", "==", normalized_salon_id)
        booking_docs = list(query.stream())
    except Exception as exc:  # pragma: no cover - Firestore lookup failure
        raise HTTPException(status_code=500, detail=f"Unable to load bookings: {exc}") from exc

    bookings = []
    for booking_doc in booking_docs:
        data = booking_doc.to_dict() or {}
        bookings.append(_booking_for_owner_list(booking_doc.id, data, normalized_salon_id))

    bookings.sort(
        key=lambda booking: (
            booking.get("created_at") or "",
            booking.get("updated_at") or "",
        ),
        reverse=True,
    )

    return {"bookings": bookings, "count": len(bookings)}


@router.post("/{booking_id}/service-mapping", response_model=dict, dependencies=[Depends(verify_api_key)])
async def map_booking_service(
    booking_id: str,
    payload: BookingServiceMappingRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snapshot = booking_ref.get()
    booking_data = booking_snapshot.to_dict() or {}
    if not booking_snapshot.exists or booking_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Booking not found.")
    service_ref = db.collection("services").document(payload.service_id)
    service_snapshot = service_ref.get()
    service_data = service_snapshot.to_dict() or {}
    if not service_snapshot.exists or service_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=422, detail="Selected service is not available for this salon.")
    if service_data.get("is_demo") is True or service_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Protected services cannot be mapped.")
    previous_snapshot = {
        "service_id": booking_data.get("service_id"),
        "service_name": booking_data.get("service_name"),
        "amount": booking_data.get("amount"),
    }
    try:
        booking_ref.update({
            "service_id": payload.service_id,
            "service_mapping_source": "owner_manual",
            "service_mapped_at": firestore.SERVER_TIMESTAMP,
            "service_mapped_by": owner["uid"],
            "previous_service_snapshot": previous_snapshot,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "updated_by": owner["uid"],
        })
        updated = booking_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to map booking service.") from exc
    return _updated_booking_response(booking_id, updated)


def _owned_booking_reference(booking_id: str, owner: OwnerAccess):
    if not booking_id.strip():
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking_ref = db.collection("bookings").document(booking_id)
    booking_snapshot = booking_ref.get()
    booking_data = booking_snapshot.to_dict() or {}
    if not booking_snapshot.exists or booking_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking_ref, booking_data


def _booking_interval(appointment_date: str, appointment_time: str, duration_minutes: int):
    try:
        start = validate_appointment_datetime(appointment_date, appointment_time)
    except (TypeError, ValueError) as exc:
        raise BookingUnavailableError("invalid or past appointment time") from exc
    end = start + timedelta(minutes=duration_minutes)
    business_start = datetime.combine(start.date(), parse_time_value("09:00"))
    business_end = datetime.combine(start.date(), parse_time_value("19:00"))
    if start < business_start or end > business_end:
        raise BookingUnavailableError("outside business hours")
    return start, end


def _validate_entities_in_transaction(transaction, booking_data: dict, owner: OwnerAccess):
    staff_ref = db.collection("staff").document(booking_data.get("stylist_id", ""))
    service_ref = db.collection("services").document(booking_data.get("service_id", ""))
    staff_snapshot = next(transaction.get(staff_ref), None)
    service_snapshot = next(transaction.get(service_ref), None)
    staff_data = staff_snapshot.to_dict() if staff_snapshot else {}
    service_data = service_snapshot.to_dict() if service_snapshot else {}

    if (
        not staff_snapshot
        or not staff_snapshot.exists
        or staff_data.get("salon_id") != owner["salon_id"]
        or staff_data.get("is_active", True) is not True
    ):
        raise BookingUnavailableError("inactive staff")
    if (
        not service_snapshot
        or not service_snapshot.exists
        or service_data.get("salon_id") != owner["salon_id"]
        or service_data.get("is_active", True) is not True
    ):
        raise BookingUnavailableError("inactive service")

    assigned_service_ids = staff_service_ids(staff_data)
    booking_service_id = booking_data.get("service_id")
    if booking_service_id not in assigned_service_ids:
        # Legacy fallback: canonical ID may live only in the legacy `services` field.
        # Safe without an extra read here since `service_data` above already
        # confirmed the booking's service_id belongs to this salon.
        legacy_ids = {normalize_service_id(value) for value in staff_data.get("services", []) or []}
        if booking_service_id not in legacy_ids:
            raise BookingUnavailableError("ineligible staff/service")
    return staff_data, service_data


def _validate_reschedule_staff_in_transaction(transaction, booking_data: dict, payload: BookingRescheduleRequest, owner: OwnerAccess):
    selected_staff_ref = db.collection("staff").document(payload.staff_id)
    selected_staff_snapshot = next(transaction.get(selected_staff_ref), None)
    if not selected_staff_snapshot or not selected_staff_snapshot.exists:
        raise HTTPException(status_code=422, detail="Selected staff member is invalid.")

    selected_staff_data = selected_staff_snapshot.to_dict() or {}
    if selected_staff_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=422, detail="Selected staff member is invalid.")
    if selected_staff_data.get("is_demo") is True or selected_staff_data.get("protected") is True:
        raise BookingUnavailableError("protected staff")

    selected_booking_data = {
        **booking_data,
        "service_id": _resolve_booking_service_id(booking_data, owner["salon_id"]),
        "stylist_id": payload.staff_id,
        "stylist_name": selected_staff_data.get("name", ""),
    }
    _validate_entities_in_transaction(transaction, selected_booking_data, owner)
    return selected_staff_data


def _validate_slot_in_transaction(
    transaction,
    salon_id: str,
    stylist_id: str,
    appointment_date: str,
    appointment_time: str,
    duration_minutes: int,
    exclude_booking_id: str | None = None,
):
    start, end = _booking_interval(appointment_date, appointment_time, duration_minutes)
    bookings_query = (
        db.collection("bookings")
        .where("salon_id", "==", salon_id)
        .where("stylist_id", "==", stylist_id)
        .where("appointment_date", "==", appointment_date)
    )
    for booking_doc in transaction.get(bookings_query):
        if booking_doc.id == exclude_booking_id:
            continue
        booking_data = booking_doc.to_dict() or {}
        if booking_data.get("status") in CONFLICT_STATUSES:
            continue
        existing_start = parse_booking_datetime(
            booking_data.get("appointment_date", appointment_date),
            booking_data.get("appointment_time", appointment_time),
        )
        existing_end = existing_start + timedelta(minutes=int(booking_data.get("duration_minutes", 0) or 0))
        expanded_start = start - timedelta(minutes=DEFAULT_BUFFER_MINUTES)
        expanded_end = end + timedelta(minutes=DEFAULT_BUFFER_MINUTES)
        if expanded_start < existing_end and existing_start < expanded_end:
            raise BookingUnavailableError("overlap", format_time_range(existing_start, existing_end))

    schedule_query = (
        db.collection("stylist_schedule")
        .where("salon_id", "==", salon_id)
        .where("stylist_id", "==", stylist_id)
    )
    for schedule_doc in transaction.get(schedule_query):
        schedule_data = schedule_doc.to_dict() or {}
        kind = schedule_data.get("kind")
        if kind == "recurring_break":
            if int(schedule_data.get("day_of_week", -1)) != start.weekday():
                continue
            break_start = datetime.combine(start.date(), parse_time_value(schedule_data.get("start_time", "09:00")))
            break_end = datetime.combine(start.date(), parse_time_value(schedule_data.get("end_time", "18:00")))
            if start < break_end and break_start < end:
                raise BookingUnavailableError("stylist break", format_time_range(break_start, break_end))
        elif kind == "leave":
            leave_start = date_cls.fromisoformat(schedule_data.get("start_date", appointment_date))
            leave_end = date_cls.fromisoformat(schedule_data.get("end_date", appointment_date))
            if leave_start <= start.date() <= leave_end:
                raise BookingUnavailableError("stylist leave", f"{leave_start.isoformat()} to {leave_end.isoformat()}")


def _updated_booking_response(booking_id: str, data: dict):
    return {"id": booking_id, "booking": _to_frontend_booking(booking_id, data).model_dump()}


@router.get("/{booking_id}", response_model=dict, dependencies=[Depends(verify_api_key)])
async def get_booking_details(booking_id: str, owner: OwnerAccess = Depends(require_owner)):
    booking_ref, booking_data = _owned_booking_reference(booking_id, owner)
    booking_data = _booking_with_canonical_service_id(booking_data, owner["salon_id"])
    return _updated_booking_response(booking_id, booking_data)


@firestore.transactional
def _confirm_booking_transaction(transaction, booking_id: str, owner: OwnerAccess):
    booking_ref = db.collection("bookings").document(booking_id)
    snapshot = next(transaction.get(booking_ref), None)
    data = snapshot.to_dict() if snapshot else {}
    if not snapshot or not snapshot.exists or data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if data.get("status") not in {"Pending", "Rescheduled"}:
        raise HTTPException(status_code=409, detail="This booking cannot be confirmed from its current status.")
    _validate_entities_in_transaction(transaction, data, owner)
    _validate_slot_in_transaction(transaction, owner["salon_id"], data["stylist_id"], data["appointment_date"], data["appointment_time"], int(data["duration_minutes"]), booking_id)
    update = {"status": "Confirmed", "updated_at": firestore.SERVER_TIMESTAMP, "updated_by": owner["uid"], "version": int(data.get("version", 1)) + 1}
    transaction.update(booking_ref, update)
    return booking_ref


@router.post("/{booking_id}/confirm", response_model=dict, dependencies=[Depends(verify_api_key)])
async def confirm_booking(booking_id: str, owner: OwnerAccess = Depends(require_owner)):
    request_id = f"confirm-{booking_id}"
    try:
        booking_ref = _confirm_booking_transaction(db.transaction(), booking_id, owner)
        updated = booking_ref.get().to_dict() or {}
    except BookingUnavailableError as exc:
        raise HTTPException(status_code=409, detail={"error": "slot_unavailable", "message": str(exc)}) from exc
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - unexpected Firestore/runtime failure
        logger.exception("Booking action failed", extra={"action": "confirm", "booking_id": booking_id, "request_id": request_id})
        raise HTTPException(status_code=500, detail="Unable to confirm booking right now.") from exc
    return _updated_booking_response(booking_id, updated)


@router.post("/{booking_id}/cancel", response_model=dict, dependencies=[Depends(verify_api_key)])
async def cancel_booking(booking_id: str, payload: BookingCancelRequest, owner: OwnerAccess = Depends(require_owner)):
    booking_ref, data = _owned_booking_reference(booking_id, owner)
    if data.get("status") not in {"Pending", "Confirmed", "Rescheduled"}:
        raise HTTPException(status_code=409, detail="This booking cannot be cancelled from its current status.")
    try:
        booking_ref.update({"status": "Cancelled", "cancelled_at": firestore.SERVER_TIMESTAMP, "cancelled_by": owner["uid"], "cancellation_reason": payload.cancellation_reason, "updated_at": firestore.SERVER_TIMESTAMP, "updated_by": owner["uid"], "version": int(data.get("version", 1)) + 1})
        updated = booking_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to cancel booking.") from exc
    return _updated_booking_response(booking_id, updated)


@firestore.transactional
def _reschedule_booking_transaction(transaction, booking_id: str, payload: BookingRescheduleRequest, owner: OwnerAccess):
    booking_ref = db.collection("bookings").document(booking_id)
    snapshot = next(transaction.get(booking_ref), None)
    data = snapshot.to_dict() if snapshot else {}
    if not snapshot or not snapshot.exists or data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if data.get("status") not in {"Pending", "Confirmed", "Rescheduled"}:
        raise HTTPException(status_code=409, detail="This booking cannot be rescheduled from its current status.")
    canonical_data = _booking_with_canonical_service_id(data, owner["salon_id"])
    _log_eligibility("reschedule_booking", booking_id=booking_id, service_id_present=bool(canonical_data.get("service_id")), service_id_source="booking_or_legacy", current_staff_id=data.get("stylist_id"), selected_staff_id=payload.staff_id)
    selected_staff_data = _validate_reschedule_staff_in_transaction(transaction, canonical_data, payload, owner)
    old_start, old_end = _booking_interval(data["appointment_date"], data["appointment_time"], int(data["duration_minutes"]))
    _validate_slot_in_transaction(transaction, owner["salon_id"], payload.staff_id, payload.appointment_date, payload.appointment_time, int(data["duration_minutes"]), booking_id)
    update = {"status": "Rescheduled", "stylist_id": payload.staff_id, "stylist_name": selected_staff_data.get("name", ""), "appointment_date": payload.appointment_date, "appointment_time": payload.appointment_time, "previous_start_at": old_start.isoformat(), "previous_end_at": old_end.isoformat(), "rescheduled_at": firestore.SERVER_TIMESTAMP, "rescheduled_by": owner["uid"], "reschedule_reason": payload.reschedule_reason, "updated_at": firestore.SERVER_TIMESTAMP, "updated_by": owner["uid"], "version": int(data.get("version", 1)) + 1}
    if payload.staff_id != data.get("stylist_id"):
        update["previous_staff_id"] = data.get("stylist_id")
        update["previous_staff_name"] = data.get("stylist_name")
    transaction.update(booking_ref, update)
    return booking_ref


@router.post("/{booking_id}/reschedule", response_model=dict, dependencies=[Depends(verify_api_key)])
async def reschedule_booking(booking_id: str, payload: BookingRescheduleRequest, owner: OwnerAccess = Depends(require_owner)):
    try:
        booking_ref = _reschedule_booking_transaction(db.transaction(), booking_id, payload, owner)
        updated = booking_ref.get().to_dict() or {}
    except BookingUnavailableError as exc:
        raise HTTPException(status_code=409, detail={"error": "slot_unavailable", "message": str(exc)}) from exc
    return _updated_booking_response(booking_id, updated)


@router.post("/{booking_id}/complete", response_model=dict, dependencies=[Depends(verify_api_key)])
async def complete_booking(booking_id: str, owner: OwnerAccess = Depends(require_owner)):
    booking_ref, data = _owned_booking_reference(booking_id, owner)
    if data.get("status") != "Confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be completed.")
    try:
        booking_ref.update({"status": "Completed", "completed_at": firestore.SERVER_TIMESTAMP, "completed_by": owner["uid"], "updated_at": firestore.SERVER_TIMESTAMP, "updated_by": owner["uid"], "version": int(data.get("version", 1)) + 1})
        updated = booking_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to complete booking.") from exc
    return _updated_booking_response(booking_id, updated)


@router.get("/stylists/{stylist_id}/availability", response_model=dict)
async def stylist_availability(
    stylist_id: str,
    salon_id: str = Query(..., description="Salon ID to scope the stylist schedule."),
    date: str = Query(..., description="Requested appointment date in YYYY-MM-DD format."),
    duration_minutes: int = Query(..., gt=0, description="Requested service duration in minutes."),
):
    try:
        date_cls.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format.") from exc

    try:
        slots = get_available_slots_for_day(
            db,
            salon_id,
            stylist_id,
            date,
            duration_minutes,
            buffer_minutes=DEFAULT_BUFFER_MINUTES,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "salon_id": salon_id,
        "stylist_id": stylist_id,
        "date": date,
        "duration_minutes": duration_minutes,
        "available_slots": slots,
    }


@router.patch("/{booking_id}/status", response_model=dict, dependencies=[Depends(verify_api_key)])
async def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    if not booking_id or not booking_id.strip():
        raise HTTPException(status_code=400, detail="booking_id is required.")

    booking_ref = db.collection("bookings").document(booking_id)
    booking_snapshot = booking_ref.get()
    if not booking_snapshot.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking_data = booking_snapshot.to_dict() or {}
    if booking_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=403, detail="You are not authorized to update this booking.")

    if payload.status not in VALID_BOOKING_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: Pending, Confirmed, Completed, Cancelled, No-show.",
        )

    current_status = booking_data.get("status", "Pending")
    if payload.status not in OWNER_STATUS_TRANSITIONS.get(current_status, set()):
        raise HTTPException(status_code=409, detail="This booking status transition is not allowed.")
    if payload.status == "Cancelled":
        raise HTTPException(status_code=422, detail="Use the cancellation action with a cancellation_reason.")

    try:
        booking_ref.update({
            "status": payload.status,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        updated_booking = booking_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore write failure
        raise HTTPException(status_code=500, detail=f"Unable to update booking status: {exc}") from exc

    returned_booking = _to_frontend_booking(booking_id, updated_booking)
    return {"id": booking_id, "booking": returned_booking.model_dump()}
