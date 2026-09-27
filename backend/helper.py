"""Small helpers shared by more than one router: turning a Car/Part row
into the JSON shape the frontend expects, cost calculations, saving
uploaded photo files, and 404 lookups."""

import os
import shutil
import uuid

from fastapi import HTTPException, UploadFile
from sqlmodel import Session

from backend.database import UPLOADS_DIR
from backend.models import Car, Part, ServiceJob


def car_cost(car: Car) -> float:
    return (
        (car.purchase_price or 0)
        + sum(r.cost for r in car.repairs)
        + sum(e.cost for e in car.expenses)
        + sum(p.cost for p in car.parts_used)
    )


def car_out(car: Car) -> dict:
    cost = car_cost(car)
    profit = (car.sale_price - cost) if car.sale_price is not None else None
    return {
        "id": car.id,
        "name": car.name,
        "plate": car.plate,
        "purchase_date": car.purchase_date,
        "purchase_price": car.purchase_price,
        "sale_date": car.sale_date,
        "sale_price": car.sale_price,
        "sale_buyer": car.sale_buyer,
        "cost": cost,
        "profit": profit,
        "repairs": [{"id": r.id, "date": r.date, "description": r.description, "cost": r.cost} for r in car.repairs],
        "expenses": [{"id": e.id, "description": e.description, "cost": e.cost} for e in car.expenses],
        "parts_used": [{"id": p.id, "part_id": p.part_id, "part_name": p.part_name, "qty": p.qty, "cost": p.cost} for p in car.parts_used],
        "photos": [{"id": ph.id, "url": f"/uploads/{ph.filename}"} for ph in car.photos],
    }


def part_out(part: Part) -> dict:
    return {
        "id": part.id,
        "name": part.name,
        "stock": part.stock,
        "unit_cost": part.unit_cost,
        "supplier": part.supplier,
        "category": part.category,
        "photos": [{"id": ph.id, "url": f"/uploads/{ph.filename}"} for ph in part.photos],
    }


def service_cost(service: ServiceJob) -> float:
    return (service.labor_cost or 0) + sum(p.cost for p in service.parts_used)


def service_out(service: ServiceJob) -> dict:
    cost = service_cost(service)
    return {
        "id": service.id,
        "date": service.date,
        "customer": service.customer,
        "vehicle": service.vehicle,
        "description": service.description,
        "price": service.price,
        "labor_cost": service.labor_cost,
        "notes": service.notes,
        "cost": cost,
        "profit": service.price - cost,
        "parts_used": [{"id": p.id, "part_id": p.part_id, "part_name": p.part_name, "qty": p.qty, "cost": p.cost} for p in service.parts_used],
    }


def save_upload(file: UploadFile) -> str:
    """Saves an uploaded image to the uploads folder and returns its
    generated filename (never trusts the client's original filename)."""
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(400, "Only image files are allowed.")
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOADS_DIR, fname)
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return fname


def get_car_or_404(session: Session, car_id: int) -> Car:
    car = session.get(Car, car_id)
    if not car:
        raise HTTPException(404, "Car not found")
    return car


def get_part_or_404(session: Session, part_id: int) -> Part:
    part = session.get(Part, part_id)
    if not part:
        raise HTTPException(404, "Part not found")
    return part


def get_service_or_404(session: Session, service_id: int) -> ServiceJob:
    service = session.get(ServiceJob, service_id)
    if not service:
        raise HTTPException(404, "Service job not found")
    return service
