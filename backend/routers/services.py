"""Standalone service jobs: oil changes, inspections, repairs done for a
customer's own car -- not a car he bought to flip. Money in is the price
charged; money out is labor cost plus whatever parts got used."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import ServiceJob, ServicePartUsage, Part
from backend.schemas import ServiceJobIn, PartUsageIn
from backend.helper import service_out, get_service_or_404, get_part_or_404

router = APIRouter(tags=["services"])

@router.get("/api/services")
def list_services(session: Session = Depends(get_session)):
    services = session.exec(select(ServiceJob)).all()
    return [service_out(s) for s in services]

@router.post("/api/services")
def create_service(data: ServiceJobIn, session: Session = Depends(get_session)):
    selected_parts = []
    for usage in data.parts_used:
        if usage.qty < 1:
            raise HTTPException(400, "Part quantity must be at least 1.")
        part = get_part_or_404(session, usage.part_id)
        if part.category != "part":
            raise HTTPException(400, "That's a tool, not a consumable part — it can't be used up on a job.")
        if part.stock < usage.qty:
            raise HTTPException(400, f"Not enough stock for {part.name}.")
        selected_parts.append((usage, part))

    service = ServiceJob(**data.dict(exclude={"parts_used"}))
    session.add(service)
    session.flush()
    for usage, part in selected_parts:
        part.stock -= usage.qty
        session.add(ServicePartUsage(
            service_id=service.id,
            part_id=part.id,
            part_name=part.name,
            qty=usage.qty,
            cost=usage.qty * part.unit_cost,
        ))
    session.commit()
    session.refresh(service)
    return service_out(service)

@router.get("/api/services/{service_id}")
def get_service(service_id: int, session: Session = Depends(get_session)):
    service = get_service_or_404(session, service_id)
    return service_out(service)

@router.delete("/api/services/{service_id}")
def delete_service(service_id: int, session: Session = Depends(get_session)):
    service = get_service_or_404(session, service_id)
    # give back any stock used by this job before deleting it
    for u in service.parts_used:
        if u.part_id:
            part = session.get(Part, u.part_id)
            if part:
                part.stock += u.qty
                session.add(part)
    session.delete(service)
    session.commit()
    return {"ok": True}

@router.post("/api/services/{service_id}/use-part")
def use_part_on_service(service_id: int, data: PartUsageIn, session: Session = Depends(get_session)):
    service = get_service_or_404(session, service_id)
    part = get_part_or_404(session, data.part_id)
    if part.category != "part":
        raise HTTPException(400, "That's a tool, not a consumable part — it can't be used up on a job.")
    if data.qty < 1:
        raise HTTPException(400, "Part quantity must be at least 1.")
    if part.stock < data.qty:
        raise HTTPException(400, f"Not enough stock for {part.name}.")
    part.stock -= data.qty
    usage = ServicePartUsage(service_id=service.id, part_id=part.id, part_name=part.name, qty=data.qty, cost=data.qty * part.unit_cost)
    session.add(part)
    session.add(usage)
    session.commit()
    return service_out(get_service_or_404(session, service_id))


@router.delete("/api/service-part-usage/{usage_id}")
def delete_service_part_usage(usage_id: int, session: Session = Depends(get_session)):
    u = session.get(ServicePartUsage, usage_id)
    if not u:
        raise HTTPException(404, "Not found")
    if u.part_id:
        part = session.get(Part, u.part_id)
        if part:
            part.stock += u.qty
            session.add(part)
    service_id = u.service_id
    session.delete(u)
    session.commit()
    return service_out(get_service_or_404(session, service_id))



