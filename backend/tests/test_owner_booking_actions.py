from __future__ import annotations

import asyncio
import sys
import types

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import auth


class Snapshot:
    def __init__(self, document_id: str, data: dict | None):
        self.id = document_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data or {}


class Ref:
    def __init__(self, collection, document_id: str):
        self.collection = collection
        self.id = document_id

    def get(self):
        return Snapshot(self.id, self.collection.records.get(self.id))

    def update(self, data):
        self.collection.records[self.id].update(data)
        for key in ("updated_at", "cancelled_at", "rescheduled_at", "completed_at"):
            if key in data:
                self.collection.records[self.id][key] = "2030-01-01T00:00:00"


class Query:
    def __init__(self, records, filters=None):
        self.records = records
        self.filters = filters or []

    def where(self, field, operator, value):
        self.filters.append((field, operator, value))
        return self

    def stream(self):
        result = []
        for document_id, data in self.records.items():
            if all(operator == "==" and data.get(field) == value for field, operator, value in self.filters):
                result.append(Snapshot(document_id, data))
        return result


class Collection:
    def __init__(self, records=None):
        self.records = records or {}

    def document(self, document_id=None):
        return Ref(self, document_id or f"doc-{len(self.records) + 1}")

    def where(self, field, operator, value):
        return Query(self.records, [(field, operator, value)])


class Transaction:
    def get(self, target):
        if isinstance(target, Ref):
            if target.id not in target.collection.records:
                return iter(())
            return iter((target.get(),))
        return target.stream()

    def update(self, ref, data):
        ref.collection.records[ref.id].update(data)
        for key in ("updated_at", "cancelled_at", "rescheduled_at", "completed_at"):
            if key in data:
                ref.collection.records[ref.id][key] = "2030-01-01T00:00:00"


class DB:
    def __init__(self):
        self.collections = {
            "bookings": Collection(),
            "staff": Collection(),
            "services": Collection(),
            "stylist_schedule": Collection(),
        }

    def collection(self, name):
        return self.collections[name]

    def transaction(self):
        return Transaction()


def load_bookings(monkeypatch, fake_db):
    config = types.ModuleType("firebase_config")
    config.db = fake_db
    monkeypatch.setitem(sys.modules, "firebase_config", config)
    from routes import bookings
    bookings.db = fake_db
    return bookings


def staff_record():
    return {"salon_id": "aura-studio", "name": "Ananya", "is_active": True, "service_ids": ["service-1"]}


def service_record():
    return {"salon_id": "aura-studio", "name": "Hair Spa", "is_active": True, "staff": ["ananya", "Ananya"]}


def booking_record(status="Pending", salon_id="aura-studio"):
    return {
        "salon_id": salon_id,
        "customer_name": "Customer",
        "customer_email": "customer@example.com",
        "customer_phone": "555",
        "service_id": "service-1",
        "service_name": "Hair Spa",
        "stylist_id": "ananya",
        "stylist_name": "Ananya",
        "appointment_date": "2030-01-15",
        "appointment_time": "10:30 AM",
        "duration_minutes": 60,
        "amount": 999,
        "status": status,
        "version": 1,
    }


def invoke_transactional(function, *args):
    implementation = getattr(function, "to_wrap", function)
    return implementation(Transaction(), *args)


def test_action_models_require_reasons():
    from routes import bookings

    with pytest.raises(ValidationError):
        bookings.BookingCancelRequest(cancellation_reason="")
    with pytest.raises(ValidationError):
        bookings.BookingRescheduleRequest(appointment_date="2030-01-15", appointment_time="10:30 AM", reschedule_reason="")


def test_detail_is_owner_scoped(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["other-booking"] = booking_record(salon_id="other-salon")
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    with pytest.raises(HTTPException) as error:
        asyncio.run(bookings.get_booking_details("other-booking", owner))
    assert error.value.status_code == 404


def test_confirm_is_transactional_and_audited(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record()
    fake_db.collection("staff").records["ananya"] = staff_record()
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    ref = invoke_transactional(bookings._confirm_booking_transaction, "booking-1", owner)
    updated = ref.collection.records[ref.id]
    assert updated["status"] == "Confirmed"
    assert updated["updated_by"] == "owner-1"
    assert updated["version"] == 2


def test_confirm_rejects_cross_salon_and_inactive_entities(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["other"] = booking_record(salon_id="other-salon")
    fake_db.collection("bookings").records["inactive"] = booking_record()
    fake_db.collection("staff").records["ananya"] = staff_record() | {"is_active": False}
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as error:
        invoke_transactional(bookings._confirm_booking_transaction, "other", owner)
    assert error.value.status_code == 404
    with pytest.raises(bookings.BookingUnavailableError) as inactive_error:
        invoke_transactional(bookings._confirm_booking_transaction, "inactive", owner)
    assert "inactive staff" in str(inactive_error.value)


def test_confirm_missing_booking_returns_not_found_without_writing(monkeypatch):
    fake_db = DB()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as error:
        invoke_transactional(bookings._confirm_booking_transaction, "missing", owner)

    assert error.value.status_code == 404
    assert fake_db.collection("bookings").records == {}


def test_confirm_conflict_returns_409_without_partial_update(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record()
    fake_db.collection("bookings").records["existing"] = booking_record(status="Confirmed")
    fake_db.collection("staff").records["ananya"] = staff_record()
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    original_booking = fake_db.collection("bookings").records["booking-1"].copy()
    wrapped_confirm = bookings._confirm_booking_transaction
    monkeypatch.setattr(
        bookings,
        "_confirm_booking_transaction",
        lambda transaction, booking_id, current_owner: wrapped_confirm.to_wrap(
            transaction, booking_id, current_owner
        ),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(bookings.confirm_booking("booking-1", owner))

    assert error.value.status_code == 409
    assert fake_db.collection("bookings").records["booking-1"] == original_booking


def test_confirm_past_legacy_booking_returns_conflict_without_writing(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["legacy"] = booking_record()
    fake_db.collection("bookings").records["legacy"]["appointment_date"] = "2026-09-01"
    fake_db.collection("staff").records["ananya"] = staff_record()
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    wrapped_confirm = bookings._confirm_booking_transaction
    monkeypatch.setattr(
        bookings,
        "_confirm_booking_transaction",
        lambda transaction, booking_id, current_owner: wrapped_confirm.to_wrap(
            transaction, booking_id, current_owner
        ),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(bookings.confirm_booking("legacy", owner))

    assert error.value.status_code == 409
    assert fake_db.collection("bookings").records["legacy"]["status"] == "Pending"


def test_confirm_unexpected_error_returns_safe_500(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    original_booking = fake_db.collection("bookings").records["booking-1"].copy()

    def fail_transaction(*_args, **_kwargs):
        raise RuntimeError("internal test detail")

    monkeypatch.setattr(bookings, "_confirm_booking_transaction", fail_transaction)

    with pytest.raises(HTTPException) as error:
        asyncio.run(bookings.confirm_booking("booking-1", owner))

    assert error.value.status_code == 500
    assert error.value.detail == "Unable to confirm booking right now."
    assert fake_db.collection("bookings").records["booking-1"] == original_booking


def test_cancel_preserves_booking_and_writes_reason(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record(status="Confirmed")
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = asyncio.run(bookings.cancel_booking("booking-1", bookings.BookingCancelRequest(cancellation_reason="Customer request"), owner))
    record = fake_db.collection("bookings").records["booking-1"]
    assert result["booking"]["status"] == "Cancelled"
    assert record["cancellation_reason"] == "Customer request"
    assert record["customer_name"] == "Customer"


def test_cancel_requires_reason_and_returns_json_success_shape(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(ValidationError):
        bookings.BookingCancelRequest(cancellation_reason="")

    result = asyncio.run(
        bookings.cancel_booking(
            "booking-1",
            bookings.BookingCancelRequest(cancellation_reason="Owner request"),
            owner,
        )
    )
    assert set(result) == {"id", "booking"}
    assert result["booking"]["status"] == "Cancelled"
    assert result["booking"]["cancellation_reason"] == "Owner request"


def test_cancel_json_409_for_terminal_booking(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record(status="Completed")
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            bookings.cancel_booking(
                "booking-1",
                bookings.BookingCancelRequest(cancellation_reason="Owner request"),
                owner,
            )
        )
    assert error.value.status_code == 409
    assert isinstance(error.value.detail, str)


def test_reschedule_rejects_overlap_and_success_preserves_id_and_audit(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record(status="Confirmed")
    fake_db.collection("bookings").records["booking-2"] = booking_record(status="Confirmed") | {"appointment_time": "12:00 PM"}
    fake_db.collection("staff").records["ananya"] = staff_record()
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    overlap = bookings.BookingRescheduleRequest(staff_id="ananya", appointment_date="2030-01-15", appointment_time="12:00 PM", reschedule_reason="Customer request")

    with pytest.raises(bookings.BookingUnavailableError):
        invoke_transactional(bookings._reschedule_booking_transaction, "booking-1", overlap, owner)

    available = bookings.BookingRescheduleRequest(staff_id="ananya", appointment_date="2030-01-16", appointment_time="10:30 AM", reschedule_reason="Customer request")
    ref = invoke_transactional(bookings._reschedule_booking_transaction, "booking-1", available, owner)
    record = ref.collection.records[ref.id]
    assert ref.id == "booking-1"
    assert record["status"] == "Rescheduled"
    assert record["previous_start_at"].startswith("2030-01-15T10:30:00")
    assert record["reschedule_reason"] == "Customer request"


def test_reschedule_can_replace_inactive_stylist_and_preserves_staff_history(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record(status="Confirmed")
    fake_db.collection("staff").records["inactive"] = staff_record() | {"name": "Former Stylist", "is_active": False}
    fake_db.collection("staff").records["replacement"] = staff_record() | {"name": "Replacement Stylist"}
    fake_db.collection("services").records["service-1"] = service_record() | {"staff": ["replacement", "Replacement Stylist"]}
    fake_db.collection("bookings").records["booking-1"]["stylist_id"] = "inactive"
    fake_db.collection("bookings").records["booking-1"]["stylist_name"] = "Former Stylist"
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    payload = bookings.BookingRescheduleRequest(staff_id="replacement", appointment_date="2030-01-16", appointment_time="10:30 AM", reschedule_reason="Staff change")

    ref = invoke_transactional(bookings._reschedule_booking_transaction, "booking-1", payload, owner)
    record = ref.collection.records[ref.id]

    assert record["stylist_id"] == "replacement"
    assert record["stylist_name"] == "Replacement Stylist"
    assert record["previous_staff_id"] == "inactive"
    assert record["previous_staff_name"] == "Former Stylist"
    assert record["reschedule_reason"] == "Staff change"


@pytest.mark.parametrize("staff_id", ["other-staff", "inactive", "wrong-service", "protected"])
def test_reschedule_rejects_invalid_replacement_staff(monkeypatch, staff_id):
    fake_db = DB()
    fake_db.collection("bookings").records["booking-1"] = booking_record(status="Confirmed")
    fake_db.collection("staff").records["ananya"] = staff_record()
    fake_db.collection("staff").records["other-staff"] = staff_record() | {"salon_id": "other-salon"}
    fake_db.collection("staff").records["inactive"] = staff_record() | {"is_active": False}
    fake_db.collection("staff").records["wrong-service"] = staff_record() | {"name": "Other Stylist", "services": ["other-service"], "service_ids": []}
    fake_db.collection("staff").records["protected"] = staff_record() | {"protected": True}
    fake_db.collection("services").records["service-1"] = service_record()
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}
    payload = bookings.BookingRescheduleRequest(staff_id=staff_id, appointment_date="2030-01-16", appointment_time="10:30 AM", reschedule_reason="Staff change")

    with pytest.raises((HTTPException, bookings.BookingUnavailableError)):
        invoke_transactional(bookings._reschedule_booking_transaction, "booking-1", payload, owner)


def test_reschedule_requires_selected_staff():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        from routes import bookings
        bookings.BookingRescheduleRequest(appointment_date="2030-01-16", appointment_time="10:30 AM", reschedule_reason="Staff change")


def test_owner_staff_edit_assigns_stable_service_id_and_updates_service_membership(monkeypatch):
    fake_db = DB()
    fake_db.collection("staff").records["ananya"] = staff_record() | {
        "name": "Ananya",
        "role": "Stylist",
        "speciality": "Hair",
        "phone": "555",
        "rating": 4.9,
        "status": "Available",
        "today_hours": "10-6",
        "weekly_hours": "Mon-Sat",
        "services": [],
        "color": "pink",
    }
    fake_db.collection("services").records["women-haircut"] = {
        "salon_id": "aura-studio",
        "name": "Women's Haircut",
        "is_active": True,
        "staff": [],
    }
    from routes import staff
    staff.db = fake_db
    payload = staff.StaffUpdateRequest(
        name="Ananya",
        role="Stylist",
        speciality="Hair",
        phone="555",
        service_ids=["women-haircut"],
        today_hours="10-6",
        weekly_hours="Mon-Sat",
        is_active=True,
        status="Available",
    )
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    transaction_function = getattr(staff._update_staff_transaction, "to_wrap", None)
    if transaction_function is None:
        transaction_function = next(
            (
                closure.cell_contents
                for closure in (staff._update_staff_transaction.__closure__ or ())
                if callable(closure.cell_contents) and closure.cell_contents.__name__ == "_update_staff_transaction"
            ),
            None,
        )
    staff_ref = (
        transaction_function(Transaction(), "ananya", payload, owner)
        if transaction_function
        else staff._update_staff_transaction("ananya", payload, owner)
    )

    assert staff_ref.id == "ananya"
    assert fake_db.collection("staff").records["ananya"]["service_ids"] == ["women-haircut"]
    assert fake_db.collection("services").records["women-haircut"]["staff"] == ["ananya"]


def test_staff_profile_resolves_service_id_to_display_name(monkeypatch):
    fake_db = DB()
    fake_db.collection("staff").records["ananya"] = staff_record() | {"service_ids": ["women-haircut"], "services": ["women-haircut"], "role": "Stylist", "speciality": "Hair", "phone": "555", "rating": 4.9, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "color": "pink"}
    fake_db.collection("services").records["women-haircut"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": True}
    from routes import staff
    staff.db = fake_db

    response = staff._staff_response("ananya", fake_db.collection("staff").records["ananya"])

    assert response.service_ids == ["women-haircut"]
    assert response.services == ["Women's Haircut"]


def test_canonical_eligible_staff_excludes_current_and_wrong_service(monkeypatch):
    fake_db = DB()
    fake_db.collection("staff").records["rahul"] = staff_record() | {"name": "Rahul", "service_ids": ["service-1"]}
    fake_db.collection("staff").records["ananya"] = staff_record() | {"name": "Ananya", "service_ids": ["service-1"]}
    fake_db.collection("staff").records["priya"] = staff_record() | {"name": "Priya", "service_ids": ["other-service"]}
    from routes import bookings
    bookings.db = fake_db

    eligible = bookings._eligible_staff_for_service("aura-studio", "service-1", exclude_staff_id="rahul")

    assert eligible == [{"id": "ananya", "name": "Ananya"}]


def test_owner_staff_lookup_returns_only_ananya_for_abcd_replacement(monkeypatch):
    fake_db = DB()
    fake_db.collection("services").records["women-haircut"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": True}
    staff_defaults = {"role": "Stylist", "speciality": "Hair", "phone": "555", "rating": 4.9, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink"}
    fake_db.collection("staff").records = {
        "rahul": staff_record() | staff_defaults | {"name": "Rahul", "service_ids": ["women-haircut"]},
        "ananya": staff_record() | staff_defaults | {"name": "Ananya", "service_ids": ["women-haircut"]},
        "inactive": staff_record() | staff_defaults | {"service_ids": ["women-haircut"], "is_active": False},
        "unbookable": staff_record() | staff_defaults | {"service_ids": ["women-haircut"], "bookable": False},
        "archived": staff_record() | staff_defaults | {"service_ids": ["women-haircut"], "archived_at": "2030-01-01"},
        "other-service": staff_record() | staff_defaults | {"service_ids": ["other-service"]},
        "other-salon": staff_record() | staff_defaults | {"salon_id": "other-salon", "service_ids": ["women-haircut"]},
    }
    from routes import staff
    staff.db = fake_db
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = __import__("asyncio").run(
        staff.list_staff(owner, active_only=True, service_id="women-haircut", exclude_staff_id="rahul")
    )

    assert [member["id"] for member in result["staff"]] == ["ananya"]


def test_abcd_generated_service_id_returns_ananya_once_and_excludes_rahul(monkeypatch):
    fake_db = DB()
    generated_service_id = "AziGv6i0Vheq0QI6yMLc"
    fake_db.collection("services").records[generated_service_id] = {"salon_id": "aura-studio", "name": "womens haircut", "is_active": True}
    staff_defaults = {"salon_id": "aura-studio", "role": "Stylist", "speciality": "Hair", "phone": "555", "rating": 4.9, "status": "Available", "today_hours": "10-6", "weekly_hours": "Mon-Sat", "services": [], "color": "pink", "is_active": True, "bookable": True}
    fake_db.collection("staff").records = {
        "rahul": staff_defaults | {"name": "Rahul", "service_ids": [generated_service_id]},
        "ananya": staff_defaults | {"name": "Ananya", "service_ids": [generated_service_id]},
    }
    fake_db.collection("bookings").records["abcd"] = booking_record() | {"service_id": generated_service_id, "service_name": "Women’s Haircut", "stylist_id": "rahul", "stylist_name": "Rahul"}
    from routes import bookings, staff
    bookings.db = fake_db
    staff.db = fake_db
    normalized = bookings._booking_with_canonical_service_id(fake_db.collection("bookings").records["abcd"], "aura-studio")
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = __import__("asyncio").run(staff.list_staff(owner, active_only=True, service_id=normalized["service_id"], exclude_staff_id="rahul"))

    assert normalized["service_id"] == generated_service_id
    assert [member["id"] for member in result["staff"]] == ["ananya"]


def test_legacy_booking_service_name_ambiguity_is_actionable_without_writing(monkeypatch):
    fake_db = DB()
    fake_db.collection("services").records["service-1"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": True}
    fake_db.collection("services").records["service-2"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": False}
    from routes import bookings
    bookings.db = fake_db
    legacy_booking = {"salon_id": "aura-studio", "service_name": "Women's Haircut"}

    with pytest.raises(HTTPException, match="Multiple salon services"):
        bookings._booking_with_canonical_service_id(legacy_booking, "aura-studio")

    assert "service_id" not in legacy_booking


def test_legacy_booking_womens_haircut_resolves_generated_service_id_without_write(monkeypatch):
    fake_db = DB()
    fake_db.collection("services").records["AziGv6i0Vheq0QI6yMLc"] = {"salon_id": "aura-studio", "name": "Women’s Haircut", "is_active": True}
    from routes import bookings
    bookings.db = fake_db
    legacy_booking = {"salon_id": "aura-studio", "service_name": "Women's Haircut"}

    normalized = bookings._booking_with_canonical_service_id(legacy_booking, "aura-studio")

    assert normalized["service_id"] == "AziGv6i0Vheq0QI6yMLc"
    assert "service_id" not in legacy_booking


def test_owner_booking_list_keeps_unresolved_legacy_booking_and_valid_booking(monkeypatch):
    fake_db = DB()
    fake_db.collection("services").records["women-haircut"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": True}
    fake_db.collection("bookings").records["valid"] = booking_record() | {"service_id": "women-haircut", "service_name": "Women's Haircut", "amount": 499}
    fake_db.collection("bookings").records["legacy"] = booking_record() | {"service_id": None, "service_name": "Unknown service", "amount": 700, "status": "Completed"}
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = asyncio.run(bookings.list_bookings("aura-studio", owner))

    assert result["count"] == 2
    unresolved = next(item for item in result["bookings"] if item["id"] == "legacy")
    assert unresolved["needs_service_mapping"] is True
    assert unresolved["service_name"] == "Unknown service"
    assert unresolved["amount"] == 700


def test_owner_manual_service_mapping_writes_canonical_id_and_audit_fields(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["legacy"] = booking_record() | {"service_id": None, "service_name": "Women's Haircut", "amount": 700}
    fake_db.collection("services").records["generated-service"] = {"salon_id": "aura-studio", "name": "Women's Haircut", "is_active": True}
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    result = asyncio.run(bookings.map_booking_service("legacy", bookings.BookingServiceMappingRequest(service_id="generated-service"), owner))
    record = fake_db.collection("bookings").records["legacy"]

    assert result["booking"]["service_id"] == "generated-service"
    assert record["service_mapping_source"] == "owner_manual"
    assert record["service_mapped_by"] == "owner-1"
    assert record["previous_service_snapshot"]["service_name"] == "Women's Haircut"


def test_terminal_statuses_and_complete_transition(monkeypatch):
    fake_db = DB()
    fake_db.collection("bookings").records["completed"] = booking_record(status="Completed")
    fake_db.collection("bookings").records["confirmed"] = booking_record(status="Confirmed")
    bookings = load_bookings(monkeypatch, fake_db)
    owner = {"uid": "owner-1", "salon_id": "aura-studio", "role": "owner"}

    with pytest.raises(HTTPException) as terminal_error:
        asyncio.run(bookings.complete_booking("completed", owner))
    assert terminal_error.value.status_code == 409
    result = asyncio.run(bookings.complete_booking("confirmed", owner))
    assert result["booking"]["status"] == "Completed"
