from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
async def ping_loyalty():
    return {"message": "loyalty ok"}