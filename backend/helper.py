import os
import shutil
import uuid

from fastapi import HTTPException, UploadFile
from sqlmodel import Session

from backend.database import UPLOADS_DIR
from backend.models import Car, Part, ServiceJob


def car_cost(car: Car) -> float:
    return(
        (car.purchase_price or 0) 
        + sum(r.cost for r in car.repairs) 
        + sum(e.cost for e in car.expenses) 
        + sum(p.cost for p in car.parts_used)
    )

def car_out(car: Car) -> dict:
    cost = car_cost(car)
    profit = (car.sale_price - cost) if car.sale_price is not None else None
    return {
        "id" : car.id,
        "name" : car.name,
        "plate" : car.plate,
        "purchase_date" : car.purchase_date,
        "purchase_price" : car.purchase_price,
        "sale_date" : car.sale_date,
        "sale_price" : car.sale_price,
        "sale_buyer" : car.sale_buyer,
        "cost" : cost,
        "profit" : profit,
        "repairs" : [{"id": r.id, "date": r.date, "description": r.description, "cost": r.cost} for r in car.repairs],
        "expenses" : [{"id": e.id, "description": e.description, "cost": e.cost} for e in car.expenses],
        "parts_used" : [{"id": p.id, "part_id": p.part_id, "part_name": p.part_name, "qty": p.qty, "cost": p.cost} for p in car.parts_used],
        "photos" : [{"id": ph.id, "filename": ph.filename} for ph in car.photos],
    }



