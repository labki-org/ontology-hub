"""Dashboard entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class DashboardBase(SQLModel):
    """Base model for Dashboard with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Main_Dashboard"
    source_path: str  # Original file path, e.g., "dashboards/Main_Dashboard.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Dashboard(DashboardBase, table=True):
    """Dashboard entity database table.

    Dashboards define page layouts with widgets for displaying entity data.
    """

    __tablename__ = "dashboards"
    __table_args__ = (sa.UniqueConstraint("entity_key", name="uq_dashboards_entity_key"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DashboardPublic(DashboardBase):
    """Public schema for Dashboard responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
