"""Everything about a single car: creating/deleting it, and logging
repairs, other expenses, parts used, a sale, and photos against it."""

import os
from datetime import date, datetime
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from backend.database import get_session, UPLOADS_DIR
from backend.models import Car, Repair, Expense, Part, PartUsage, Photo
from backend.schemas import CarIn, RepairIn, ExpenseIn, PartUsageIn, SaleIn
from backend.helper import car_out, save_upload, get_car_or_404, get_part_or_404


router = APIRouter(tags=["cars"])

@router.get("/api/cars")
def list_cars(session: Session = Depends(get_session)):
    """List all cars in the garage."""
    cars = session.exec(select(Car)).all()
    return [car_out(c) for c in cars]

@router.post("/api/cars")
def create_car(data: CarIn, session: Session = Depends(get_session)):
    """Create a new car in the garage."""
    car = Car(**data.dict(), created_at=datetime.now(timezone.utc))
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
    for usage in car.parts_used:
        if usage.part_id:
            part = session.get(Part, usage.part_id)
            if part:
                part.stock += usage.qty
                session.add(part)
    for ph in car.photos:
        p = os.path.join(UPLOADS_DIR, ph.filename)
        if os.path.exists(p):
            os.remove(p)
    session.delete(car)
    session.commit()
    return {"ok": True}


# ---- repairs ----


@router.post("/api/cars/{car_id}/repairs")
def add_repair(car_id: int, data: RepairIn, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    session.add(Repair(car_id=car.id, created_at=datetime.now(timezone.utc), **data.dict()))
    session.commit()
    return car_out(get_car_or_404(session, car_id))

@router.delete("/api/repairs/{repair_id}")
def delete_repair(repair_id: int, session: Session = Depends(get_session)):
    repair = session.get(Repair, repair_id)
    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")
    car_id = repair.car_id
    session.delete(repair)
    session.commit()
    return car_out(get_car_or_404(session, car_id))



# ---- other expenses ----

@router.post("/api/cars/{car_id}/expenses")
def add_expense(car_id: int, data: ExpenseIn, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    session.add(Expense(car_id=car.id, date=data.date or date.today(), created_at=datetime.now(timezone.utc), description=data.description, cost=data.cost))
    session.commit()
    return car_out(get_car_or_404(session, car_id))

@router.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, session: Session = Depends(get_session)):
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    car_id = expense.car_id
    session.delete(expense)
    session.commit()
    return car_out(get_car_or_404(session, car_id))

# ---- sale ----

@router.post("/api/cars/{car_id}/sale")
def set_sale(car_id: int, data: SaleIn, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    car.sale_date = data.sale_date
    car.sale_at = datetime.now(timezone.utc)
    car.sale_price = data.sale_price
    car.sale_buyer = data.sale_buyer
    session.add(car)
    session.commit()
    return car_out(get_car_or_404(session, car_id))

@router.delete("/api/cars/{car_id}/sale")
def clear_sale(car_id: int, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    car.sale_date = None
    car.sale_price = None
    car.sale_buyer = None
    session.add(car)
    session.commit()
    return car_out(get_car_or_404(session, car_id))

# ---- parts used on this car ----

@router.post("/api/cars/{car_id}/use-part")
def use_part(car_id: int, data: PartUsageIn, session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    part = get_part_or_404(session, data.part_id)
    if part.category != "part":
        raise HTTPException(400, "That's a tool, not a consumable part — it can't be used up on a car.")
    if data.qty < 1 or part.stock < data.qty:
        raise HTTPException(400, "Not enough stock for this part.")
    part.stock -= data.qty
    usage = PartUsage(
        car_id=car.id,
        part_id=part.id,
        date=data.date or date.today(),
        created_at=datetime.now(timezone.utc),
        part_name=part.name,
        qty=data.qty,
        cost=data.qty * part.unit_cost,
    )
    session.add(part)
    session.add(usage)
    session.commit()
    return car_out(get_car_or_404(session, car_id))


@router.delete("/api/part-usage/{usage_id}")
def delete_part_usage(usage_id: int, session: Session = Depends(get_session)):
    u = session.get(PartUsage, usage_id)
    if not u:
        raise HTTPException(404, "Not found")
    if u.part_id:
        part = session.get(Part, u.part_id)
        if part:
            part.stock += u.qty
            session.add(part)
    car_id = u.car_id
    session.delete(u)
    session.commit()
    return car_out(get_car_or_404(session, car_id))

# ---- photos ----

@router.post("/api/cars/{car_id}/photos")
def upload_car_photo(car_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)):
    car = get_car_or_404(session, car_id)
    fname = save_upload(file)
    session.add(Photo(filename=fname, car_id=car.id))
    session.commit()
    return car_out(get_car_or_404(session, car_id))
