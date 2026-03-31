#!/bin/bash
set -e

# Run Alembic migrations if enabled
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Running database migrations..."
    alembic upgrade head
    echo "Migrations complete."
fi

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
