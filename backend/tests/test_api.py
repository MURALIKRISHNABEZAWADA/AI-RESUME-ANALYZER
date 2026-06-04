from fastapi.testclient import TestClient

from app import main


def test_health_endpoint(monkeypatch):
    monkeypatch.setattr(main, "init_db", lambda: None)

    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
