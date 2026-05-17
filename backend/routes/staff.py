from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_staff():
    return {"message": "staff ok"}