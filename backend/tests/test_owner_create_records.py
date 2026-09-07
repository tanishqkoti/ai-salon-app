from __future__ import annotations

import sys
import types

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import auth


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
                saved[key] = "2026-09-03T00:00:00"
        self.collection.records[self.id] = saved

    def get(self):
        return FakeSnapshot(self.id, self.collection.records.get(self.id))

    def update(self, data):
        self.collection.records[self.id].update(data)

    def update(self, data):
        self.collection.records[self.id].update(data)
        for key in ("archived_at", "updated_at"):
            if key in data:
                self.collection.records[self.id][key] = "2026-09-03T00:00:00"


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
            "customers": FakeCollection(),
            "staff": FakeCollection(),
            "services": FakeCollection(),
            "bookings": FakeCollection(),
        }

    def collection(self, name: str):
        return self.collections[name]


def load_routes(monkeypatch, fake_db):
    fake_config = types.ModuleType("firebase_config")
    fake_config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", fake_config)

    from routes import customers, services, staff

    customers.db = fake_db
    services.db = fake_db
    staff.db = fake_db
    return customers, services, staff


def test_missing_api_key_is_401(monkeypatch):
    monkeypatch.setattr(auth, "BACKEND_API_KEY", "test-key")
    with pytest.raises(HTTPException) as error:
        auth.verify_api_key(None)
    assert error.value.status_code == 401


def test_missing_owner_token_is_401():
    with pytest.raises(HTTPException) as error:
        auth.require_owner(None)
    assert error.value.status_code == 401


def test_create_requests_reject_client_salon_scope(monkeypatch):
    customers, services, staff = load_routes(monkeypatch, FakeDB())

    with pytest.raises(ValidationError):
        customers.CustomerCreateRequest(
            name="A",
            email="a@example.com",
            phone="123",
            salon_id="other-salon",
        )
    with pytest.raises(ValidationError):
        services.ServiceCreateRequest(
            name="Cut",
            duration_minutes=0,
            price=100,
        )
    with pytest.raises(ValidationError):
        staff.StaffCreateRequest(
            name="A",
            role="Stylist",
            speciality="Hair",
            phone="123",
            today_hours="10-6",
        )


def test_customer_creation_is_scoped_to_owner_and_returns_201(monkeypatch):
    fake_db = FakeDB()
    customers, _, _ = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = __import__("asyncio").run(
        customers.create_customer(
            customers.CustomerCreateRequest(
                name="Alice Tester",
                email="ALICE@example.com",
                phone="12345",
            ),
            owner,
        )
    )

    assert result["customer"]["salon_id"] == "aura-studio"
    assert fake_db.collection("customers").records[result["id"]]["salon_id"] == "aura-studio"
    assert next(route for route in customers.router.routes if route.path == "/").status_code == 201


def test_customer_post_then_get_returns_the_created_customer(monkeypatch):
    fake_db = FakeDB()
    customers, _, _ = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    payload = customers.CustomerCreateRequest(
        name="Known Customer",
        email="known@example.com",
        phone="12345",
    )

    __import__("asyncio").run(customers.create_customer(payload, owner))
    result = __import__("asyncio").run(customers.list_customers(owner))

    assert result["count"] == 1
    assert result["customers"][0]["name"] == "Known Customer"
    assert result["customers"][0]["salon_id"] == "aura-studio"


def test_customer_duplicate_check_and_get_use_owner_salon_scope(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("customers").records["other-customer"] = {
        "salon_id": "other-salon",
        "name": "Other Customer",
        "email": "known@example.com",
        "phone": "12345",
        "visits": 0,
        "total_spent": 0,
        "loyalty_points": 0,
        "preferred_stylist": "",
        "last_visit": None,
        "status": "New",
        "service_history": [],
    }
    customers, _, _ = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = __import__("asyncio").run(customers.list_customers(owner))
    assert result == {"count": 0, "customers": []}

    created = __import__("asyncio").run(
        customers.create_customer(
            customers.CustomerCreateRequest(name="Local Customer", email="known@example.com", phone="12345"),
            owner,
        )
    )
    assert created["customer"]["salon_id"] == "aura-studio"
    assert created["customer"]["email"] == "known@example.com"


def test_duplicate_staff_and_service_are_rejected_per_salon(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("staff").records["staff-1"] = {"salon_id": "aura-studio", "phone": "12345"}
    fake_db.collection("services").records["service-1"] = {"salon_id": "aura-studio", "name": "Hair Spa"}
    _, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as staff_error:
        __import__("asyncio").run(
            staff.create_staff_member(
                staff.StaffCreateRequest(
                    name="Another Stylist", role="Stylist", speciality="Hair", phone="12345", today_hours="10-6", weekly_hours="Mon-Sat"
                ),
                owner,
            )
        )
    assert staff_error.value.status_code == 409

    with pytest.raises(HTTPException) as service_error:
        __import__("asyncio").run(
            services.create_service(
                services.ServiceCreateRequest(name=" hair spa ", duration_minutes=60, price=999),
                owner,
            )
        )
    assert service_error.value.status_code == 409


def test_staff_and_service_creation_return_201(monkeypatch):
    fake_db = FakeDB()
    _, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    staff_result = __import__("asyncio").run(
        staff.create_staff_member(
            staff.StaffCreateRequest(
                name="Ananya", role="Stylist", speciality="Hair", phone="54321", today_hours="10-6", weekly_hours="Mon-Sat"
            ),
            owner,
        )
    )
    service_result = __import__("asyncio").run(
        services.create_service(
            services.ServiceCreateRequest(name="Hair Spa", duration_minutes=60, price=999),
            owner,
        )
    )

    assert staff_result["staff"]["status"] == "Available"
    assert service_result["service"]["salon_id"] == "aura-studio"
    assert next(route for route in staff.router.routes if route.path == "/").status_code == 201
    assert next(route for route in services.router.routes if route.path == "/").status_code == 201


def test_staff_and_service_gets_return_saved_records_for_owner_salon(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("staff").records["staff-1"] = {
        "salon_id": "aura-studio", "name": "Saved Staff", "role": "Stylist",
        "speciality": "Hair", "phone": "54321", "rating": 0, "status": "Available",
        "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink",
    }
    fake_db.collection("staff").records["other-staff"] = fake_db.collection("staff").records["staff-1"] | {"salon_id": "other-salon"}
    fake_db.collection("services").records["service-1"] = {
        "salon_id": "aura-studio", "name": "Saved Service", "duration_minutes": 30,
        "price": 100, "status": "Active", "staff": [],
    }
    fake_db.collection("services").records["other-service"] = fake_db.collection("services").records["service-1"] | {"salon_id": "other-salon"}
    customers, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    staff_result = __import__("asyncio").run(staff.list_staff(owner))
    service_result = __import__("asyncio").run(services.list_services(owner))

    assert staff_result["count"] == 1
    assert staff_result["staff"][0]["name"] == "Saved Staff"
    assert service_result["count"] == 1
    assert service_result["services"][0]["name"] == "Saved Service"
    assert customers is not None


def test_archive_endpoints_reject_missing_cross_salon_and_protected_records(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("customers").records = {
        "customer-1": {"salon_id": "aura-studio", "name": "Customer", "email": "c@example.com", "phone": "1", "visits": 2, "total_spent": 100, "loyalty_points": 10, "preferred_stylist": "", "last_visit": None, "status": "New", "service_history": []},
        "customer-demo": {"salon_id": "aura-studio", "is_demo": True},
        "customer-other": {"salon_id": "other-salon"},
    }
    fake_db.collection("staff").records = {"staff-1": {"salon_id": "aura-studio"}, "staff-demo": {"salon_id": "aura-studio", "protected": True}, "staff-other": {"salon_id": "other-salon"}}
    fake_db.collection("services").records = {"service-1": {"salon_id": "aura-studio"}, "service-demo": {"salon_id": "aura-studio", "is_demo": True}, "service-other": {"salon_id": "other-salon"}}
    customers, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    cases = [
        (customers.archive_customer, "customer-other"),
        (customers.archive_customer, "missing"),
        (staff.deactivate_staff_member, "staff-other"),
        (staff.deactivate_staff_member, "missing"),
        (services.archive_service, "service-other"),
        (services.archive_service, "missing"),
    ]
    for endpoint, record_id in cases:
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(endpoint(record_id, owner))
        assert error.value.status_code == 404

    for endpoint, record_id in (
        (customers.archive_customer, "customer-demo"),
        (staff.deactivate_staff_member, "staff-demo"),
        (services.archive_service, "service-demo"),
    ):
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(endpoint(record_id, owner))
        assert error.value.status_code == 403


def test_successful_lifecycle_updates_preserve_booking_references(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("customers").records["customer-1"] = {"salon_id": "aura-studio", "name": "Customer", "email": "c@example.com", "phone": "1", "visits": 2, "total_spent": 100, "loyalty_points": 10, "preferred_stylist": "", "last_visit": None, "status": "New", "service_history": []}
    fake_db.collection("staff").records["staff-1"] = {"salon_id": "aura-studio", "name": "Staff", "role": "Stylist", "speciality": "Hair", "phone": "2", "rating": 0, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink"}
    fake_db.collection("services").records["service-1"] = {"salon_id": "aura-studio", "name": "Service", "duration_minutes": 30, "price": 100, "status": "Active", "staff": []}
    fake_db.collections["bookings"] = FakeCollection({"booking-1": {"salon_id": "aura-studio", "customer_name": "Customer", "service_id": "service-1", "service_name": "Service", "stylist_id": "staff-1", "stylist_name": "Staff"}})
    customers, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    customer_result = __import__("asyncio").run(customers.archive_customer("customer-1", owner))
    staff_result = __import__("asyncio").run(staff.deactivate_staff_member("staff-1", owner))
    service_result = __import__("asyncio").run(services.archive_service("service-1", owner))

    assert customer_result["customer"]["is_active"] is False
    assert staff_result["staff"]["is_active"] is False
    assert service_result["service"]["is_active"] is False
    booking = fake_db.collection("bookings").records["booking-1"]
    assert booking["service_id"] == "service-1"
    assert booking["stylist_id"] == "staff-1"


def test_lifecycle_operations_require_authentication(monkeypatch):
    monkeypatch.setattr(auth, "BACKEND_API_KEY", "test-key")
    with pytest.raises(HTTPException) as api_key_error:
        auth.verify_api_key(None)
    assert api_key_error.value.status_code == 401
    with pytest.raises(HTTPException) as owner_error:
        auth.require_owner("Bearer invalid")
    assert owner_error.value.status_code == 401


def test_lifecycle_operations_reject_missing_cross_salon_and_demo_records(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("customers").records = {
        "other": {"salon_id": "other-salon", "name": "Other", "email": "o@example.com", "phone": "1", "visits": 0, "total_spent": 0, "loyalty_points": 0, "preferred_stylist": "", "status": "New", "service_history": []},
        "demo": {"salon_id": "aura-studio", "is_demo": True, "name": "Demo", "email": "d@example.com", "phone": "2", "visits": 0, "total_spent": 0, "loyalty_points": 0, "preferred_stylist": "", "status": "New", "service_history": []},
    }
    customers, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    for operation, identifier in ((customers.archive_customer, "missing"), (customers.archive_customer, "other"), (customers.archive_customer, "demo")):
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(operation(identifier, owner))
        assert error.value.status_code in (403, 404)

    for operation, identifier in ((staff.deactivate_staff_member, "missing"), (services.archive_service, "missing")):
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(operation(identifier, owner))
        assert error.value.status_code == 404


def test_successful_lifecycle_updates_preserve_booking_snapshots(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("customers").records["customer-1"] = {
        "salon_id": "aura-studio", "name": "Customer", "email": "c@example.com", "phone": "1",
        "visits": 2, "total_spent": 100, "loyalty_points": 10, "preferred_stylist": "",
        "last_visit": None, "status": "New", "service_history": [],
    }
    fake_db.collection("staff").records["staff-1"] = {
        "salon_id": "aura-studio", "name": "Staff", "role": "Stylist", "speciality": "Hair", "phone": "2",
        "rating": 0, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink",
    }
    fake_db.collection("services").records["service-1"] = {
        "salon_id": "aura-studio", "name": "Service", "duration_minutes": 30, "price": 100, "status": "Active", "staff": [],
    }
    fake_db.collection("bookings").records["booking-1"] = {
        "salon_id": "aura-studio", "customer_name": "Customer", "service_id": "service-1", "service_name": "Service", "stylist_id": "staff-1", "stylist_name": "Staff",
    }
    customers, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    customer_result = __import__("asyncio").run(customers.archive_customer("customer-1", owner))
    staff_result = __import__("asyncio").run(staff.deactivate_staff_member("staff-1", owner))
    service_result = __import__("asyncio").run(services.archive_service("service-1", owner))

    assert customer_result["customer"]["is_active"] is False
    assert staff_result["staff"]["is_active"] is False
    assert service_result["service"]["is_active"] is False
    assert fake_db.collection("bookings").records["booking-1"]["service_id"] == "service-1"
    assert fake_db.collection("bookings").records["booking-1"]["stylist_id"] == "staff-1"


def test_active_only_lists_exclude_lifecycle_inactive_records(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("staff").records = {
        "active": {"salon_id": "aura-studio", "name": "Active", "role": "Stylist", "speciality": "Hair", "phone": "1", "rating": 0, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink", "is_active": True},
        "inactive": {"salon_id": "aura-studio", "name": "Inactive", "role": "Stylist", "speciality": "Hair", "phone": "2", "rating": 0, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink", "is_active": False},
    }
    fake_db.collection("services").records = {
        "active": {"salon_id": "aura-studio", "name": "Active", "duration_minutes": 30, "price": 100, "status": "Active", "staff": [], "is_active": True},
        "inactive": {"salon_id": "aura-studio", "name": "Inactive", "duration_minutes": 30, "price": 100, "status": "Active", "staff": [], "is_active": False},
    }
    _, services, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    assert __import__("asyncio").run(staff.list_staff(owner))["count"] == 1
    assert __import__("asyncio").run(services.list_services(owner))["count"] == 1


def test_staff_status_update_persists_and_preserves_other_fields(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("staff").records["staff-rahul"] = {
        "salon_id": "aura-studio", "name": "Rahul Patil", "role": "Men's Grooming Expert", "speciality": "Grooming",
        "phone": "1", "rating": 4.8, "status": "Busy", "today_hours": "10-7", "weekly_hours": "Tue-Sun",
        "services": ["Men's Haircut", "Beard Grooming", "Hair Styling"], "service_ids": ["svc-1", "svc-2", "svc-3"],
        "color": "blue", "is_active": True, "bookable": True, "archived_at": None,
    }
    _, _, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = __import__("asyncio").run(
        staff.update_staff_status("staff-rahul", staff.StaffStatusUpdateRequest(status="Available"), owner)
    )

    assert result["staff"]["status"] == "Available"
    saved = fake_db.collection("staff").records["staff-rahul"]
    assert saved["status"] == "Available"
    assert saved["name"] == "Rahul Patil"
    assert saved["service_ids"] == ["svc-1", "svc-2", "svc-3"]
    assert saved["services"] == ["Men's Haircut", "Beard Grooming", "Hair Styling"]
    assert saved["is_active"] is True
    assert saved["bookable"] is True


def test_staff_status_update_rejects_missing_cross_salon_and_demo_records(monkeypatch):
    fake_db = FakeDB()
    fake_db.collection("staff").records = {
        "other-salon": {"salon_id": "other-salon"},
        "demo": {"salon_id": "aura-studio", "is_demo": True},
        "protected": {"salon_id": "aura-studio", "protected": True},
    }
    _, _, staff = load_routes(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    for staff_id in ("missing", "other-salon"):
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(
                staff.update_staff_status(staff_id, staff.StaffStatusUpdateRequest(status="Available"), owner)
            )
        assert error.value.status_code == 404

    for staff_id in ("demo", "protected"):
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(
                staff.update_staff_status(staff_id, staff.StaffStatusUpdateRequest(status="Available"), owner)
            )
        assert error.value.status_code == 403


def test_staff_status_update_rejects_invalid_status_value():
    from routes import staff

    with pytest.raises(ValidationError):
        staff.StaffStatusUpdateRequest(status="Somewhere Else")
