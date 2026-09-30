"""Request-body shapes for the API. These are separate from models.py:
models.py defines the database tables, this file defines what a client
is allowed to send in when creating/updating something."""

from datetime import date as date_type
from typing import List, Optional
from pydantic import BaseModel, field_validator


def _require_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("must be a number")
    return value

class CarIn(BaseModel):
    name: str
    plate: Optional[str] = None
    purchase_date: date_type
    purchase_price: float = 0

    _purchase_price_must_be_number = field_validator("purchase_price", mode="before")(_require_number)

class RepairIn(BaseModel):
    date: date_type
    description: str
    cost: float = 0

    _cost_must_be_number = field_validator("cost", mode="before")(_require_number)

class ExpenseIn(BaseModel):
    date: Optional[date_type] = None
    description: str
    cost: float = 0

    _cost_must_be_number = field_validator("cost", mode="before")(_require_number)

class PartIn(BaseModel):
    name: str
    stock: int = 0
    unit_cost: float = 0
    supplier: Optional[str] = None
    category: str = "part"  # "part" (consumable) or "tool" (equipment)

class PartUsageIn(BaseModel):
    part_id: int
    qty: int = 1
    date: Optional[date_type] = None

class SaleIn(BaseModel):
    sale_date: date_type
    sale_price: float
    sale_buyer: Optional[str] = None

    _sale_price_must_be_number = field_validator("sale_price", mode="before")(_require_number)

class ServiceJobIn(BaseModel):
    date: date_type
    customer: Optional[str] = None
    vehicle: Optional[str] = None
    description: str
    price: float = 0
    labor_cost: float = 0
    notes: Optional[str] = None
    parts_used: List[PartUsageIn] = []


