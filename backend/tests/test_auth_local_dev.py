import pytest
from fastapi import HTTPException

import auth


def test_verify_api_key_allows_configured_local_dev_key(monkeypatch):
    monkeypatch.setenv("BACKEND_API_KEY", "local-dev")
    import importlib
    import auth as auth_module
    importlib.reload(auth_module)
    assert auth_module.verify_api_key("local-dev") == "local-dev"


def test_verify_api_key_rejects_missing_header_when_configured(monkeypatch):
    monkeypatch.setenv("BACKEND_API_KEY", "local-dev")
    import importlib
    import auth as auth_module
    importlib.reload(auth_module)
    with pytest.raises(HTTPException, match="Missing or invalid API key"):
        auth_module.verify_api_key(None)
