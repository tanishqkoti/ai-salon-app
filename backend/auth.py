import os
from typing import Annotated, TypedDict

from fastapi import Header, HTTPException
from firebase_admin import auth as firebase_auth

BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")


class OwnerAccess(TypedDict):
    uid: str
    salon_id: str
    role: str


def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    if not BACKEND_API_KEY or not BACKEND_API_KEY.strip():
        raise HTTPException(status_code=503, detail="API key is not configured on the server.")

    if x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")

    return x_api_key


def require_owner(
    authorization: Annotated[str | None, Header()] = None,
) -> OwnerAccess:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase ID token")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Firebase ID token")

    try:
        decoded_token = firebase_auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token") from exc

    uid = decoded_token.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")

    from firebase_config import db

    owner_data = db.collection("salon_owners").document(uid).get().to_dict() or {}
    salon_id = owner_data.get("salon_id")
    if (
        owner_data.get("role") != "owner"
        or owner_data.get("active") is not True
        or not isinstance(salon_id, str)
        or not salon_id.strip()
    ):
        raise HTTPException(status_code=403, detail="You are not authorized to manage salon bookings")

    return {"uid": uid, "salon_id": salon_id.strip(), "role": "owner"}
