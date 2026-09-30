"""Request-body shapes for the API. These are separate from models.py:
models.py defines the database tables, this file defines what a client
is allowed to send in when creating/updating something."""

from datetime import date as date_type
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


def _require_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("must be a number")
    return value

def _require_non_negative_number(value):
    value = _require_number(value)
    if value < 0:
        raise ValueError("must be non-negative")
    return value

def _require_positive_integer(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("must be a positive integer")
    return value

def _require_non_negative_integer(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("must be a non-negative integer")
    return value

def _require_non_blank(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("must not be blank")
    return value


class CarIn(BaseModel):
    name: str = Field(min_length=1)
    plate: Optional[str] = None
    purchase_date: date_type
    purchase_price: float = Field(default=0, ge=0)

    _name_must_not_be_blank = field_validator("name", mode="before")(_require_non_blank)
    _purchase_price_must_be_valid = field_validator("purchase_price", mode="before")(_require_non_negative_number)

class RepairIn(BaseModel):
    date: date_type
    description: str = Field(min_length=1)
    cost: float = Field(default=0, ge=0)

    _description_must_not_be_blank = field_validator("description", mode="before")(_require_non_blank)
    _cost_must_be_valid = field_validator("cost", mode="before")(_require_non_negative_number)

class ExpenseIn(BaseModel):
    date: Optional[date_type] = None
    description: str = Field(min_length=1)
    cost: float = Field(default=0, ge=0)

    _description_must_not_be_blank = field_validator("description", mode="before")(_require_non_blank)
    _cost_must_be_valid = field_validator("cost", mode="before")(_require_non_negative_number)

class PartIn(BaseModel):
    name: str = Field(min_length=1)
    stock: int = Field(default=0, ge=0)
    unit_cost: float = Field(default=0, ge=0)
    supplier: Optional[str] = None
    category: Literal["part", "tool"] = "part"

    _name_must_not_be_blank = field_validator("name", mode="before")(_require_non_blank)
    _stock_must_be_integer = field_validator("stock", mode="before")(_require_non_negative_integer)
    _unit_cost_must_be_valid = field_validator("unit_cost", mode="before")(_require_non_negative_number)

class PartUsageIn(BaseModel):
    part_id: int = Field(gt=0)
    qty: int = Field(default=1, gt=0)
    date: Optional[date_type] = None

    _part_id_must_be_positive = field_validator("part_id", mode="before")(_require_positive_integer)
    _qty_must_be_positive = field_validator("qty", mode="before")(_require_positive_integer)

class SaleIn(BaseModel):
    sale_date: date_type
    sale_price: float = Field(ge=0)
    sale_buyer: Optional[str] = None

    _sale_price_must_be_valid = field_validator("sale_price", mode="before")(_require_non_negative_number)

class ServiceJobIn(BaseModel):
    date: date_type
    customer: Optional[str] = None
    vehicle: Optional[str] = None
    description: str = Field(min_length=1)
    price: float = Field(default=0, ge=0)
    labor_cost: float = Field(default=0, ge=0)
    notes: Optional[str] = None
    parts_used: List[PartUsageIn] = Field(default_factory=list)

    _description_must_not_be_blank = field_validator("description", mode="before")(_require_non_blank)
    _price_must_be_valid = field_validator("price", mode="before")(_require_non_negative_number)
    _labor_cost_must_be_valid = field_validator("labor_cost", mode="before")(_require_non_negative_number)


