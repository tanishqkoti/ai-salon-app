import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import (
    bookings,
    staff,
    customers,
    loyalty,
    analytics,
    feedback,
    mood,
    tryon,
    reminders,
)

load_dotenv()


def _parse_cors_origins() -> list[str]:
    raw_value = os.getenv("CORS_ALLOWED_ORIGINS", "")
    origins = []
    for item in raw_value.split(","):
        cleaned = item.strip()
        if cleaned:
            origins.append(cleaned)
    return origins


app = FastAPI(title="AI Salon & Spa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
    allow_credentials=False,
)

app.include_router(bookings.router, prefix="/bookings")
app.include_router(staff.router, prefix="/staff")
app.include_router(customers.router, prefix="/customers")
app.include_router(loyalty.router, prefix="/loyalty")
app.include_router(analytics.router, prefix="/analytics")
app.include_router(feedback.router, prefix="/feedback")
app.include_router(mood.router, prefix="/mood")
app.include_router(tryon.router, prefix="/tryon")
app.include_router(reminders.router, prefix="/reminders")