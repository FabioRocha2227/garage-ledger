"""Populate an empty Garage Ledger database with realistic demo data."""
from datetime import date

from sqlmodel import Session, select

from backend.database import engine, init_db
from backend.models import Car, Expense, Part, PartUsage, Repair, ServiceJob, ServicePartUsage


def seed_demo() -> None:
    init_db()
    with Session(engine) as session:
        if (
            session.exec(select(Car)).first()
            or session.exec(select(Part)).first()
            or session.exec(select(ServiceJob)).first()
        ):
            raise RuntimeError("Database already contains data; refusing to add duplicate seed records.")

        focus = Car(
            name="Ford Focus",
            plate="26-GAR-01",
            purchase_date=date(2026, 8, 18),
            purchase_price=2400,
        )
        clio = Car(
            name="Renault Clio",
            plate="26-GAR-02",
            purchase_date=date(2026, 9, 2),
            purchase_price=3200,
        )
        golf = Car(
            name="VW Golf",
            plate="26-GAR-03",
            purchase_date=date(2026, 9, 20),
            purchase_price=4200,
        )
        session.add_all([focus, clio, golf])
        session.flush()

        session.add_all(
            [
                Repair(car_id=focus.id, date=date(2026, 8, 22), description="Front brakes", cost=180),
                Repair(car_id=clio.id, date=date(2026, 9, 8), description="Timing belt inspection", cost=120),
                Repair(car_id=clio.id, date=date(2026, 9, 12), description="Oil and filter service", cost=85),
                Expense(car_id=focus.id, date=date(2026, 8, 20), description="Transport", cost=90),
                Expense(car_id=clio.id, date=date(2026, 9, 4), description="Registration", cost=65),
            ]
        )
        clio.sale_date = date(2026, 9, 26)
        clio.sale_price = 4850
        clio.sale_buyer = "Demo customer"
        session.add(clio)

        brake = Part(name="Brake pads", stock=6, unit_cost=45, supplier="Auto Parts Co", category="part")
        oil = Part(name="Oil filter", stock=10, unit_cost=12, supplier="Motor Supply", category="part")
        battery = Part(name="12V battery", stock=2, unit_cost=95, supplier="Power Auto", category="part")
        jack = Part(name="Workshop jack", stock=1, unit_cost=250, supplier="Garage Tools", category="tool")
        session.add_all([brake, oil, battery, jack])
        session.flush()

        brake.stock -= 2
        oil.stock -= 3
        session.add_all(
            [
                PartUsage(
                    car_id=focus.id,
                    part_id=brake.id,
                    date=date(2026, 8, 22),
                    part_name=brake.name,
                    qty=2,
                    cost=90,
                ),
                PartUsage(
                    car_id=clio.id,
                    part_id=oil.id,
                    date=date(2026, 9, 12),
                    part_name=oil.name,
                    qty=2,
                    cost=24,
                ),
            ]
        )

        service = ServiceJob(
            date=date(2026, 9, 29),
            customer="Maria Silva",
            vehicle="Toyota Yaris",
            description="Annual service",
            price=240,
            labor_cost=80,
            notes="Demo service job",
        )
        session.add(service)
        session.flush()
        session.add(
            ServicePartUsage(
                service_id=service.id,
                part_id=oil.id,
                part_name=oil.name,
                qty=1,
                cost=12,
            )
        )
        session.commit()

    print("Seeded 3 cars, 4 inventory items, 5 car costs, 1 service job, and 3 part usages.")


if __name__ == "__main__":
    seed_demo()
