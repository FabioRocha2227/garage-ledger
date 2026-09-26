"""Everything about a single car: creating/deleting it, and logging
repairs, other expenses, parts used, a sale, and photos against it."""

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from backend.database import get_session, UPLOADS_DIR
from backend.models import Car, Repair, Expense, Part, PartUsage, Photo
from backend.schemas import CarIn, RepairIn, ExpenseIn, PartUsageIn, SaleIn
from backend.helper import car_out
##, save_upload, get_car_or_404, get_part_or_404


router = APIRouter(tags=["cars"])

@router.get("/api/cars")
def list_cars(session: Session = Depends(get_session)):
    """List all cars in the garage."""
    cars = session.exec(select(Car)).all()
    return [car_out(c) for c in cars]

@router.post("/api/cars")
def create_car(data: CarIn, session: Session = Depends(get_session)):
    """Create a new car in the garage."""
    car = Car(**data.dict())
    session.add(car)
    session.commit()
    session.refresh(car)
    return car_out(car)

@router.get("/api/cars/{car_id}")
def get_car(car_id: int, session: Session = Depends(get_session)):
    return car_out(get_car_or_404(session, car_id))


@router.delete("/api/cars/{car_id}")
def delete_car(car_id: int, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    for ph in car.photos:
        p = os.path.join(UPLOADS_DIR, ph.filename)
        if os.path.exists(p):
            os.remove(p)
    session.delete(car)
    session.commit()
    return {"ok": True}


