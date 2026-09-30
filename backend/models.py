from typing import Optional, List
from datetime import date, datetime
from datetime import timezone
from sqlmodel import SQLModel, Field, Relationship

class Car(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name:str
    plate: Optional[str] = None
    purchase_date: date
    purchase_price: float=0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    sale_date: Optional[date] = None
    sale_at: Optional[datetime] = None
    sale_price: Optional[float] = None
    sale_buyer: Optional[str] = None

    repairs: List["Repair"] = Relationship(back_populates="car", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    expenses: List["Expense"] = Relationship(back_populates="car", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    parts_used: List["PartUsage"] = Relationship(back_populates="car", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    photos: List["Photo"] = Relationship(back_populates="car", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Repair(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    car_id: int = Field(foreign_key="car.id")
    date : date
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: str
    cost: float=0
    car: Car = Relationship(back_populates="repairs")

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    car_id: int = Field(foreign_key="car.id")
    date: date
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: str
    cost: float = 0
    car: Car = Relationship(back_populates="expenses")

class Part(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    stock: int = 0
    unit_cost: float = 0
    supplier: Optional[str] = None
    category: str = Field(default="part")

    photos: List["Photo"] = Relationship(back_populates="part", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class PartUsage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    car_id: int = Field(foreign_key="car.id")
    part_id: Optional[int] = Field(default=None, foreign_key="part.id")
    date: date
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    part_name: str
    qty: int = 1
    cost: float = 0
    car: Car = Relationship(back_populates="parts_used")

class ServiceJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    customer: Optional[str] = None
    vehicle: Optional[str] = None  
    description: str
    price: float = 0
    labor_cost: float = 0
    notes: Optional[str] = None

    parts_used: List["ServicePartUsage"] = Relationship(back_populates="service", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ServicePartUsage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="servicejob.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    part_id: Optional[int] = Field(default=None, foreign_key="part.id")
    part_name: str
    qty: int = 1
    cost: float = 0
    service: ServiceJob = Relationship(back_populates="parts_used")

class Photo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    car_id: Optional[int] = Field(default=None, foreign_key="car.id")
    part_id: Optional[int] = Field(default=None, foreign_key="part.id")
    car: Optional[Car] = Relationship(back_populates="photos")
    part: Optional[Part] = Relationship(back_populates="photos")




