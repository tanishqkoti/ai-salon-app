import json
import os

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import firestore

load_dotenv()

def _initialize_firebase() -> None:
    if firebase_admin._apps:
        return

    service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if service_account_path and service_account_path.strip():
        path = service_account_path.strip()
        if not os.path.isabs(path):
            path = os.path.abspath(path)

        if not os.path.exists(path):
            raise RuntimeError(
                f"GOOGLE_APPLICATION_CREDENTIALS points to a non-existent file: {path}"
            )

        try:
            with open(path, "r", encoding="utf-8") as credential_file:
                config = json.load(credential_file)
        except (OSError, ValueError, TypeError) as exc:
            raise RuntimeError(
                f"Unable to read or parse GOOGLE_APPLICATION_CREDENTIALS file: {path}"
            ) from exc

        if not isinstance(config, dict) or config.get("type") != "service_account":
            raise RuntimeError(
                "GOOGLE_APPLICATION_CREDENTIALS must point to a valid Firebase service account JSON file."
            )

        from firebase_admin import credentials

        firebase_admin.initialize_app(credentials.Certificate(path))
        return

    firebase_admin.initialize_app()


_initialize_firebase()
db = firestore.client()
