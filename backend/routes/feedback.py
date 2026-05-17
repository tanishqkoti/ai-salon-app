from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_feedback():
    return {"message": "feedback ok"}