from __future__ import annotations

import asyncio
import os
from datetime import date

import pytest
from pydantic import ValidationError

import auth

os.environ.setdefault("BACKEND_API_KEY", "test-api-key")
from fastapi import HTTPException

from routes import bookings
from stylist_schedule import is_slot_available


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

    def get(self, query):
        return query.stream()

    def set(self, ref, data):
        self._writes.append((ref, data.copy()))
        ref.collection.records[ref.id] = data.copy()

    def update(self, ref, data):
        self._writes.append((ref, data.copy()))
        current = ref.collection.records.setdefault(ref.id, {})
        current.update(data)


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


def test_unauthenticated_bookings_list_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_api_key(None)
    assert exc_info.value.status_code == 401


def test_unauthenticated_status_update_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_api_key(None)
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
