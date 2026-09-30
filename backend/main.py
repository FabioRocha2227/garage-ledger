import os

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from sqlmodel import Session, select
from pydantic import BaseModel

from backend.routers import backup as backup_router, photos
from backend.database import init_db, get_session, UPLOADS_DIR
from backend.backup import run_daily_backup_if_needed
from backend.routers import cars, finances, parts, services

app = FastAPI(title = "Garage Ledger API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    run_daily_backup_if_needed()

@app.get("/health")
def health():
    """Used by launcher.py to detect an already-running instance instead
    of crashing with a "port in use" error."""
    return {"status": "ok"}

app.include_router(cars.router)
app.include_router(parts.router)
app.include_router(photos.router)
app.include_router(services.router)
app.include_router(finances.router)
app.include_router(backup_router.router)


app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

