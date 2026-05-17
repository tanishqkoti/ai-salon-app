from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_analytics():
    return {"message": "analytics ok"}