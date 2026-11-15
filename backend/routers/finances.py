"""The business-wide views: dashboard summary, the full transaction
ledger, and its CSV export."""

import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from datetime import datetime

from backend.database import get_session
from backend.models import Car, ConsumablePurchase, ServiceJob, OwnerWithdrawal, ToolPurchase
from backend.schemas import OwnerWithdrawalIn
from backend.helper import car_cost, car_out, service_cost, service_out

router = APIRouter(tags=["finances"])

def _money(value):
    return round(value, 2)

def _stamp(day, value):
    return value.isoformat(timespec="seconds") if value else f"{day.isoformat()}T00:00:00"

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
    consumables = session.exec(select(ConsumablePurchase)).all()
    consumable_expenses = _money(sum(purchase.quantity * purchase.unit_cost for purchase in consumables))
    tools = session.exec(select(ToolPurchase)).all()
    tool_expenses = _money(sum(purchase.quantity * purchase.unit_cost for purchase in tools))

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
        "total_profit": car_profit + service_profit - consumable_expenses - tool_expenses,
        "consumable_expenses": consumable_expenses,
        "tool_expenses": tool_expenses,
    }

def _all_transactions(session: Session):
    cars = session.exec(select(Car)).all()
    entries = []
    for c in cars:
        entries.append({"date": str(c.purchase_date), "timestamp": _stamp(c.purchase_date, c.created_at), "car": c.name, "type": "Purchase", "amount": -c.purchase_price})
        for r in c.repairs:
            entries.append({"date": str(r.date), "timestamp": _stamp(r.date, r.created_at), "car": c.name, "type": f"Repair: {r.description}", "amount": -r.cost})
        for e in c.expenses:
            entry_date = e.date or c.purchase_date
            entries.append({"date": str(entry_date), "timestamp": _stamp(entry_date, e.created_at), "car": c.name, "type": f"Expense: {e.description}", "amount": -e.cost})
        for p in c.parts_used:
            entry_date = p.date or c.purchase_date
            entries.append({"date": str(entry_date), "timestamp": _stamp(entry_date, p.created_at), "car": c.name, "type": f"Part: {p.part_name}", "amount": -p.cost})
        if c.sale_price is not None:
            entries.append({"date": str(c.sale_date), "timestamp": _stamp(c.sale_date, c.sale_at), "car": c.name, "type": "Sale", "amount": c.sale_price})

    services = session.exec(select(ServiceJob)).all()
    for s in services:
        label = f"Service — {s.customer or s.vehicle or 'walk-in'}"
        if s.labor_cost:
            entries.append({"date": str(s.date), "timestamp": _stamp(s.date, s.created_at), "car": label, "type": f"Labor: {s.description}", "amount": -s.labor_cost})
        for p in s.parts_used:
            entries.append({"date": str(s.date), "timestamp": _stamp(s.date, p.created_at), "car": label, "type": f"Part: {p.part_name}", "amount": -p.cost})
        entries.append({"date": str(s.date), "timestamp": _stamp(s.date, s.created_at), "car": label, "type": f"Job: {s.description}", "amount": s.price})

    consumables = session.exec(select(ConsumablePurchase)).all()
    for purchase in consumables:
        entries.append({
            "date": str(purchase.date),
            "timestamp": _stamp(purchase.date, purchase.created_at),
            "car": "Consumables",
            "type": f"Consumable: {purchase.name}",
            "amount": -(purchase.quantity * purchase.unit_cost),
        })

    tools = session.exec(select(ToolPurchase)).all()
    for purchase in tools:
        entries.append({
            "date": str(purchase.date),
            "timestamp": _stamp(purchase.date, purchase.created_at),
            "car": "Tools & Equipment",
            "type": f"Tool: {purchase.name}",
            "amount": -(purchase.quantity * purchase.unit_cost),
        })

    withdrawals = session.exec(select(OwnerWithdrawal)).all()
    for w in withdrawals:
        entries.append({
            "date": str(w.date),
            "timestamp": _stamp(w.date, w.created_at),
            "car": "Owner withdrawal",
            "type": "Owner withdrawal",
            "amount": -w.amount,
            "description": w.description,
            "withdrawal_id": w.id,
        })

    entries.sort(key=lambda e: (e["date"], e["timestamp"]), reverse=True)
    return entries

@router.get("/api/finances")
def finances(session:Session = Depends(get_session)):
    """Return a full ledger of all transactions."""
    entries = _all_transactions(session)
    operating_entries = [e for e in entries if e["type"] != "Owner withdrawal"]
    total_in = sum(e["amount"] for e in operating_entries if e["amount"] > 0)
    total_out = sum(e["amount"] for e in operating_entries if e["amount"] < 0)
    total_withdrawals = sum(abs(e["amount"]) for e in entries if e["type"] == "Owner withdrawal")
    return {
        "entries": entries,
        "total_in": _money(total_in),
        "total_out": _money(total_out),
        "total_withdrawals": _money(total_withdrawals),
    }

@router.post("/api/withdrawals")
def create_withdrawal(data: OwnerWithdrawalIn, session: Session = Depends(get_session)):
    withdrawal = OwnerWithdrawal(**data.dict())
    session.add(withdrawal)
    session.commit()
    session.refresh(withdrawal)
    return withdrawal

@router.delete("/api/withdrawals/{withdrawal_id}")
def delete_withdrawal(withdrawal_id: int, session: Session = Depends(get_session)):
    withdrawal = session.get(OwnerWithdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Owner withdrawal not found")
    session.delete(withdrawal)
    session.commit()
    return {"ok": True}

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
