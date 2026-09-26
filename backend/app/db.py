from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings


def normalize_database_url(raw_url: str) -> str:
    """Pin the driver explicitly rather than relying on SQLAlchemy's default for a bare
    "postgresql://" URL — that default has changed across versions (some resolve it to
    psycopg2, others to psycopg3), but only psycopg2-binary is in requirements.txt."""
    url = make_url(raw_url)
    if url.drivername == "postgresql":
        url = url.set(drivername="postgresql+psycopg2")
    return url.render_as_string(hide_password=False)


DATABASE_URL = normalize_database_url(settings.database_url)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
