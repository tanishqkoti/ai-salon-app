from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_tryon():
    return {"message": "tryon ok"}