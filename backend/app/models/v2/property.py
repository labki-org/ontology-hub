"""Property entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class PropertyBase(SQLModel):
    """Base model for Property with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Has_name"
    source_path: str  # Original file path, e.g., "properties/Has_name.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Core property fields (promoted from canonical_json for easier querying)
    datatype: str | None = None
    cardinality: str | None = None

    # Validation constraints
    allowed_values: list[str] | None = Field(default=None, sa_column=Column(JSON))
    allowed_pattern: str | None = None
    allowed_value_list: str | None = None

    # Display configuration
    display_units: list[str] | None = Field(default=None, sa_column=Column(JSON))
    display_precision: int | None = None

    # Constraints and relationships
    unique_values: bool = Field(default=False)
    has_display_template_key: str | None = None  # Template entity_key reference


class Property(PropertyBase, table=True):
    """Property entity database table.

    Properties define data fields that can be attached to categories.
    """

    __tablename__ = "properties"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_properties_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PropertyPublic(PropertyBase):
    """Public schema for Property responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
