"""The business-wide views: dashboard summary, the full transaction
ledger, and its CSV export."""

import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import Car, ServiceJob
from backend.helper import car_cost, car_out, service_cost, service_out

router = APIRouter(tags=["finances"])

@router.get("/api/dashboard")
def dashboar(session:Session  = Depends(get_session)):
    """Return a summary of the business finances."""
    cars = session.exec(select(Car)).all()
    sold = [c for c in cars if c.sale_price is not None]
    in_stock = [c for c in cars if c.sale_price is None]
    car_invested = sum(car_cost(c) for c in cars)
    car_revenue = sum(c.sale_price for c in sold)
    car_profit = sum(c.sale_price - car_cost(c) for c in sold)
    tied_up = sum(car_cost(c) for c in in_stock)
    avg_days = None
    if sold:
        days = [(c.sale_date - c.purchase_date).days for c in sold]
        avg_days = round(sum(days) / len(days))

    services = session.exec(select(ServiceJob)).all()
    service_revenue = sum(s.price for s in services)
    service_profit = sum(s.price - service_cost(s) for s in services)

    return {
        "invested": car_invested,
        "revenue": car_revenue,
        "profit": car_profit,
        "tied_up": tied_up,
        "in_stock": len(in_stock),
        "sold": len(sold),
        "avg_days": avg_days,
        "recent": [car_out(c) for c in sorted(cars, key=lambda c: c.sale_date or c.purchase_date, reverse=True)[:8]],
        "service_revenue": service_revenue,
        "service_profit": service_profit,
        "service_jobs": len(services),
        "total_revenue": car_revenue + service_revenue,
        "total_profit": car_profit + service_profit,
    }

def _all_transactions(session: Session):
    cars = session.exec(select(Car)).all()
    entries = []
    for c in cars:
        entries.append({"date": str(c.purchase_date), "car": c.name, "type": "Purchase", "amount": -c.purchase_price})
        for r in c.repairs:
            entries.append({"date": str(r.date), "car": c.name, "type": f"Repair: {r.description}", "amount": -r.cost})
        for e in c.expenses:
            entries.append({"date": str(c.purchase_date), "car": c.name, "type": f"Expense: {e.description}", "amount": -e.cost})
        for p in c.parts_used:
            entries.append({"date": str(c.purchase_date), "car": c.name, "type": f"Part: {p.part_name}", "amount": -p.cost})
        if c.sale_price is not None:
            entries.append({"date": str(c.sale_date), "car": c.name, "type": "Sale", "amount": c.sale_price})

    services = session.exec(select(ServiceJob)).all()
    for s in services:
        label = f"Service — {s.customer or s.vehicle or 'walk-in'}"
        if s.labor_cost:
            entries.append({"date": str(s.date), "car": label, "type": f"Labor: {s.description}", "amount": -s.labor_cost})
        for p in s.parts_used:
            entries.append({"date": str(s.date), "car": label, "type": f"Part: {p.part_name}", "amount": -p.cost})
        entries.append({"date": str(s.date), "car": label, "type": f"Job: {s.description}", "amount": s.price})

    entries.sort(key=lambda e: e["date"], reverse=True)
    return entries

@router.get("/api/finances")
def finances(session:Session = Depends(get_session)):
    """Return a full ledger of all transactions."""
    entries = _all_transactions(session)
    total_in = sum(e["amount"] for e in entries if e["amount"] > 0)
    total_out = sum(e["amount"] for e in entries if e["amount"] < 0)
    return {
        "entries": entries,
        "total_in": total_in,
        "total_out": total_out,
    }

@router.get("/api/export/csv")
def export_csv(session: Session = Depends(get_session)):
    entries = _all_transactions(session)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Car / Job", "Type", "Amount"])
    for e in entries:
        writer.writerow([e["date"], e["car"], e["type"], e["amount"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=garage-ledger-transactions.csv"},
    )
