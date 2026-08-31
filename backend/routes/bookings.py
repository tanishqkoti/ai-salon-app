from datetime import date as date_cls, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import verify_api_key
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from firebase_admin import firestore

from firebase_config import db
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

VALID_BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "No-show"]
CONFLICT_STATUSES = {"Cancelled", "Rejected"}


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


class BookingResponse(BaseModel):
    id: str
    salon_id: str
    customer_name: str
    customer_email: str
    service_id: str
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
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - real Firestore issue
        raise HTTPException(status_code=500, detail=f"Unable to save booking: {exc}") from exc

    saved_booking = db.collection("bookings").document(booking_id).get().to_dict() or {}
    saved_booking["id"] = booking_id
    returned_booking = _to_frontend_booking(booking_id, saved_booking)

    return {"id": booking_id, "booking": returned_booking.model_dump()}


@router.get("/", response_model=dict, dependencies=[Depends(verify_api_key)])
async def list_bookings(salon_id: str = Query(..., description="Salon ID to fetch bookings for.")):
    if not salon_id or not salon_id.strip():
        raise HTTPException(status_code=400, detail="Query parameter salon_id is required.")

    normalized_salon_id = salon_id.strip()

    try:
        query = db.collection("bookings").where("salon_id", "==", normalized_salon_id)
        booking_docs = list(query.stream())
    except Exception as exc:  # pragma: no cover - Firestore lookup failure
        raise HTTPException(status_code=500, detail=f"Unable to load bookings: {exc}") from exc

    bookings = []
    for booking_doc in booking_docs:
        data = booking_doc.to_dict() or {}
        bookings.append(_to_frontend_booking(booking_doc.id, data).model_dump())

    bookings.sort(
        key=lambda booking: (
            booking.get("created_at") or "",
            booking.get("updated_at") or "",
        ),
        reverse=True,
    )

    return {"bookings": bookings, "count": len(bookings)}


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
async def update_booking_status(booking_id: str, payload: BookingStatusUpdateRequest):
    if not booking_id or not booking_id.strip():
        raise HTTPException(status_code=400, detail="booking_id is required.")

    booking_ref = db.collection("bookings").document(booking_id)
    booking_snapshot = booking_ref.get()
    if not booking_snapshot.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if payload.status not in VALID_BOOKING_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: Pending, Confirmed, Completed, Cancelled, No-show.",
        )

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
