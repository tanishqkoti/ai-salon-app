from fastapi import APIRouter, Depends

from auth import OwnerAccess, require_owner, verify_api_key

router = APIRouter()


@router.post("/session", dependencies=[Depends(verify_api_key)])
async def validate_owner_session(owner: OwnerAccess = Depends(require_owner)):
    return {"uid": owner["uid"], "salon_id": owner["salon_id"], "role": owner["role"]}