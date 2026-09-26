#!/bin/bash
# Azure App Service (Linux, Python) runs this as the configured startup command.
# Runs pending migrations before serving so a deploy always leaves the DB in sync.
set -e
alembic upgrade head
exec gunicorn -w 4 -k uvicorn.workers.UvicornWorker --bind "0.0.0.0:${PORT:-8000}" app.main:app
