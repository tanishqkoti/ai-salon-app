import os

import firebase_admin
from firebase_admin import credentials, firestore

service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

if not os.path.isabs(service_account_path):
    service_account_path = os.path.join(os.path.dirname(__file__), service_account_path)

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

# Firestore client available at import time
db = firestore.client()
