import os
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "garage.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def _migrate(conn):
    """Small hand-rolled migrations for columns added after the first
    release, so an existing garage.db from before doesn't break."""
    cols = [row[1] for row in conn.execute(text("PRAGMA table_info(part)")).fetchall()]
    if "category" not in cols:
        conn.execute(text("ALTER TABLE part ADD COLUMN category TEXT DEFAULT 'part'"))


def init_db():
    import backend.models  # noqa: F401  (ensures models are registered)
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        _migrate(conn)


def get_session():
    with Session(engine) as session:
        yield session
