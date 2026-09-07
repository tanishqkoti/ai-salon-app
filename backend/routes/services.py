from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import firestore
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import OwnerAccess, require_owner, verify_api_key
from firebase_config import db

router = APIRouter()


class ServiceCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    duration_minutes: int = Field(..., gt=0, le=1440)
    price: int = Field(..., ge=0)
    status: str = Field(default="Active", min_length=1, max_length=30)
    staff: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("name", "status", mode="before")
    @classmethod
    def strip_strings(cls, value):
        if not isinstance(value, str):
            raise ValueError("This field must be a string.")
        return value.strip()

    @field_validator("staff", mode="before")
    @classmethod
    def clean_staff(cls, value):
        if not isinstance(value, list):
            raise ValueError("staff must be a list.")
        return [member.strip() for member in value if isinstance(member, str) and member.strip()]


class ServiceResponse(BaseModel):
    id: str
    salon_id: str
    name: str
    duration_minutes: int
    price: int
    status: str
    staff: list[str]
    created_at: str | None = None
    updated_at: str | None = None
    is_active: bool = True
    archived_at: str | None = None
    archived_by: str | None = None


class PublicServiceResponse(BaseModel):
    id: str
    name: str
    duration_minutes: int
    price: int
    is_active: bool = True


def _serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _service_response(document_id: str, data: dict) -> ServiceResponse:
    serialized = {key: _serialize(value) for key, value in data.items()}
    return ServiceResponse(id=document_id, **serialized)


@router.post("/", response_model=dict, status_code=201, dependencies=[Depends(verify_api_key)])
async def create_service(
    payload: ServiceCreateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    salon_id = owner["salon_id"]
    normalized_name = payload.name.casefold()

    try:
        existing_services = db.collection("services").where("salon_id", "==", salon_id).stream()
        for service_doc in existing_services:
            service_data = service_doc.to_dict() or {}
            if service_data.get("name", "").strip().casefold() == normalized_name:
                raise HTTPException(status_code=409, detail="A service with this name already exists.")

        service_ref = db.collection("services").document()
        service_ref.set({
            "salon_id": salon_id,
            "name": payload.name,
            "duration_minutes": payload.duration_minutes,
            "price": payload.price,
            "status": payload.status,
            "staff": payload.staff,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "is_active": True,
            "archived_at": None,
            "archived_by": None,
        })
        saved_data = service_ref.get().to_dict() or {}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to save service.") from exc

    return {"id": service_ref.id, "service": _service_response(service_ref.id, saved_data).model_dump()}


@router.patch("/{service_id}/archive", response_model=dict, dependencies=[Depends(verify_api_key)])
async def archive_service(
    service_id: str,
    owner: OwnerAccess = Depends(require_owner),
):
    if not service_id.strip():
        raise HTTPException(status_code=404, detail="Service not found.")

    service_ref = db.collection("services").document(service_id)
    service_snapshot = service_ref.get()
    service_data = service_snapshot.to_dict() or {}
    if not service_snapshot.exists or service_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Service not found.")
    if service_data.get("is_demo") is True or service_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Demo services cannot be archived.")

    try:
        service_ref.update({
            "is_active": False,
            "archived_at": firestore.SERVER_TIMESTAMP,
            "archived_by": owner["uid"],
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        updated_data = service_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to archive service.") from exc

    return {"id": service_id, "service": _service_response(service_id, updated_data).model_dump()}


@router.get("/", response_model=dict, dependencies=[Depends(verify_api_key)])
async def list_services(
    owner: OwnerAccess = Depends(require_owner),
    active_only: bool = Query(True),
):
    salon_id = owner["salon_id"]

    try:
        service_docs = db.collection("services").where("salon_id", "==", salon_id).stream()
        services = [
            _service_response(service_doc.id, service_doc.to_dict() or {}).model_dump()
            for service_doc in service_docs
            if not active_only or (service_doc.to_dict() or {}).get("is_active", True) is True
        ]
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to load services.") from exc

    services.sort(key=lambda service: service.get("created_at") or "", reverse=True)
    return {"count": len(services), "services": services}


@router.get("/public", response_model=dict)
async def list_public_services(salon_id: str = Query(..., min_length=1)):
    """Unauthenticated, salon-scoped, active-only service lookup for customer booking flows."""
    try:
        service_docs = db.collection("services").where("salon_id", "==", salon_id).stream()
        services = [
            PublicServiceResponse(id=service_doc.id, **(service_doc.to_dict() or {})).model_dump()
            for service_doc in service_docs
            if (service_doc.to_dict() or {}).get("is_active", True) is True
        ]
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to load services.") from exc

    return {"count": len(services), "services": services}