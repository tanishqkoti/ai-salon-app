from __future__ import annotations

import asyncio
import os
import sys
import types
from datetime import date

import pytest
from pydantic import ValidationError

import auth

os.environ.setdefault("BACKEND_API_KEY", "test-api-key")
from fastapi import HTTPException

if "firebase_config" not in sys.modules:
    fake_firebase_config = types.ModuleType("firebase_config")
    sys.modules["firebase_config"] = fake_firebase_config


class FakeDoc:
    def __init__(self, doc_id: str, data: dict):
        self.id = doc_id
        self._data = data

    def to_dict(self):
        return self._data


class FakeCollection:
    def __init__(self, records=None):
        self.records = records or {}

    def where(self, field: str, op: str, value):
        return FakeQuery(self.records, [(field, op, value)])

    def document(self, doc_id=None):
        if doc_id is None:
            document_id = f"doc-{len(self.records) + 1}"
            return FakeDocumentRef(self, document_id)
        return FakeDocumentRef(self, doc_id)

    def stream(self):
        return [FakeDoc(doc_id, data) for doc_id, data in self.records.items()]


class FakeQuery:
    def __init__(self, records, filters=None):
        self.records = records
        self.filters = filters or []

    def where(self, field: str, op: str, value):
        self.filters.append((field, op, value))
        return self

    def stream(self):
        docs = []
        for doc_id, data in self.records.items():
            matches = True
            for field, op, value in self.filters:
                if op != "==":
                    raise NotImplementedError(f"Unsupported query op: {op}")
                if data.get(field) != value:
                    matches = False
                    break
            if matches:
                docs.append(FakeDoc(doc_id, data))
        return docs


class FakeTransaction:
    def __init__(self):
        self._writes = []
        self._read_only = False
        self._max_attempts = 3

    def get(self, query):
        return query.stream()

    def set(self, ref, data):
        self._writes.append((ref, data.copy()))
        ref.collection.records[ref.id] = data.copy()

    def update(self, ref, data):
        self._writes.append((ref, data.copy()))
        current = ref.collection.records.setdefault(ref.id, {})
        current.update(data)

    def _commit(self):
        return None

    def _rollback(self):
        return None


def fake_transactional(func):
    def wrapper(*args, **kwargs):
        transaction = FakeTransaction()
        return func(transaction, *args, **kwargs)

    return wrapper


class FakeDocumentRef:
    def __init__(self, collection: FakeCollection, doc_id: str):
        self.collection = collection
        self.id = doc_id

    def set(self, data):
        self.collection.records[self.id] = data.copy()

    def get(self):
        data = self.collection.records.get(self.id)
        if data is None:
            return FakeDoc(self.id, {})
        return FakeDoc(self.id, data)

    def update(self, data):
        current = self.collection.records.setdefault(self.id, {})
        current.update(data)


class FakeDB:
    def __init__(self):
        self.collections = {
            "bookings": FakeCollection(),
            "stylist_schedule": FakeCollection(),
        }

    def transaction(self):
        return FakeTransaction()

    def collection(self, name: str):
        return self.collections[name]


sys.modules["firebase_config"].db = FakeDB()

from routes import bookings
from stylist_schedule import is_slot_available

bookings.db = sys.modules["firebase_config"].db
bookings.firestore.transactional = fake_transactional


@pytest.fixture
def fake_db():
    return FakeDB()


def booking_payload(**overrides):
    payload = {
        "salon_id": "aura-studio",
        "customer_name": "Alice Tester",
        "customer_email": "alice@example.com",
        "service_id": "hair-spa",
        "service_name": "Hair Spa",
        "stylist_id": "ananya",
        "stylist_name": "Ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:30 AM",
        "duration_minutes": 60,
        "amount": 999,
    }
    payload.update(overrides)
    return bookings.BookingCreateRequest(**payload)


def test_no_conflict_should_succeed(fake_db):
    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:30 AM",
        60,
    ) is True


def test_exact_overlap_should_fail(fake_db):
    fake_db.collection("bookings").records["booking-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:30 AM",
        "duration_minutes": 60,
        "status": "Confirmed",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:30 AM",
        60,
    ) is False


def test_partial_overlap_should_fail(fake_db):
    fake_db.collection("bookings").records["booking-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:00 AM",
        "duration_minutes": 90,
        "status": "Confirmed",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:30 AM",
        60,
    ) is False


def test_back_to_back_within_buffer_should_fail(fake_db):
    fake_db.collection("bookings").records["booking-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:00 AM",
        "duration_minutes": 30,
        "status": "Confirmed",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:35 AM",
        30,
        buffer_minutes=10,
    ) is False


def test_back_to_back_outside_buffer_should_succeed(fake_db):
    fake_db.collection("bookings").records["booking-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:00 AM",
        "duration_minutes": 30,
        "status": "Confirmed",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:45 AM",
        30,
        buffer_minutes=10,
    ) is True


def test_booking_during_stylist_leave_should_fail(fake_db):
    fake_db.collection("stylist_schedule").records["leave-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "kind": "leave",
        "start_date": "2030-01-15",
        "end_date": "2030-01-15",
        "start_time": "10:00",
        "end_time": "12:00",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "10:30 AM",
        60,
    ) is False


def test_booking_during_recurring_break_should_fail(fake_db):
    fake_db.collection("stylist_schedule").records["break-1"] = {
        "salon_id": "aura-studio",
        "stylist_id": "ananya",
        "kind": "recurring_break",
        "day_of_week": 1,
        "start_time": "12:00",
        "end_time": "13:00",
    }

    assert is_slot_available(
        fake_db,
        "aura-studio",
        "ananya",
        "2030-01-15",
        "12:30 PM",
        30,
    ) is False


def test_cors_parsing_rejects_wildcard_default(monkeypatch):
    import importlib

    import main

    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    importlib.reload(main)
    assert main._parse_cors_origins() == []
    assert "*" not in main._parse_cors_origins()


def test_firebase_config_has_no_service_account_json_fallback():
    import importlib

    sys.modules.pop("firebase_config", None)
    import firebase_config

    importlib.reload(firebase_config)
    file_text = open("firebase_config.py", "r", encoding="utf-8").read()
    assert "serviceAccountKey.json" not in file_text
    assert 'os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")' not in file_text
    assert 'GOOGLE_APPLICATION_CREDENTIALS' in file_text


def test_create_booking_is_public_without_api_key(fake_db):
    original_db = bookings.db
    original_transaction = bookings._create_booking_transaction

    def fake_transactional_booking(transaction, payload):
        request_start = bookings.validate_appointment_datetime(
            payload.appointment_date,
            payload.appointment_time,
        )
        request_end = request_start + bookings.timedelta(minutes=payload.duration_minutes)
        padded_start = request_start - bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)
        padded_end = request_end + bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)

        for booking_doc in fake_db.collection("bookings").stream():
            booking_data = booking_doc.to_dict() or {}
            if booking_data.get("status") in bookings.CONFLICT_STATUSES:
                continue
            existing_start = bookings.parse_booking_datetime(
                booking_data.get("appointment_date", payload.appointment_date),
                booking_data.get("appointment_time", payload.appointment_time),
            )
            existing_end = existing_start + bookings.timedelta(
                minutes=int(booking_data.get("duration_minutes", 0) or 0)
            )
            if padded_start < existing_end and existing_start < padded_end:
                raise bookings.BookingUnavailableError(
                    "overlap",
                    bookings.format_time_range(existing_start, existing_end),
                )

        booking_ref = fake_db.collection("bookings").document()
        booking_data = {
            "salon_id": payload.salon_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email,
            "service_id": payload.service_id,
            "service_name": payload.service_name,
            "stylist_id": payload.stylist_id,
            "stylist_name": payload.stylist_name,
            "appointment_date": payload.appointment_date,
            "appointment_time": payload.appointment_time,
            "duration_minutes": payload.duration_minutes,
            "amount": payload.amount,
            "status": "Pending",
        }
        booking_ref.set(booking_data)
        return booking_ref.id

    bookings.db = fake_db
    bookings._create_booking_transaction = fake_transactional_booking
    try:
        result = asyncio.run(bookings.create_booking(booking_payload()))
        assert result["id"]
        assert result["booking"]["status"] == "Pending"
    finally:
        bookings.db = original_db
        bookings._create_booking_transaction = original_transaction


def test_create_booking_accepts_optional_phone_and_notes(fake_db):
    original_db = bookings.db
    original_transaction = bookings._create_booking_transaction

    def fake_transactional_booking(transaction, payload):
        request_start = bookings.validate_appointment_datetime(
            payload.appointment_date,
            payload.appointment_time,
        )
        request_end = request_start + bookings.timedelta(minutes=payload.duration_minutes)
        padded_start = request_start - bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)
        padded_end = request_end + bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)

        for booking_doc in fake_db.collection("bookings").stream():
            booking_data = booking_doc.to_dict() or {}
            if booking_data.get("status") in bookings.CONFLICT_STATUSES:
                continue
            existing_start = bookings.parse_booking_datetime(
                booking_data.get("appointment_date", payload.appointment_date),
                booking_data.get("appointment_time", payload.appointment_time),
            )
            existing_end = existing_start + bookings.timedelta(
                minutes=int(booking_data.get("duration_minutes", 0) or 0)
            )
            if padded_start < existing_end and existing_start < padded_end:
                raise bookings.BookingUnavailableError(
                    "overlap",
                    bookings.format_time_range(existing_start, existing_end),
                )

        booking_ref = fake_db.collection("bookings").document()
        booking_data = {
            "salon_id": payload.salon_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email,
            "customer_phone": payload.customer_phone,
            "notes": payload.notes,
            "service_id": payload.service_id,
            "service_name": payload.service_name,
            "stylist_id": payload.stylist_id,
            "stylist_name": payload.stylist_name,
            "appointment_date": payload.appointment_date,
            "appointment_time": payload.appointment_time,
            "duration_minutes": payload.duration_minutes,
            "amount": payload.amount,
            "status": "Pending",
        }
        booking_ref.set(booking_data)
        return booking_ref.id

    bookings.db = fake_db
    bookings._create_booking_transaction = fake_transactional_booking
    try:
        payload = booking_payload(
            customer_phone="+91 98765 43210",
            notes="Prefers morning slot and sensitive scalp.",
        )
        result = asyncio.run(bookings.create_booking(payload))
        assert result["booking"]["customer_phone"] == "+91 98765 43210"
        assert result["booking"]["notes"] == "Prefers morning slot and sensitive scalp."
    finally:
        bookings.db = original_db
        bookings._create_booking_transaction = original_transaction


def test_create_booking_accepts_legacy_payload_without_optional_fields(fake_db):
    original_db = bookings.db
    original_transaction = bookings._create_booking_transaction

    def fake_transactional_booking(transaction, payload):
        request_start = bookings.validate_appointment_datetime(
            payload.appointment_date,
            payload.appointment_time,
        )
        request_end = request_start + bookings.timedelta(minutes=payload.duration_minutes)
        padded_start = request_start - bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)
        padded_end = request_end + bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)

        for booking_doc in fake_db.collection("bookings").stream():
            booking_data = booking_doc.to_dict() or {}
            if booking_data.get("status") in bookings.CONFLICT_STATUSES:
                continue
            existing_start = bookings.parse_booking_datetime(
                booking_data.get("appointment_date", payload.appointment_date),
                booking_data.get("appointment_time", payload.appointment_time),
            )
            existing_end = existing_start + bookings.timedelta(
                minutes=int(booking_data.get("duration_minutes", 0) or 0)
            )
            if padded_start < existing_end and existing_start < padded_end:
                raise bookings.BookingUnavailableError(
                    "overlap",
                    bookings.format_time_range(existing_start, existing_end),
                )

        booking_ref = fake_db.collection("bookings").document()
        booking_data = {
            "salon_id": payload.salon_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email,
            "customer_phone": payload.customer_phone,
            "notes": payload.notes,
            "service_id": payload.service_id,
            "service_name": payload.service_name,
            "stylist_id": payload.stylist_id,
            "stylist_name": payload.stylist_name,
            "appointment_date": payload.appointment_date,
            "appointment_time": payload.appointment_time,
            "duration_minutes": payload.duration_minutes,
            "amount": payload.amount,
            "status": "Pending",
        }
        booking_ref.set(booking_data)
        return booking_ref.id

    bookings.db = fake_db
    bookings._create_booking_transaction = fake_transactional_booking
    try:
        payload = booking_payload()
        result = asyncio.run(bookings.create_booking(payload))
        assert result["booking"]["customer_phone"] is None
        assert result["booking"]["notes"] is None
    finally:
        bookings.db = original_db
        bookings._create_booking_transaction = original_transaction


def test_create_booking_rejects_unrelated_extra_fields():
    with pytest.raises(ValidationError):
        bookings.BookingCreateRequest(
            salon_id="aura-studio",
            customer_name="Alice Tester",
            customer_email="alice@example.com",
            service_id="hair-spa",
            service_name="Hair Spa",
            stylist_id="ananya",
            stylist_name="Ananya",
            appointment_date="2030-01-15",
            appointment_time="10:30 AM",
            duration_minutes=60,
            amount=999,
            unexpected_field="nope",
        )


def test_salon_availability_returns_time_slots_with_eligible_stylists(fake_db):
    original_db = bookings.db
    bookings.db = fake_db
    try:
        fake_db.collection("stylist_schedule").records["schedule-1"] = {
            "salon_id": "aura-studio",
            "stylist_id": "ananya",
            "kind": "placeholder",
        }
        fake_db.collection("stylist_schedule").records["schedule-2"] = {
            "salon_id": "aura-studio",
            "stylist_id": "rahul",
            "kind": "placeholder",
        }

        result = asyncio.run(
            bookings.salon_availability(
                salon_id="aura-studio",
                date="2030-01-15",
                duration_minutes=60,
            )
        )
        assert result["salon_id"] == "aura-studio"
        assert result["date"] == "2030-01-15"
        assert any(slot["time"] == "10:00 AM" for slot in result["available_slots"])
        assert any(
            {stylist["id"] for stylist in slot["stylists"]} == {"ananya", "rahul"}
            for slot in result["available_slots"]
        )
    finally:
        bookings.db = original_db


def test_salon_availability_respects_existing_booking_conflicts(fake_db):
    original_db = bookings.db
    bookings.db = fake_db
    try:
        fake_db.collection("stylist_schedule").records["schedule-1"] = {
            "salon_id": "aura-studio",
            "stylist_id": "ananya",
            "kind": "placeholder",
        }
        fake_db.collection("bookings").records["booking-1"] = {
            "salon_id": "aura-studio",
            "stylist_id": "ananya",
            "appointment_date": "2030-01-15",
            "appointment_time": "10:00 AM",
            "duration_minutes": 60,
            "status": "Confirmed",
        }

        result = asyncio.run(
            bookings.salon_availability(
                salon_id="aura-studio",
                date="2030-01-15",
                duration_minutes=60,
            )
        )
        assert not any(slot["time"] == "10:00 AM" for slot in result["available_slots"])
    finally:
        bookings.db = original_db


def test_create_booking_returns_structured_conflict_detail(fake_db):
    original_db = bookings.db
    original_transaction = bookings._create_booking_transaction

    def fake_transactional_booking(transaction, payload):
        request_start = bookings.validate_appointment_datetime(
            payload.appointment_date,
            payload.appointment_time,
        )
        request_end = request_start + bookings.timedelta(minutes=payload.duration_minutes)
        padded_start = request_start - bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)
        padded_end = request_end + bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)

        for booking_doc in fake_db.collection("bookings").stream():
            booking_data = booking_doc.to_dict() or {}
            if booking_data.get("status") in bookings.CONFLICT_STATUSES:
                continue
            existing_start = bookings.parse_booking_datetime(
                booking_data.get("appointment_date", payload.appointment_date),
                booking_data.get("appointment_time", payload.appointment_time),
            )
            existing_end = existing_start + bookings.timedelta(
                minutes=int(booking_data.get("duration_minutes", 0) or 0)
            )
            if padded_start < existing_end and existing_start < padded_end:
                raise bookings.BookingUnavailableError(
                    "overlap",
                    bookings.format_time_range(existing_start, existing_end),
                )

        raise AssertionError("should have raised conflict before creating the booking")

    bookings.db = fake_db
    bookings._create_booking_transaction = fake_transactional_booking
    try:
        fake_db.collection("bookings").records["booking-1"] = {
            "salon_id": "aura-studio",
            "customer_name": "Existing Customer",
            "customer_email": "existing@example.com",
            "service_id": "hair-spa",
            "service_name": "Hair Spa",
            "stylist_id": "ananya",
            "stylist_name": "Ananya",
            "appointment_date": "2030-01-15",
            "appointment_time": "10:30 AM",
            "duration_minutes": 60,
            "amount": 999,
            "status": "Confirmed",
        }

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                bookings.create_booking(
                    booking_payload(
                        appointment_date="2030-01-15",
                        appointment_time="10:30 AM",
                    )
                )
            )

        assert exc_info.value.status_code == 409
        detail = exc_info.value.detail
        assert detail["error"] == "slot_unavailable"
        assert detail["reason"] == "overlap"
        assert detail["stylist_id"] == "ananya"
        assert detail["appointment_date"] == "2030-01-15"
        assert detail["appointment_time"] == "10:30 AM"
        assert "message" in detail
        assert "available" in detail["message"].lower()
    finally:
        bookings.db = original_db
        bookings._create_booking_transaction = original_transaction


def test_unauthenticated_bookings_list_is_rejected(monkeypatch):
    monkeypatch.setenv("BACKEND_API_KEY", "test-api-key")
    import importlib
    import auth as auth_module
    importlib.reload(auth_module)
    with pytest.raises(HTTPException) as exc_info:
        auth_module.verify_api_key(None)
    assert exc_info.value.status_code == 401


def test_unauthenticated_status_update_is_rejected(monkeypatch):
    monkeypatch.setenv("BACKEND_API_KEY", "test-api-key")
    import importlib
    import auth as auth_module
    importlib.reload(auth_module)
    with pytest.raises(HTTPException) as exc_info:
        auth_module.verify_api_key(None)
    assert exc_info.value.status_code == 401


def test_past_appointment_input_is_rejected():
    with pytest.raises(ValidationError):
        booking_payload(
            appointment_date="2000-01-01",
            appointment_time="09:00 AM",
        )


def test_concurrent_double_booking_attempt_should_fail(fake_db):
    original_db = bookings.db
    original_transaction = bookings._create_booking_transaction

    def fake_transactional_booking(transaction, payload):
        request_start = bookings.validate_appointment_datetime(
            payload.appointment_date,
            payload.appointment_time,
        )
        request_end = request_start + bookings.timedelta(minutes=payload.duration_minutes)
        padded_start = request_start - bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)
        padded_end = request_end + bookings.timedelta(minutes=bookings.DEFAULT_BUFFER_MINUTES)

        for booking_doc in fake_db.collection("bookings").stream():
            booking_data = booking_doc.to_dict() or {}
            if booking_data.get("status") in bookings.CONFLICT_STATUSES:
                continue

            existing_start = bookings.parse_booking_datetime(
                booking_data.get("appointment_date", payload.appointment_date),
                booking_data.get("appointment_time", payload.appointment_time),
            )
            existing_duration = int(booking_data.get("duration_minutes", 0) or 0)
            existing_end = existing_start + bookings.timedelta(minutes=existing_duration)
            if padded_start < existing_end and existing_start < padded_end:
                raise bookings.BookingUnavailableError(
                    "overlap",
                    bookings.format_time_range(existing_start, existing_end),
                )

        for schedule_doc in fake_db.collection("stylist_schedule").stream():
            schedule_data = schedule_doc.to_dict() or {}
            if schedule_data.get("salon_id") and schedule_data.get("salon_id") != payload.salon_id:
                continue
            if schedule_data.get("stylist_id") and schedule_data.get("stylist_id") != payload.stylist_id:
                continue

            kind = schedule_data.get("kind")
            if kind == "recurring_break":
                if int(schedule_data.get("day_of_week", -1)) != request_start.weekday():
                    continue
                break_start = bookings.datetime.combine(
                    request_start.date(),
                    bookings.parse_time_value(schedule_data.get("start_time", "09:00")),
                )
                break_end = bookings.datetime.combine(
                    request_start.date(),
                    bookings.parse_time_value(schedule_data.get("end_time", "18:00")),
                )
                if request_start < break_end and break_start < request_end:
                    raise bookings.BookingUnavailableError(
                        "stylist break",
                        bookings.format_time_range(break_start, break_end),
                    )
            elif kind == "leave":
                leave_start_date = bookings.date.fromisoformat(schedule_data.get("start_date", payload.appointment_date))
                leave_end_date = bookings.date.fromisoformat(schedule_data.get("end_date", payload.appointment_date))
                if not (leave_start_date <= request_start.date() <= leave_end_date):
                    continue
                leave_start = bookings.datetime.combine(
                    request_start.date(),
                    bookings.parse_time_value(schedule_data.get("start_time", "09:00")),
                )
                leave_end = bookings.datetime.combine(
                    request_start.date(),
                    bookings.parse_time_value(schedule_data.get("end_time", "18:00")),
                )
                if request_start < leave_end and leave_start < request_end:
                    raise bookings.BookingUnavailableError(
                        "stylist leave",
                        bookings.format_time_range(leave_start, leave_end),
                    )

        booking_ref = fake_db.collection("bookings").document()
        booking_data = {
            "salon_id": payload.salon_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email,
            "service_id": payload.service_id,
            "service_name": payload.service_name,
            "stylist_id": payload.stylist_id,
            "stylist_name": payload.stylist_name,
            "appointment_date": payload.appointment_date,
            "appointment_time": payload.appointment_time,
            "duration_minutes": payload.duration_minutes,
            "amount": payload.amount,
            "status": "Pending",
        }
        booking_ref.set(booking_data)
        return booking_ref.id

    bookings.db = fake_db
    bookings._create_booking_transaction = fake_transactional_booking
    try:
        first = asyncio.run(bookings.create_booking(booking_payload()))
        assert first["id"]

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(bookings.create_booking(booking_payload()))

        assert exc_info.value.status_code == 409
    finally:
        bookings.db = original_db
        bookings._create_booking_transaction = original_transaction
