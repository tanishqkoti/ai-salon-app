"""Shared staff/service eligibility helpers used by the owner staff API and the public booking eligibility API."""


def normalize_service_id(value):
    """Accept plain string IDs and Firestore DocumentReference-like values alike."""
    if isinstance(value, str):
        candidate = value.strip()
        return candidate or None
    reference_id = getattr(value, "id", None)
    if isinstance(reference_id, str) and reference_id.strip():
        return reference_id.strip()
    return None


def staff_service_ids(data: dict) -> list[str]:
    values = data.get("service_ids") or []
    normalized = (normalize_service_id(value) for value in values)
    return list(dict.fromkeys(value for value in normalized if value))


def resolve_staff_canonical_service_ids(db, data: dict) -> list[str]:
    """Canonical service IDs for a staff doc, falling back to legacy `services` values."""
    service_ids = staff_service_ids(data)
    if not service_ids:
        for value in data.get("services", []) or []:
            candidate = normalize_service_id(value)
            if not candidate:
                continue
            service_snapshot = db.collection("services").document(candidate).get()
            service_data = service_snapshot.to_dict() or {}
            if service_snapshot.exists and service_data.get("salon_id") == data.get("salon_id"):
                service_ids.append(candidate)
    return service_ids
