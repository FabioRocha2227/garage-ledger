"""Parts inventory: creating/deleting parts and attaching photos to them.
Stock levels themselves are adjusted from routers/cars.py, when a part
gets used on (or removed from) a car."""

import os
from fastapi import APIRouter, Depends, UploadFile, File
from sqlmodel import Session, select

from backend.database import get_session, UPLOADS_DIR
from backend.models import Part, Photo
from backend.schemas import PartIn
from backend.helper import part_out, save_upload, get_part_or_404

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
