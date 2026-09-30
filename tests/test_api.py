from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from backend import database, helper
from backend.main import app
from backend.models import Car, Expense, Part, PartUsage, Photo, Repair, ServiceJob
from backend.routers import cars as cars_router
from backend.routers import parts as parts_router
from backend.routers import photos as photos_router


@pytest.fixture()
def client(tmp_path, monkeypatch):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(test_engine)
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()

    def get_test_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[database.get_session] = get_test_session
    monkeypatch.setattr(helper, "UPLOADS_DIR", str(upload_dir))
    monkeypatch.setattr(cars_router, "UPLOADS_DIR", str(upload_dir))
    monkeypatch.setattr(parts_router, "UPLOADS_DIR", str(upload_dir))
    monkeypatch.setattr(photos_router, "UPLOADS_DIR", str(upload_dir))

    test_client = TestClient(app)
    yield test_client
    test_client.close()
    app.dependency_overrides.clear()


def create_car(client, name="Civic", purchase_date="2026-09-01"):
    response = client.post(
        "/api/cars",
        json={
            "name": name,
            "plate": "TEST-01",
            "purchase_date": purchase_date,
            "purchase_price": 2500,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_part(client, name="Brake pads", stock=3, unit_cost=20, category="part"):
    response = client.post(
        "/api/parts",
        json={
            "name": name,
            "stock": stock,
            "unit_cost": unit_cost,
            "supplier": "Test supplier",
            "category": category,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health_and_car_crud(client):
    assert client.get("/health").json() == {"status": "ok"}

    car = create_car(client)
    assert car["name"] == "Civic"
    assert car["purchase_price"] == 2500
    assert client.get(f"/api/cars/{car['id']}").json()["id"] == car["id"]
    assert len(client.get("/api/cars").json()) == 1


def test_part_stock_rules_and_car_part_usage(client):
    car = create_car(client)
    part = create_part(client, stock=2)
    tool = create_part(client, name="Jack", stock=1, unit_cost=100, category="tool")

    response = client.post(
        f"/api/cars/{car['id']}/use-part",
        json={"part_id": part["id"], "qty": 2, "date": "2026-09-12"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["parts_used"][0]["date"] == "2026-09-12"
    assert client.get("/api/parts").json()[0]["stock"] == 0

    too_many = client.post(
        f"/api/cars/{car['id']}/use-part",
        json={"part_id": part["id"], "qty": 1, "date": "2026-09-13"},
    )
    assert too_many.status_code == 400

    tool_use = client.post(
        f"/api/cars/{car['id']}/use-part",
        json={"part_id": tool["id"], "qty": 1, "date": "2026-09-13"},
    )
    assert tool_use.status_code == 400


def test_repairs_expenses_and_finance_ordering(client):
    car = create_car(client, purchase_date="2026-09-01")
    part = create_part(client, stock=2)

    repair = client.post(
        f"/api/cars/{car['id']}/repairs",
        json={"date": "2026-09-20", "description": "Brakes", "cost": 100},
    )
    assert repair.status_code == 200, repair.text

    expense = client.post(
        f"/api/cars/{car['id']}/expenses",
        json={"date": "2026-09-25", "description": "Transport", "cost": 50},
    )
    assert expense.status_code == 200, expense.text
    assert expense.json()["expenses"][0]["date"] == "2026-09-25"

    usage = client.post(
        f"/api/cars/{car['id']}/use-part",
        json={"part_id": part["id"], "qty": 1, "date": "2026-09-26"},
    )
    assert usage.status_code == 200, usage.text

    entries = client.get("/api/finances").json()["entries"]
    dates = [entry["date"] for entry in entries]
    assert dates == sorted(dates, reverse=True)
    assert any(entry["type"] == "Expense: Transport" and entry["date"] == "2026-09-25" for entry in entries)
    assert any(entry["type"] == "Part: Brake pads" and entry["date"] == "2026-09-26" for entry in entries)
    assert client.get("/api/export/csv").text.startswith("Date,Car / Job,Type,Amount")


def test_service_job_uses_inventory_and_enters_finances(client):
    part = create_part(client, name="Oil filter", stock=2, unit_cost=15)
    response = client.post(
        "/api/services",
        json={
            "date": "2026-09-22",
            "customer": "Alex",
            "vehicle": "Ford Focus",
            "description": "Oil change",
            "price": 120,
            "labor_cost": 40,
            "parts_used": [{"part_id": part["id"], "qty": 1}],
        },
    )
    assert response.status_code == 200, response.text
    service = response.json()
    assert service["profit"] == 65
    assert len(service["parts_used"]) == 1
    assert client.get("/api/parts").json()[0]["stock"] == 1

    entries = client.get("/api/finances").json()["entries"]
    assert any(entry["type"] == "Job: Oil change" and entry["amount"] == 120 for entry in entries)
    assert any(entry["type"] == "Labor: Oil change" and entry["amount"] == -40 for entry in entries)
    assert any(entry["type"] == "Part: Oil filter" and entry["amount"] == -15 for entry in entries)


def test_photo_upload_and_delete_removes_file(client, tmp_path):
    car = create_car(client)
    part = create_part(client)

    car_photo = client.post(
        f"/api/cars/{car['id']}/photos",
        files={"file": ("car.jpg", b"car image", "image/jpeg")},
    )
    assert car_photo.status_code == 200, car_photo.text
    car_photo_id = car_photo.json()["photos"][0]["id"]
    car_filename = car_photo.json()["photos"][0]["url"].split("/", 2)[-1]

    part_photo = client.post(
        f"/api/parts/{part['id']}/photos",
        files={"file": ("part.png", b"part image", "image/png")},
    )
    assert part_photo.status_code == 200, part_photo.text
    part_photo_id = part_photo.json()["photos"][0]["id"]

    upload_dir = tmp_path / "uploads"
    assert (upload_dir / car_filename).exists()
    assert client.delete(f"/api/photos/{car_photo_id}").status_code == 200
    assert not (upload_dir / car_filename).exists()
    assert client.delete(f"/api/photos/{part_photo_id}").status_code == 200


def test_delete_operations_and_not_found_responses(client):
    car = create_car(client)
    part = create_part(client)

    assert client.get("/api/cars/99999").status_code == 404
    assert client.get("/api/parts/99999").status_code == 404
    assert client.get("/api/services/99999").status_code == 404
    assert client.delete("/api/repairs/99999").status_code == 404

    assert client.delete(f"/api/parts/{part['id']}").status_code == 200
    assert client.delete(f"/api/cars/{car['id']}").status_code == 200
    assert client.get("/api/cars").json() == []
    assert client.get("/api/parts").json() == []


def test_invalid_photo_extension_is_rejected(client):
    car = create_car(client)
    response = client.post(
        f"/api/cars/{car['id']}/photos",
        files={"file": ("malware.exe", b"not an image", "application/octet-stream")},
    )
    assert response.status_code == 400
