#!/usr/bin/env python3
import argparse
import os
import sys
from typing import Iterable

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from firebase_config import db

TEST_EMAILS = ["test@example.com", "manualtest@example.com"]


def get_matching_docs(collection_name: str, emails: Iterable[str]):
    email_set = set(emails)
    docs = []
    for doc in db.collection(collection_name).stream():
        data = doc.to_dict() or {}
        email = (data.get("customer_email") or "").strip()
        if email in email_set:
            docs.append((doc.id, data))
    return docs


def get_schedule_docs_for_test_emails(emails: Iterable[str]):
    email_set = set(emails)
    docs = []
    for collection_name in ("stylist_schedule", "schedule"):
        try:
            for doc in db.collection(collection_name).stream():
                data = doc.to_dict() or {}
                if data.get("customer_email") in email_set:
                    docs.append((collection_name, doc.id, data))
                elif data.get("email") in email_set:
                    docs.append((collection_name, doc.id, data))
                elif data.get("stylist_id") and data.get("salon_id") and "test" in str(data.get("stylist_id", "")).lower():
                    docs.append((collection_name, doc.id, data))
        except Exception:
            continue
    return docs


def print_dry_run(title: str, doc_rows):
    print(f"\n{title} ({len(doc_rows)} matches)")
    if not doc_rows:
        print("  No matching records found.")
        return

    for row in doc_rows:
        if len(row) == 2:
            doc_id, data = row
            print(
                f"- {doc_id}: customer_name={data.get('customer_name')}, "
                f"customer_email={data.get('customer_email')}, "
                f"stylist_id={data.get('stylist_id')}, "
                f"appointment_date={data.get('appointment_date')}, "
                f"appointment_time={data.get('appointment_time')}, "
                f"status={data.get('status')}"
            )
        else:
            collection_name, doc_id, data = row
            print(
                f"- {collection_name}/{doc_id}: customer_name={data.get('customer_name')}, "
                f"customer_email={data.get('customer_email') or data.get('email')}, "
                f"stylist_id={data.get('stylist_id')}, "
                f"appointment_date={data.get('appointment_date')}, "
                f"appointment_time={data.get('appointment_time')}, "
                f"status={data.get('status')}"
            )


def delete_rows(rows):
    deleted = 0
    for row in rows:
        if len(row) == 2:
            doc_id, _ = row
            db.collection("bookings").document(doc_id).delete()
            deleted += 1
        else:
            collection_name, doc_id, _ = row
            db.collection(collection_name).document(doc_id).delete()
            deleted += 1
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Safely delete test booking and schedule records from Firestore.")
    parser.add_argument("--confirm", action="store_true", help="Actually delete matching records. Without this flag, only a dry run is performed.")
    parser.add_argument("--email", action="append", default=[], help="Additional test email to match. Can be supplied multiple times.")
    args = parser.parse_args()

    emails = list(dict.fromkeys(TEST_EMAILS + args.email))

    booking_rows = get_matching_docs("bookings", emails)
    schedule_rows = get_schedule_docs_for_test_emails(emails)
    all_rows = booking_rows + schedule_rows

    print_dry_run("Bookings matching test emails", booking_rows)
    print_dry_run("Stylist schedule documents related to test data", schedule_rows)
    print(f"\nTotal matches found: {len(all_rows)}")

    if not args.confirm:
        print("\nDry run only. No documents were deleted. Re-run with --confirm to delete matches.")
        return 0

    deleted_count = delete_rows(all_rows)
    print(f"\nDeleted {deleted_count} matching documents.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
