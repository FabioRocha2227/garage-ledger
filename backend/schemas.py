"""Request-body shapes for the API. These are separate from models.py:
models.py defines the database tables, this file defines what a client
is allowed to send in when creating/updating something."""

from datetime import date
from typing import Optional
from pydantic import BaseModel

class CarIn(BaseModel):
    name: str
    plate: Optional[str] = None
    purchase_date: date
    purchase_price: float = 0

class RepairIn(BaseModel):
    date:date
    description: str
    cost: float = 0

class ExpenseIn(BaseModel):
    description: str
    cost: float = 0

class PartIn(BaseModel):
    name: str
    stock: int = 0
    unit_cost: float = 0
    supplier: Optional[str] = None
    category: str = "part"  # "part" (consumable) or "tool" (equipment)

class PartUsageIn(BaseModel):
    part_id: int
    qty: int = 1

class SaleIn(BaseModel):
    sale_date: date
    sale_price: float
    sale_buyer: Optional[str] = None

class ServiceJobIn(BaseModel):
    date: date
    customer: Optional[str] = None
    vehicle: Optional[str] = None
    description: str
    price: float = 0
    labor_cost: float = 0
    notes: Optional[str] = None


