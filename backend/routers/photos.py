"""A photo always belongs to either a car or a part (never both), so
deleting one is generic enough to live in its own small router rather
than being duplicated in both routers/cars.py and routers/parts.py."""

import os
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from backend.database import get_session, UPLOADS_DIR
from backend.models import Photo
from backend.helper import car_out, part_out, get_car_or_404, get_part_or_404

router = APIRouter(tags=["photos"])


@router.delete("/api/photos/{photo_id}")
def delete_photo(photo_id: int, session: Session = Depends(get_session)):
    ph = session.get(Photo, photo_id)
    if not ph:
        raise HTTPException(404, "Not found")
    car_id, part_id = ph.car_id, ph.part_id
    path = os.path.join(UPLOADS_DIR, ph.filename)
    if os.path.exists(path):
        os.remove(path)
    session.delete(ph)
    session.commit()
    if car_id:
        return car_out(get_car_or_404(session, car_id))
    return part_out(get_part_or_404(session, part_id))
