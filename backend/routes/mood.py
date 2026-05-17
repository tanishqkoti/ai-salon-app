from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_mood():
    return {"message": "mood ok"}