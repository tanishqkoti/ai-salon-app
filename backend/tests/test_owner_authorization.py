import asyncio
import sys
import types

import pytest
from fastapi import HTTPException

import auth
from routes import bookings


class FakeSnapshot:
    def __init__(self, data):
        self.data = data
        self.exists = data is not None

    def to_dict(self):
        return self.data or {}


class FakeDocument:
    def __init__(self, collection, document_id):
        self.collection = collection
        self.id = document_id

    def get(self):
        return FakeSnapshot(self.collection.records.get(self.id))

    def update(self, data):
        self.collection.records[self.id].update(data)


class FakeCollection:
    def __init__(self, records=None):
        self.records = records or {}

    def document(self, document_id):
        return FakeDocument(self, document_id)

    def where(self, field, operator, value):
        assert operator == "=="
        return FakeQuery(self.records, field, value)

    def stream(self):
        return [
            types.SimpleNamespace(id=document_id, to_dict=lambda data=data: data)
            for document_id, data in self.records.items()
        ]


class FakeQuery:
    def __init__(self, records, field, value):
        self.records = records
        self.field = field
        self.value = value

    def stream(self):
        return [
            types.SimpleNamespace(id=document_id, to_dict=lambda data=data: data)
            for document_id, data in self.records.items()
            if data.get(self.field) == self.value
        ]


class FakeDB:
    def __init__(self):
        self.collections = {
            "salon_owners": FakeCollection(),
            "bookings": FakeCollection(),
        }

    def collection(self, name):
        return self.collections[name]


def install_fake_db(monkeypatch, fake_db):
    fake_module = types.ModuleType("firebase_config")
    fake_module.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_module)
    bookings.db = fake_db


def test_no_token_returns_401():
    with pytest.raises(HTTPException) as error:
        auth.require_owner(None)
    assert error.value.status_code == 401


def test_invalid_token_returns_401(monkeypatch):
    def reject_token(_token):
        raise ValueError("invalid")

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", reject_token)
    with pytest.raises(HTTPException) as error:
        auth.require_owner("Bearer invalid-token")
    assert error.value.status_code == 401


def test_valid_token_without_active_owner_mapping_returns_403(monkeypatch):
    fake_db = FakeDB()
    install_fake_db(monkeypatch, fake_db)
    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", lambda _token: {"uid": "uid-1"})

    with pytest.raises(HTTPException) as error:
        auth.require_owner("Bearer valid-token")
    assert error.value.status_code == 403


def test_owner_can_only_list_mapped_salon_bookings(monkeypatch):
    fake_db = FakeDB()
    fake_db.collections["bookings"].records = {
        "booking-a": {"id": "booking-a", "salon_id": "aura-studio", "customer_name": "A", "customer_email": "a@example.com", "service_id": "s", "service_name": "Cut", "stylist_id": "st", "stylist_name": "Stylist", "appointment_date": "2030-01-15", "appointment_time": "10:30 AM", "duration_minutes": 30, "amount": 100, "status": "Pending"},
        "booking-b": {"id": "booking-b", "salon_id": "other-salon", "customer_name": "B", "customer_email": "b@example.com", "service_id": "s", "service_name": "Cut", "stylist_id": "st", "stylist_name": "Stylist", "appointment_date": "2030-01-15", "appointment_time": "11:30 AM", "duration_minutes": 30, "amount": 100, "status": "Pending"},
    }
    install_fake_db(monkeypatch, fake_db)
    owner = {"uid": "uid-1", "salon_id": "aura-studio", "role": "owner"}

    result = asyncio.run(bookings.list_bookings(salon_id="aura-studio", owner=owner))
    assert result["count"] == 1
    assert result["bookings"][0]["salon_id"] == "aura-studio"

    with pytest.raises(HTTPException) as error:
        asyncio.run(bookings.list_bookings(salon_id="other-salon", owner=owner))
    assert error.value.status_code == 403


def test_owner_cannot_update_cross_salon_booking(monkeypatch):
    fake_db = FakeDB()
    fake_db.collections["bookings"].records["booking-b"] = {
        "salon_id": "other-salon",
        "customer_name": "B",
        "customer_email": "b@example.com",
        "service_id": "s",
        "service_name": "Cut",
        "stylist_id": "st",
        "stylist_name": "Stylist",
        "appointment_date": "2030-01-15",
        "appointment_time": "11:30 AM",
        "duration_minutes": 30,
        "amount": 100,
        "status": "Pending",
    }
    install_fake_db(monkeypatch, fake_db)
    owner = {"uid": "uid-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            bookings.update_booking_status(
                booking_id="booking-b",
                payload=bookings.BookingStatusUpdateRequest(status="Confirmed"),
                owner=owner,
            )
        )
    assert error.value.status_code == 403
    assert fake_db.collections["bookings"].records["booking-b"]["status"] == "Pending"
