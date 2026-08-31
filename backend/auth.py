import os
from typing import Annotated

from fastapi import Header, HTTPException

BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")


def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    if not BACKEND_API_KEY or not BACKEND_API_KEY.strip():
        raise HTTPException(status_code=503, detail="API key is not configured on the server.")

    if x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")

    return x_api_key
