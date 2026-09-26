from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

# Pin the driver explicitly rather than relying on SQLAlchemy's default for a bare
# "postgresql://" URL — that default has changed across versions (some resolve it to
# psycopg2, others to psycopg3), but only psycopg2-binary is in requirements.txt.
_db_url = make_url(settings.database_url)
if _db_url.drivername == "postgresql":
    _db_url = _db_url.set(drivername="postgresql+psycopg2")

DATABASE_URL = _db_url.render_as_string(hide_password=False)
engine = create_engine(_db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
