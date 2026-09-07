from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import OwnerAccess, require_owner, verify_api_key
from firebase_config import db

router = APIRouter()


class CustomerCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    phone: str = Field(..., min_length=3, max_length=40)
    preferred_stylist: str = Field(default="", max_length=120)

    @field_validator("name", "email", "phone", "preferred_stylist", mode="before")
    @classmethod
    def strip_strings(cls, value):
        if not isinstance(value, str):
            raise ValueError("This field must be a string.")
        return value.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str):
        if "@" not in value:
            raise ValueError("email must be a valid email address.")
        return value.lower()


class CustomerResponse(BaseModel):
    id: str
    salon_id: str
    name: str
    email: str
    phone: str
    visits: int
    total_spent: int
    loyalty_points: int
    preferred_stylist: str
    last_visit: str | None = None
    status: str
    service_history: list[str]
    created_at: str | None = None
    updated_at: str | None = None
    is_active: bool = True
    archived_at: str | None = None
    archived_by: str | None = None


def _serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _customer_response(document_id: str, data: dict) -> CustomerResponse:
    serialized = {key: _serialize(value) for key, value in data.items()}
    return CustomerResponse(id=document_id, **serialized)


@router.post("/", response_model=dict, status_code=201, dependencies=[Depends(verify_api_key)])
async def create_customer(
    payload: CustomerCreateRequest,
    owner: OwnerAccess = Depends(require_owner),
):
    salon_id = owner["salon_id"]
    normalized_email = payload.email.casefold()
    normalized_phone = payload.phone.casefold()

    try:
        existing_customers = db.collection("customers").where("salon_id", "==", salon_id).stream()
        for customer_doc in existing_customers:
            customer_data = customer_doc.to_dict() or {}
            if customer_data.get("email", "").strip().casefold() == normalized_email:
                raise HTTPException(status_code=409, detail="A customer with this email already exists.")
            if customer_data.get("phone", "").strip().casefold() == normalized_phone:
                raise HTTPException(status_code=409, detail="A customer with this phone already exists.")

        customer_ref = db.collection("customers").document()
        customer_ref.set({
            "salon_id": salon_id,
            "name": payload.name,
            "email": payload.email,
            "phone": payload.phone,
            "visits": 0,
            "total_spent": 0,
            "loyalty_points": 0,
            "preferred_stylist": payload.preferred_stylist,
            "last_visit": None,
            "status": "New",
            "service_history": [],
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "is_active": True,
            "archived_at": None,
            "archived_by": None,
        })
        saved_data = customer_ref.get().to_dict() or {}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to save customer.") from exc

    return {"id": customer_ref.id, "customer": _customer_response(customer_ref.id, saved_data).model_dump()}


@router.patch("/{customer_id}/archive", response_model=dict, dependencies=[Depends(verify_api_key)])
async def archive_customer(
    customer_id: str,
    owner: OwnerAccess = Depends(require_owner),
):
    if not customer_id.strip():
        raise HTTPException(status_code=404, detail="Customer not found.")

    customer_ref = db.collection("customers").document(customer_id)
    customer_snapshot = customer_ref.get()
    customer_data = customer_snapshot.to_dict() or {}
    if not customer_snapshot.exists or customer_data.get("salon_id") != owner["salon_id"]:
        raise HTTPException(status_code=404, detail="Customer not found.")
    if customer_data.get("is_demo") is True or customer_data.get("protected") is True:
        raise HTTPException(status_code=403, detail="Demo customers cannot be archived.")

    try:
        customer_ref.update({
            "is_active": False,
            "archived_at": firestore.SERVER_TIMESTAMP,
            "archived_by": owner["uid"],
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        updated_data = customer_ref.get().to_dict() or {}
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to archive customer.") from exc

    return {"id": customer_id, "customer": _customer_response(customer_id, updated_data).model_dump()}


@router.get("/", response_model=dict, dependencies=[Depends(verify_api_key)])
async def list_customers(owner: OwnerAccess = Depends(require_owner)):
    salon_id = owner["salon_id"]

    try:
        customer_docs = db.collection("customers").where("salon_id", "==", salon_id).stream()
        customers = [
            _customer_response(customer_doc.id, customer_doc.to_dict() or {}).model_dump()
            for customer_doc in customer_docs
        ]
    except Exception as exc:  # pragma: no cover - Firestore failure
        raise HTTPException(status_code=500, detail="Unable to load customers.") from exc

    customers.sort(
        key=lambda customer: (
            customer.get("created_at") or "",
            customer.get("updated_at") or "",
        ),
        reverse=True,
    )
    return {"count": len(customers), "customers": customers}

@router.get("/ping")
async def ping_customers():
    doc_ref = db.collection("test").document("ping")
    doc_ref.set({"ok": True})

    doc_snapshot = doc_ref.get()
    firestore_data = doc_snapshot.to_dict() if doc_snapshot.exists else None

    return {
        "message": "customers ok",
        "firestore": firestore_data,
    }