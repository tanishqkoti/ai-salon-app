from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_bookings():
    return {"message": "bookings ok"}