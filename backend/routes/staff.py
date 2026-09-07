from datetime import date, datetime
import logging
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import firestore
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import OwnerAccess, require_owner, verify_api_key
from firebase_config import db
from staff_eligibility import resolve_staff_canonical_service_ids

router = APIRouter()
logger = logging.getLogger(__name__)


class StaffCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    role: str = Field(..., min_length=1, max_length=120)
    speciality: str = Field(..., min_length=1, max_length=300)
    phone: str = Field(..., min_length=3, max_length=40)
    services: list[str] = Field(default_factory=list, max_length=30)
    today_hours: str = Field(..., min_length=1, max_length=120)
    weekly_hours: str = Field(..., min_length=1, max_length=120)

    @field_validator("name", "role", "speciality", "phone", "today_hours", "weekly_hours", mode="before")
    @classmethod
    def strip_strings(cls, value):
        if not isinstance(value, str):
            raise ValueError("This field must be a string.")
        return value.strip()

    @field_validator("services", mode="before")
    @classmethod
    def clean_services(cls, value):
        if not isinstance(value, list):
            raise ValueError("services must be a list.")
        return [service.strip() for service in value if isinstance(service, str) and service.strip()]


class StaffUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    role: str = Field(..., min_length=1, max_length=120)
    speciality: str = Field(..., min_length=1, max_length=300)
    phone: str = Field(..., min_length=3, max_length=40)
    service_ids: list[str] = Field(default_factory=list, max_length=30)
    today_hours: str = Field(..., min_length=1, max_length=120)
    weekly_hours: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True
    bookable: bool = True
    status: str = Field(..., min_length=1, max_length=30)

    @field_validator("name", "role", "speciality", "phone", "today_hours", "weekly_hours", "status", mode="before")
    @classmethod
    def strip_update_strings(cls, value):
        if not isinstance(value, str):
            raise ValueError("This field must be a string.")
        return value.strip()

    @field_validator("service_ids", mode="before")
    @classmethod
    def clean_service_ids(cls, value):
        if not isinstance(value, list):
            raise ValueError("service_ids must be a list.")
        return list(dict.fromkeys(service.strip() for service in value if isinstance(service, str) and service.strip()))


class StaffResponse(BaseModel):
    id: str
    salon_id: str
    name: str
    role: str
    speciality: str
    phone: str
    rating: float
    status: str
    today_hours: str
    weekly_hours: str
    services: list[str]
    service_ids: list[str] = Field(default_factory=list)
    color: str
    created_at: str | None = None
    updated_at: str | None = None
    is_active: bool = True
    bookable: bool = True
    archived_at: str | None = None
    archived_by: str | None = None


def _serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _staff_response(document_id: str, data: dict) -> StaffResponse:
    serialized = {key: _serialize(value) for key, value in data.items()}
    service_ids = resolve_staff_canonical_service_ids(db, data)
    service_names = []
    for service_id in service_ids:
        service_snapshot = db.collection("services").document(service_id).get()
        service_data = service_snapshot.to_dict() or {}
        if service_snapshot.exists and service_data.get("salon_id") == data.get("salon_id"):
            service_names.append(service_data.get("name", service_id))
    if not service_names and not service_ids:
        service_names = [value for value in data.get("services", []) if isinstance(value, str) and value]
    serialized["service_ids"] = service_ids
    serialized["services"] = service_names
    return StaffResponse(id=document_id, **serialized)


def _log_staff_lookup(event: str, **fields):
    if os.getenv("APP_ENV", "").casefold() in {"local", "test", "development"}:
        logger.info("staff_eligibility_%s", event, extra=fields)


def _resolve_staff_service_selection(salon_id: str, values: list[str]) -> tuple[list[str], list[str]]:
    """Resolve free-text/service-id input into canonical service document IDs + names."""
    salon_services = {
        service_doc.id: (service_doc.to_dict() or {})
        for service_doc in db.collection("services").where("salon_id", "==", salon_id).stream()
    }
    services_by_name = {
        (data.get("name") or "").strip().casefold(): (service_id, data)
        for service_id, data in salon_services.items()
    }

    resolved_ids: list[str] = []
    resolved_names: list[str] = []
    for raw_value in values:
        candidate = raw_value.strip()
        if not candidate:
            continue
        service_id, service_data = None, None
        if candidate in salon_services:
            service_id, service_data = candidate, salon_services[candidate]
        else:
            match = services_by_name.get(candidate.casefold())
            if match:
                service_id, service_data = match
        if service_id is None or service_data.get("is_active", True) is not True:
            raise HTTPException(status_code=422, detail="One or more selected services are invalid.")
        if service_id not in resolved_ids:
            resolved_ids.append(service_id)
            resolved_names.append(service_data.get("name", service_id))
    return resolved_ids, resolved_names


@router.post("/", response_model=dict, status_code=201, dependencies=[Depends(verify_api_key)])
async def create_staff_member(
    payload: StaffCreateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    salon_id = owner["salon_id"]
    normalized_phone = payload.phone.casefold()

    try:
        existing_staff = db.collection("staff").where("salon_id", "==", salon_id).stream()
        for staff_doc in existing_staff:
            staff_data = staff_doc.to_dict() or {}
            if staff_data.get("phone", "").strip().casefold() == normalized_phone:
                raise HTTPException(status_code=409, detail="A staff member with this phone already exists.")

        resolved_service_ids, resolved_service_names = _resolve_staff_service_selection(salon_id, payload.services)

        staff_ref = db.collection("staff").document()
        staff_ref.set({
            "salon_id": salon_id,
            "name": payload.name,
            "role": payload.role,
            "speciality": payload.speciality,
            "phone": payload.phone,
            "rating": 0,
            "status": "Available",
            "today_hours": payload.today_hours,
            "weekly_hours": payload.weekly_hours,
            "services": resolved_service_names,
            "service_ids": resolved_service_ids,
            "color": "from-pink-300 to-purple-200",
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "is_active": True,
            "bookable": True,
            "archived_at": None,
            "archived_by": None,
        })
        saved_data = staff_ref.get().to_dict() or {}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to save staff member.") from exc

    return {"id": staff_ref.id, "staff": _staff_response(staff_ref.id, saved_data).model_dump()}


class StaffStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["Available", "Busy", "On Leave"]


@router.patch("/{staff_id}/status", response_model=dict, dependencies=[Depends(verify_api_key)])
async def update_staff_status(
    staff_id: str,
    payload: StaffStatusUpdateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    """Persist only the today-status field, leaving services/hours/lifecycle fields untouched."""
    if not staff_id.strip():
        raise HTTPException(status_code=404, detail="Staff member not found.")

    staff_ref = db.collection("staff").document(staff_id)
    staff_snapshot = staff_ref.get()
    staff_data = staff_snapshot.to_dict() or {}
    if not staff_snapshot.exists or staff_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if staff_data.get("is_demo") is True or staff_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Demo staff members cannot be edited.")

    try:
        staff_ref.update({"status": payload.status, "updated_at": firestore.SERVER_TIMESTAMP})
        updated_data = staff_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to update staff status.") from exc

    return {"id": staff_id, "staff": _staff_response(staff_id, updated_data).model_dump()}


@router.patch("/{staff_id}/deactivate", response_model=dict, dependencies=[Depends(verify_api_key)])
async def deactivate_staff_member(
    staff_id: str,
    owner: OwnerAccess = Depends(require_owner),
):
    if not staff_id.strip():
        raise HTTPException(status_code=404, detail="Staff member not found.")

    staff_ref = db.collection("staff").document(staff_id)
    staff_snapshot = staff_ref.get()
    staff_data = staff_snapshot.to_dict() or {}
    if not staff_snapshot.exists or staff_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if staff_data.get("is_demo") is True or staff_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Demo staff members cannot be deactivated.")

    try:
        staff_ref.update({
            "is_active": False,
            "archived_at": firestore.SERVER_TIMESTAMP,
            "archived_by": owner["uid"],
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        updated_data = staff_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to deactivate staff member.") from exc

    return {"id": staff_id, "staff": _staff_response(staff_id, updated_data).model_dump()}


@firestore.transactional
def _update_staff_transaction(transaction, staff_id: str, payload: StaffUpdateRequest, owner: OwnerAccess):
    staff_ref = db.collection("staff").document(staff_id)
    staff_snapshot = next(transaction.get(staff_ref), None)
    if not staff_snapshot or not staff_snapshot.exists:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    staff_data = staff_snapshot.to_dict() or {}
    if staff_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if staff_data.get("is_demo") is True or staff_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Demo staff members cannot be edited.")

    service_refs = []
    service_docs = []
    for service_id in payload.service_ids:
        service_ref = db.collection("services").document(service_id)
        service_snapshot = next(transaction.get(service_ref), None)
        service_data = service_snapshot.to_dict() if service_snapshot else {}
        if (
            not service_snapshot
            or not service_snapshot.exists
            or service_data.get("salon_id") != owner["salon_id"]
            or service_data.get("is_active", True) is not True
        ):
            raise HTTPException(status_code=422, detail="One or more selected services are invalid.")
        service_refs.append(service_ref)
        service_docs.append(service_data)

    salon_services = db.collection("services").where("salon_id", "==", owner["salon_id"])
    for service_snapshot in transaction.get(salon_services):
        service_data = service_snapshot.to_dict() or {}
        assigned_staff = service_data.get("staff") or []
        if staff_id in assigned_staff or staff_data.get("name") in assigned_staff:
            service_refs.append(db.collection("services").document(service_snapshot.id))
            service_docs.append(service_data)

    selected_service_names = [service_data.get("name", service_ref.id) for service_ref, service_data in zip(service_refs, service_docs) if service_ref.id in payload.service_ids]
    update = {
        "name": payload.name,
        "role": payload.role,
        "speciality": payload.speciality,
        "phone": payload.phone,
        "services": selected_service_names,
        "service_ids": payload.service_ids,
        "service_names": selected_service_names,
        "today_hours": payload.today_hours,
        "weekly_hours": payload.weekly_hours,
        "is_active": payload.is_active,
        "bookable": payload.bookable,
        "status": payload.status,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    transaction.update(staff_ref, update)

    for service_ref, service_data in zip(service_refs, service_docs):
        assigned_staff = [member for member in service_data.get("staff", []) if member not in {staff_id, staff_data.get("name")}]
        if service_ref.id in payload.service_ids:
            assigned_staff.append(staff_id)
        transaction.update(service_ref, {"staff": list(dict.fromkeys(assigned_staff)), "updated_at": firestore.SERVER_TIMESTAMP})
    return staff_ref


@router.patch("/{staff_id}", response_model=dict, dependencies=[Depends(verify_api_key)])
async def update_staff_member(
    staff_id: str,
    payload: StaffUpdateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    if not staff_id.strip():
        raise HTTPException(status_code=404, detail="Staff member not found.")
    try:
        staff_ref = _update_staff_transaction(db.transaction(), staff_id, payload, owner)
        updated_data = staff_ref.get().to_dict() or {}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to update staff member.") from exc
    return {"id": staff_id, "staff": _staff_response(staff_id, updated_data).model_dump()}


@router.get("/", response_model=dict, dependencies=[Depends(verify_api_key)])
async def list_staff(
    owner: OwnerAccess = Depends(require_owner),
    active_only: bool = Query(True),
    service_id: str | None = None,
    service_name: str | None = None,
    exclude_staff_id: str | None = None,
):
    salon_id = owner["salon_id"]
    service_filter = {value for value in (service_id, service_name) if isinstance(value, str) and value}
    eligible_staff = None
    if service_id or service_name:
        service_id_value = service_id or ""
        service_snapshot = db.collection("services").document(service_id_value).get()
        service_data = service_snapshot.to_dict() or {}
        if service_snapshot.exists and service_data.get("salon_id") == salon_id:
            eligible_staff = service_id_value if service_data.get("is_active", True) is True else set()
        else:
            eligible_staff = set()

    try:
        staff_docs = db.collection("staff").where("salon_id", "==", salon_id).stream()
        staff_members = []
        candidate_ids = []
        for staff_doc in staff_docs:
            staff_data = staff_doc.to_dict() or {}
            candidate_ids.append(staff_doc.id)
            reasons = []
            if active_only and staff_data.get("is_active", True) is not True:
                reasons.append("inactive")
            if staff_data.get("bookable", True) is not True:
                reasons.append("unbookable")
            if staff_data.get("archived_at") is not None:
                reasons.append("archived")
            if staff_data.get("is_demo", False) or staff_data.get("protected", False):
                reasons.append("protected")
            if eligible_staff is not None and eligible_staff not in resolve_staff_canonical_service_ids(db, staff_data):
                reasons.append("different_service")
            if exclude_staff_id and staff_doc.id == exclude_staff_id:
                reasons.append("current_stylist")
            _log_staff_lookup("candidate", staff_id=staff_doc.id, assigned_service_ids=resolve_staff_canonical_service_ids(db, staff_data), reasons=reasons)
            if not reasons:
                staff_members.append(_staff_response(staff_doc.id, staff_data).model_dump())
        _log_staff_lookup("summary", salon_id=salon_id, service_id=eligible_staff, candidate_ids=candidate_ids, eligible_count=len(staff_members))
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to load staff members.") from exc

    staff_members.sort(key=lambda member: member.get("created_at") or "", reverse=True)
    return {"count": len(staff_members), "staff": staff_members}

@router.get("/ping")
async def ping_staff():
    return {"message": "staff ok"}