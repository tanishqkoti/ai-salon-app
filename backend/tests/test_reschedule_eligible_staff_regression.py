"""Regression tests for the reschedule eligible-staff query mismatch.

Root cause: POST /staff/ persisted the raw, unvalidated free-text `services`
input directly into the `service_ids` field instead of resolving it against
canonical service documents. GET /staff/ (and the booking reschedule flow)
filter staff by comparing a canonical service document ID against
`service_ids`, so any staff member created with a non-canonical value in
`service_ids` was silently excluded from eligible-staff results.

These tests use fixtures only. No live Firestore project is read or written.
"""

from __future__ import annotations

import sys
import types

import pytest
from fastapi import HTTPException

CANONICAL_SERVICE_ID = "svc-womens-haircut-canonical"
SALON_ID = "aura-studio"


class FakeSnapshot:
    def __init__(self, document_id: str, data: dict | None):
        self.id = document_id
        self.data = data
        self.exists = data is not None

    def to_dict(self):
        return self.data or {}


class FakeDocument:
    def __init__(self, collection, document_id: str):
        self.collection = collection
        self.id = document_id

    def set(self, data):
        saved = data.copy()
        for key in ("created_at", "updated_at"):
            if key in saved:
                saved[key] = "2026-09-07T00:00:00"
        self.collection.records[self.id] = saved

    def get(self):
        return FakeSnapshot(self.id, self.collection.records.get(self.id))

    def update(self, data):
        self.collection.records[self.id].update(data)


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


class FakeCollection:
    def __init__(self, records=None):
        self.records = records or {}

    def document(self, document_id=None):
        document_id = document_id or f"doc-{len(self.records) + 1}"
        return FakeDocument(self, document_id)

    def where(self, field: str, operator: str, value):
        assert operator == "=="
        return FakeQuery(self.records, field, value)


class FakeDB:
    def __init__(self):
        self.collections = {
            "staff": FakeCollection(),
            "services": FakeCollection(),
            "bookings": FakeCollection(),
        }

    def collection(self, name: str):
        return self.collections[name]


def load_staff_route(monkeypatch, fake_db):
    fake_config = types.ModuleType("firebase_config")
    fake_config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_config)

    from routes import staff

    staff.db = fake_db
    return staff


def load_bookings_route(monkeypatch, fake_db):
    fake_config = types.ModuleType("firebase_config")
    fake_config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_config)

    from routes import bookings

    bookings.db = fake_db
    return bookings


def owner():
    return {"uid": "owner-1", "salon_id": SALON_ID, "role": "owner"}


def seed_fixture(fake_db):
    """Canonical Women's Haircut service, Rahul (current staff), Ananya (eligible), booking abcd."""
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("staff").records["staff-rahul"] = {
        "salon_id": SALON_ID,
        "name": "Rahul",
        "role": "Men's Grooming Expert",
        "speciality": "Grooming",
        "phone": "1",
        "rating": 0,
        "status": "Available",
        "today_hours": "10-6",
        "weekly_hours": "Mon-Sat",
        "services": ["Women's Haircut"],
        "service_ids": [CANONICAL_SERVICE_ID],
        "color": "blue",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID,
        "name": "Ananya",
        "role": "Senior Hair Stylist",
        "speciality": "Haircuts",
        "phone": "2",
        "rating": 0,
        "status": "Available",
        "today_hours": "10-6",
        "weekly_hours": "Mon-Sat",
        "services": ["Women's Haircut"],
        "service_ids": [CANONICAL_SERVICE_ID],
        "color": "pink",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
    }
    fake_db.collection("bookings").records["abcd"] = {
        "salon_id": SALON_ID,
        "customer_name": "Customer",
        "customer_email": "customer@example.com",
        "service_id": CANONICAL_SERVICE_ID,
        "service_name": "Women's Haircut",
        "stylist_id": "staff-rahul",
        "stylist_name": "Rahul",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:30 AM",
        "duration_minutes": 60,
        "amount": 999,
        "status": "Pending",
        "version": 1,
    }


def test_reschedule_returns_ananya_for_bookings_canonical_service_excluding_rahuls_stable_id(monkeypatch):
    fake_db = FakeDB()
    seed_fixture(fake_db)
    staff = load_staff_route(monkeypatch, fake_db)
    booking = fake_db.collection("bookings").records["abcd"]

    result = __import__("asyncio").run(
        staff.list_staff(
            owner(),
            active_only=True,
            service_id=booking["service_id"],
            exclude_staff_id=booking["stylist_id"],
        )
    )

    assert result["count"] == 1
    assert [member["id"] for member in result["staff"]] == ["staff-ananya"]


def test_wrong_service_id_returns_no_candidates(monkeypatch):
    fake_db = FakeDB()
    seed_fixture(fake_db)
    staff = load_staff_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        staff.list_staff(owner(), active_only=True, service_id="wrong-service-id", exclude_staff_id="staff-rahul")
    )

    assert result == {"count": 0, "staff": []}


def test_inactive_staff_is_excluded_even_with_matching_service(monkeypatch):
    fake_db = FakeDB()
    seed_fixture(fake_db)
    fake_db.collection("staff").records["staff-ananya"]["is_active"] = False
    staff = load_staff_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        staff.list_staff(owner(), active_only=True, service_id=CANONICAL_SERVICE_ID, exclude_staff_id="staff-rahul")
    )

    assert result == {"count": 0, "staff": []}


def test_wrong_exclusion_id_does_not_remove_the_current_stylist(monkeypatch):
    fake_db = FakeDB()
    seed_fixture(fake_db)
    staff = load_staff_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        staff.list_staff(owner(), active_only=True, service_id=CANONICAL_SERVICE_ID, exclude_staff_id="staff-ananya")
    )

    # Excluding the wrong (non-current) staff id must not surface the current stylist
    # as a "candidate" to replace themselves, and must not incorrectly keep Ananya out.
    returned_ids = {member["id"] for member in result["staff"]}
    assert returned_ids == {"staff-rahul"}


def test_staff_creation_resolves_typed_service_name_to_canonical_id(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    staff = load_staff_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        staff.create_staff_member(
            staff.StaffCreateRequest(
                name="Ananya",
                role="Stylist",
                speciality="Hair",
                phone="333",
                services=["Women's Haircut"],
                today_hours="10-6",
                weekly_hours="Mon-Sat",
            ),
            owner(),
        )
    )

    saved = fake_db.collection("staff").records[result["id"]]
    assert saved["service_ids"] == [CANONICAL_SERVICE_ID]
    assert saved["services"] == ["Women's Haircut"]


def test_staff_creation_rejects_unresolvable_service_text(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    staff = load_staff_route(monkeypatch, fake_db)

    with pytest.raises(HTTPException) as error:
        __import__("asyncio").run(
            staff.create_staff_member(
                staff.StaffCreateRequest(
                    name="Ananya",
                    role="Stylist",
                    speciality="Hair",
                    phone="333",
                    services=["Not A Real Service"],
                    today_hours="10-6",
                    weekly_hours="Mon-Sat",
                ),
                owner(),
            )
        )
    assert error.value.status_code == 422


def test_live_shape_legacy_services_field_holding_canonical_id_is_still_eligible(monkeypatch):
    """Reproduces the exact live query/storage shape reported after the first fix.

    The staff doc has no populated `service_ids` array (as GET /staff strictly
    read), but its legacy `services` array holds the canonical service document
    ID directly (the shape the profile serializer already resolved via its
    fallback). Before this fix, list_staff ignored that fallback and returned
    zero eligible candidates for GET /api/salon/staff?service_id=...&exclude_staff_id=rahul.
    """
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("staff").records["rahul"] = {
        "salon_id": SALON_ID,
        "name": "Rahul",
        "role": "Men's Grooming Expert",
        "speciality": "Grooming",
        "phone": "1",
        "rating": 0,
        "status": "Available",
        "today_hours": "10-6",
        "weekly_hours": "Mon-Sat",
        "services": [CANONICAL_SERVICE_ID],
        "color": "blue",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID,
        "name": "Ananya",
        "role": "Senior Hair Stylist",
        "speciality": "Haircuts",
        "phone": "2",
        "rating": 0,
        "status": "Available",
        "today_hours": "10-6",
        "weekly_hours": "Mon-Sat",
        # Legacy write shape: no `service_ids`, canonical ID lives only in `services`.
        "services": [CANONICAL_SERVICE_ID],
        "color": "pink",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
    }
    staff = load_staff_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        staff.list_staff(
            owner(),
            active_only=True,
            service_id=CANONICAL_SERVICE_ID,
            exclude_staff_id="rahul",
        )
    )

    assert result["count"] == 1
    assert result["staff"][0]["id"] == "staff-ananya"


def test_customer_eligible_stylists_returns_ananya_for_legacy_services_field(monkeypatch):
    """Customer 'Choose your stylist' lookup must match the owner reschedule lookup exactly."""
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID,
        "name": "Ananya",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
        # Legacy write shape: no `service_ids`, canonical ID lives only in `services`.
        "services": [CANONICAL_SERVICE_ID],
    }
    bookings = load_bookings_route(monkeypatch, fake_db)

    eligible = bookings._eligible_staff_for_service(SALON_ID, CANONICAL_SERVICE_ID)

    assert eligible == [{"id": "staff-ananya", "name": "Ananya"}]


def test_customer_eligible_stylists_endpoint_returns_ananya_via_public_route(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("staff").records["staff-ananya"] = {
        "salon_id": SALON_ID,
        "name": "Ananya",
        "is_active": True,
        "bookable": True,
        "archived_at": None,
        "services": [CANONICAL_SERVICE_ID],
    }
    bookings = load_bookings_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        bookings.eligible_stylists(salon_id=SALON_ID, service_id=CANONICAL_SERVICE_ID)
    )

    assert result == {"service_id": CANONICAL_SERVICE_ID, "stylists": [{"id": "staff-ananya", "name": "Ananya"}]}


def test_customer_eligible_stylists_genuine_empty_when_no_staff_match(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    bookings = load_bookings_route(monkeypatch, fake_db)

    result = __import__("asyncio").run(
        bookings.eligible_stylists(salon_id=SALON_ID, service_id=CANONICAL_SERVICE_ID)
    )

    assert result == {"service_id": CANONICAL_SERVICE_ID, "stylists": []}


def test_customer_eligible_stylists_excludes_inactive_unbookable_cross_salon_and_wrong_service(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("services").records[CANONICAL_SERVICE_ID] = {
        "salon_id": SALON_ID,
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("services").records["other-service"] = {
        "salon_id": SALON_ID,
        "name": "Beard Grooming",
        "is_active": True,
        "staff": [],
    }
    fake_db.collection("staff").records = {
        "staff-ananya": {
            "salon_id": SALON_ID, "name": "Ananya", "is_active": True, "bookable": True,
            "archived_at": None, "services": [CANONICAL_SERVICE_ID],
        },
        "staff-inactive": {
            "salon_id": SALON_ID, "name": "Inactive", "is_active": False, "bookable": True,
            "archived_at": None, "services": [CANONICAL_SERVICE_ID],
        },
        "staff-unbookable": {
            "salon_id": SALON_ID, "name": "Unbookable", "is_active": True, "bookable": False,
            "archived_at": None, "services": [CANONICAL_SERVICE_ID],
        },
        "staff-other-salon": {
            "salon_id": "other-salon", "name": "OtherSalon", "is_active": True, "bookable": True,
            "archived_at": None, "services": [CANONICAL_SERVICE_ID],
        },
        "staff-wrong-service": {
            "salon_id": SALON_ID, "name": "WrongService", "is_active": True, "bookable": True,
            "archived_at": None, "services": ["other-service"],
        },
    }
    bookings = load_bookings_route(monkeypatch, fake_db)

    eligible = bookings._eligible_staff_for_service(SALON_ID, CANONICAL_SERVICE_ID)

    assert eligible == [{"id": "staff-ananya", "name": "Ananya"}]
