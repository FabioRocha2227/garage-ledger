import os

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from sqlmodel import Session, select
from pydantic import BaseModel

from backend.database import init_db, get_session, UPLOADS_DIR
from backend.routers import cars
##, parts, photos, finances, services

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

app.include_router(cars.router)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

