"""Parts inventory: creating/deleting parts and attaching photos to them.
Stock levels themselves are adjusted from routers/cars.py, when a part
gets used on (or removed from) a car."""

import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session, select

from backend.database import get_session, UPLOADS_DIR
from backend.models import ConsumablePurchase, Part, Photo, ToolPurchase
from backend.schemas import ConsumablePurchaseIn, PartIn, ToolPurchaseIn
from backend.helper import consumable_out, part_out, save_upload, get_part_or_404, tool_out

router = APIRouter(tags=["parts"])

@router.get("/api/parts")
def list_parts(session: Session = Depends(get_session)):
    """List all parts in the inventory."""
    parts = session.exec(select(Part)).all()
    return [part_out(p) for p in parts]

@router.get("/api/parts/{part_id}")
def get_part(part_id: int, session: Session = Depends(get_session)):
    return part_out(get_part_or_404(session, part_id))

@router.post("/api/parts")
def create_part(data: PartIn, session: Session = Depends(get_session)):
    """Create a new part in the inventory."""
    part = Part(**data.dict())
    session.add(part)
    session.commit()
    session.refresh(part)
    return part_out(part)

@router.delete("/api/parts/{part_id}")
def delete_part(part_id: int, session: Session = Depends(get_session)):
    part = get_part_or_404(session, part_id)
    for ph in part.photos:
        p = os.path.join(UPLOADS_DIR, ph.filename)
        if os.path.exists(p):
            os.remove(p)
    session.delete(part)
    session.commit()
    return {"ok": True}

@router.post("/api/parts/{part_id}/photos")
def upload_part_photo(part_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)):
    part = get_part_or_404(session, part_id)
    fname = save_upload(file)
    session.add(Photo(filename=fname, part_id=part.id))
    session.commit()
    return part_out(get_part_or_404(session, part_id))

@router.get("/api/consumables")
def list_consumables(session: Session = Depends(get_session)):
    purchases = session.exec(select(ConsumablePurchase)).all()
    return [consumable_out(p) for p in sorted(purchases, key=lambda p: (p.date, p.created_at), reverse=True)]

@router.post("/api/consumables")
def create_consumable(data: ConsumablePurchaseIn, session: Session = Depends(get_session)):
    purchase = ConsumablePurchase(**data.dict())
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    return consumable_out(purchase)

@router.delete("/api/consumables/{purchase_id}")
def delete_consumable(purchase_id: int, session: Session = Depends(get_session)):
    purchase = session.get(ConsumablePurchase, purchase_id)
    if not purchase:
        raise HTTPException(404, "Consumable purchase not found")
    session.delete(purchase)
    session.commit()
    return {"ok": True}

@router.get("/api/tools")
def list_tools(session: Session = Depends(get_session)):
    purchases = session.exec(select(ToolPurchase)).all()
    return [tool_out(p) for p in sorted(purchases, key=lambda p: (p.date, p.created_at), reverse=True)]

@router.post("/api/tools")
def create_tool(data: ToolPurchaseIn, session: Session = Depends(get_session)):
    purchase = ToolPurchase(**data.dict())
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    return tool_out(purchase)

@router.delete("/api/tools/{purchase_id}")
def delete_tool(purchase_id: int, session: Session = Depends(get_session)):
    purchase = session.get(ToolPurchase, purchase_id)
    if not purchase:
        raise HTTPException(404, "Tool purchase not found")
    session.delete(purchase)
    session.commit()
    return {"ok": True}
