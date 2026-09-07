"""Regression tests for the customer booking service-ID slug bug.

Root cause: the customer booking "Stylist" step sent the public display slug
(e.g. "womens-haircut") as `service_id` to `/bookings/eligible-stylists`,
but that endpoint (like the owner reschedule lookup) requires the canonical
Firestore service document ID (e.g. "AziGv6i0Vheq0QI6yMLc"). The frontend's
local service catalog only ever held display slugs, never canonical IDs.

Fix: the frontend now resolves the selected slug against a new, public,
salon-scoped, active-only service listing (`GET /services/public`) to obtain
the canonical ID before calling eligible-stylists / availability / booking
creation. These tests cover the new endpoint's fixture-only contract and
confirm the raw slug is rejected (never silently accepted) by the existing
canonical-ID-only endpoints.

These tests use fixtures only. No live Firestore project is read or written.
"""

from __future__ import annotations

import sys
import types

import pytest
from fastapi import HTTPException

CANONICAL_SERVICE_ID = "AziGv6i0Vheq0QI6yMLc"
SALON_ID = "aura-studio"
RAW_SLUG = "womens-haircut"


class FakeSnapshot:
    def __init__(self, document_id: str, data: dict | None):
        self.id = document_id
        self.data = data
        self.exists = data is not None

    def to_dict(self):
        return self.data or {}


class FakeQuery:
    def __init__(self, records, field: str, value):
        self.records = records
        self.field = field
        self.value = value

    def stream(self):
        return [
            FakeSnapshot(document_id, data)
            for document_id, data in self.records.items()
            if data.get(self.field) == self.value
        ]


class FakeDocument:
    def __init__(self, collection, document_id: str):
        self.collection = collection
        self.id = document_id

    def get(self):
        return FakeSnapshot(self.id, self.collection.records.get(self.id))


class FakeCollection:
    def __init__(self, records=None):
        self.records = records or {}

    def document(self, document_id=None):
        return FakeDocument(self, document_id)

    def where(self, field: str, operator: str, value):
        assert operator == "=="
        return FakeQuery(self.records, field, value)


class FakeDB:
    def __init__(self):
        self.collections = {"services": FakeCollection(), "staff": FakeCollection()}

    def collection(self, name: str):
        return self.collections[name]


def load_services_route(monkeypatch, fake_db):
    fake_config = types.ModuleType("firebase_config")
    fake_config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_config)

    from routes import services

    services.db = fake_db
    return services


def load_bookings_route(monkeypatch, fake_db):
    fake_config = types.ModuleType("firebase_config")
    fake_config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_config)

    from routes import bookings

    bookings.db = fake_db
    return bookings


def test_public_services_endpoint_returns_canonical_id_for_active_salon_services(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    services = load_services_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(services.list_public_services(salon_id=SALON_ID))

    assert result["count"] == 1
    assert result["services"][0]["id"] == CANONICAL_SERVICE_ID
    assert result["services"][0]["name"] == "Women's Haircut"


def test_public_services_endpoint_excludes_inactive_and_cross_salon_services(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    fake_db.collection("services").records["archived-service"] = {
        "salon_id": SALON_ID, "name": "Old Service", "duration_minutes": 30, "price": 199,
        "status": "Archived", "staff": [], "is_active": False,
    }
    fake_db.collection("services").records["other-salon-service"] = {
        "salon_id": "other-salon", "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    services = load_services_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(services.list_public_services(salon_id=SALON_ID))

    assert [service["id"] for service in result["services"]] == [CANONICAL_SERVICE_ID]


def test_public_services_endpoint_surfaces_ambiguous_duplicate_names(monkeypatch):
    """Two active same-named services at one salon means slug resolution must treat it as ambiguous."""
    fake_db = FakeDB()
    fake_db.collection("services").records["dup-1"] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    fake_db.collection("services").records["dup-2"] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "duration_minutes": 60, "price": 599,
        "status": "Active", "staff": [], "is_active": True,
    }
    services = load_services_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(services.list_public_services(salon_id=SALON_ID))

    assert len(result["services"]) == 2  # a frontend resolver must reject this as ambiguous, not guess


def test_eligible_stylists_rejects_raw_slug_never_accepts_it_as_service_id(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "is_active": True,
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID, "name": "Ananya", "is_active": True, "bookable": True,
        "archived_at": None, "services": [CANONICAL_SERVICE_ID],
    }
    bookings = load_bookings_route(monkeypatch, fake_db)

    with pytest.raises(HTTPException) as error:
        __import__("asyncio").run(bookings.eligible_stylists(salon_id=SALON_ID, service_id=RAW_SLUG))
    assert error.value.status_code == 422


def test_eligible_stylists_returns_ananya_when_called_with_resolved_canonical_id(monkeypatch):
    """Mirrors the frontend flow: slug resolved via /services/public, canonical ID sent to eligible-stylists."""
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID, "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID, "name": "Ananya", "is_active": True, "bookable": True,
        "archived_at": None,
        # Legacy write shape: canonical ID lives only in `services`, no `service_ids`.
        "services": [CANONICAL_SERVICE_ID],
    }
    services = load_services_route(monkeypatch, fake_db)
    bookings = load_bookings_route(monkeypatch, fake_db)

    public_services = __import__("asyncio").run(services.list_public_services(salon_id=SALON_ID))
    matches = [service for service in public_services["services"] if service["name"] == "Women's Haircut"]
    assert len(matches) == 1
    resolved_service_id = matches[0]["id"]
    assert resolved_service_id == CANONICAL_SERVICE_ID

    result = __import__("asyncio").run(
        bookings.eligible_stylists(salon_id=SALON_ID, service_id=resolved_service_id)
    )

    assert result == {"service_id": CANONICAL_SERVICE_ID, "stylists": [{"id": "staff-ananya", "name": "Ananya"}]}


def test_public_services_endpoint_scoped_salon_id_prevents_cross_salon_slug_resolution(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records["other-salon-service"] = {
        "salon_id": "other-salon", "name": "Women's Haircut", "duration_minutes": 45, "price": 499,
        "status": "Active", "staff": [], "is_active": True,
    }
    services = load_services_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(services.list_public_services(salon_id=SALON_ID))

    assert result == {"count": 0, "services": []}
