from fastapi import APIRouter

from firebase_config import db

router = APIRouter()

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