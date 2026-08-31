from __future__ import annotations

from datetime import date, datetime, timedelta

DEFAULT_BUFFER_MINUTES = 10
BUSINESS_START_TIME = "09:00"
BUSINESS_END_TIME = "19:00"
DEFAULT_SLOT_MINUTES = 30


def parse_time_value(value: str):
    cleaned_value = (value or "").strip()
    if not cleaned_value:
        raise ValueError("Time value is required.")

    for time_format in ("%I:%M %p", "%H:%M", "%I:%M%p", "%H:%M:%S"):
        try:
            return datetime.strptime(cleaned_value, time_format).time()
        except ValueError:
            continue

    raise ValueError(f"Unsupported time format: {value}")


def parse_booking_datetime(date_text: str, time_text: str) -> datetime:
    parsed_date = date.fromisoformat(date_text)
    parsed_time = parse_time_value(time_text)
    return datetime.combine(parsed_date, parsed_time)


def validate_appointment_datetime(date_text: str, time_text: str) -> datetime:
    appointment_dt = parse_booking_datetime(date_text, time_text)
    if appointment_dt < datetime.now():
        raise ValueError("appointment_date and appointment_time must be in the future.")
    return appointment_dt


def interval_overlap(start_a, end_a, start_b, end_b) -> bool:
    return start_a < end_b and start_b < end_a


def format_time_range(start_dt: datetime, end_dt: datetime) -> str:
    return f"{start_dt.strftime('%Y-%m-%d %I:%M %p')} to {end_dt.strftime('%Y-%m-%d %I:%M %p')}"


def get_slot_conflict_details(
    db,
    salon_id: str,
    stylist_id: str,
    appointment_date: str,
    appointment_time: str,
    duration_minutes: int,
    buffer_minutes: int = DEFAULT_BUFFER_MINUTES,
    exclude_booking_id: str | None = None,
):
    start_dt = parse_booking_datetime(appointment_date, appointment_time)
    end_dt = start_dt + timedelta(minutes=duration_minutes)
    expanded_start = start_dt - timedelta(minutes=buffer_minutes)
    expanded_end = end_dt + timedelta(minutes=buffer_minutes)

    bookings_query = (
        db.collection("bookings")
        .where("stylist_id", "==", stylist_id)
        .where("appointment_date", "==", appointment_date)
    )
    booking_docs = list(bookings_query.stream())

    for booking_doc in booking_docs:
        booking_data = booking_doc.to_dict() or {}
        if booking_doc.id == exclude_booking_id:
            continue
        if booking_data.get("status") in {"Cancelled", "Rejected"}:
            continue
        if booking_data.get("salon_id") and booking_data.get("salon_id") != salon_id:
            continue

        existing_start = parse_booking_datetime(
            booking_data.get("appointment_date", appointment_date),
            booking_data.get("appointment_time", appointment_time),
        )
        existing_duration = int(booking_data.get("duration_minutes", 0) or 0)
        existing_end = existing_start + timedelta(minutes=existing_duration)

        if interval_overlap(expanded_start, expanded_end, existing_start, existing_end):
            return False, "overlap", format_time_range(existing_start, existing_end)

    schedule_docs = list(
        db.collection("stylist_schedule")
        .where("stylist_id", "==", stylist_id)
        .where("salon_id", "==", salon_id)
        .stream()
    )

    for schedule_doc in schedule_docs:
        schedule_data = schedule_doc.to_dict() or {}
        kind = schedule_data.get("kind")
        if kind == "recurring_break":
            day_of_week = int(schedule_data.get("day_of_week", -1))
            if day_of_week != start_dt.weekday():
                continue

            break_start = datetime.combine(
                start_dt.date(),
                parse_time_value(schedule_data.get("start_time", "09:00")),
            )
            break_end = datetime.combine(
                start_dt.date(),
                parse_time_value(schedule_data.get("end_time", "18:00")),
            )
            if interval_overlap(start_dt, end_dt, break_start, break_end):
                return False, "stylist break", format_time_range(break_start, break_end)

        elif kind == "leave":
            leave_start_date = date.fromisoformat(schedule_data.get("start_date", appointment_date))
            leave_end_date = date.fromisoformat(schedule_data.get("end_date", appointment_date))
            if not (leave_start_date <= start_dt.date() <= leave_end_date):
                continue

            leave_start_time = schedule_data.get("start_time")
            leave_end_time = schedule_data.get("end_time")
            if leave_start_time and leave_end_time:
                leave_start = datetime.combine(
                    start_dt.date(),
                    parse_time_value(leave_start_time),
                )
                leave_end = datetime.combine(
                    start_dt.date(),
                    parse_time_value(leave_end_time),
                )
                if interval_overlap(start_dt, end_dt, leave_start, leave_end):
                    return False, "stylist leave", format_time_range(leave_start, leave_end)
            else:
                return False, "stylist leave", f"{leave_start_date.isoformat()} to {leave_end_date.isoformat()}"

    return True, None, None


def is_slot_available(
    db,
    salon_id: str,
    stylist_id: str,
    appointment_date: str,
    appointment_time: str,
    duration_minutes: int,
    buffer_minutes: int = DEFAULT_BUFFER_MINUTES,
    exclude_booking_id: str | None = None,
) -> bool:
    available, _, _ = get_slot_conflict_details(
        db,
        salon_id,
        stylist_id,
        appointment_date,
        appointment_time,
        duration_minutes,
        buffer_minutes=buffer_minutes,
        exclude_booking_id=exclude_booking_id,
    )
    return available


def get_available_slots_for_day(
    db,
    salon_id: str,
    stylist_id: str,
    appointment_date: str,
    duration_minutes: int,
    buffer_minutes: int = DEFAULT_BUFFER_MINUTES,
    business_start_time: str = BUSINESS_START_TIME,
    business_end_time: str = BUSINESS_END_TIME,
    slot_minutes: int = DEFAULT_SLOT_MINUTES,
):
    parsed_date = date.fromisoformat(appointment_date)
    start_dt = datetime.combine(
        parsed_date,
        parse_time_value(business_start_time),
    )
    end_dt = datetime.combine(
        parsed_date,
        parse_time_value(business_end_time),
    )

    candidate_slots = []
    cursor = start_dt
    while cursor + timedelta(minutes=duration_minutes) <= end_dt:
        slot_time = cursor.strftime("%I:%M %p")
        if is_slot_available(
            db,
            salon_id,
            stylist_id,
            appointment_date,
            slot_time,
            duration_minutes,
            buffer_minutes=buffer_minutes,
        ):
            candidate_slots.append(slot_time)
        cursor += timedelta(minutes=slot_minutes)

    return candidate_slots
