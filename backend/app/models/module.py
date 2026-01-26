"""Module and Profile models for schema organization."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ModuleBase(SQLModel):
    """Base model for Module with common fields."""

    module_id: str = Field(unique=True, index=True)
    label: str
    description: str | None = None
    category_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    dependencies: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Module(ModuleBase, table=True):
    """Module database table."""

    __tablename__ = "modules"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    commit_sha: str | None = None  # For versioning from GitHub
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None  # Soft delete


class ModuleCreate(ModuleBase):
    """Schema for creating a Module."""

    pass


class ModuleUpdate(SQLModel):
    """Schema for updating a Module (all fields optional)."""

    module_id: str | None = None
    label: str | None = None
    description: str | None = None
    category_ids: list[str] | None = None
    dependencies: list[str] | None = None


class ModulePublic(ModuleBase):
    """Public schema for Module responses."""

    id: uuid.UUID
    commit_sha: str | None = None
    created_at: datetime
    updated_at: datetime


class ProfileBase(SQLModel):
    """Base model for Profile with common fields."""

    profile_id: str = Field(unique=True, index=True)
    label: str
    description: str | None = None
    module_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Profile(ProfileBase, table=True):
    """Profile database table."""

    __tablename__ = "profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    commit_sha: str | None = None  # For versioning from GitHub
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None  # Soft delete


class ProfileCreate(ProfileBase):
    """Schema for creating a Profile."""

    pass


class ProfileUpdate(SQLModel):
    """Schema for updating a Profile (all fields optional)."""

    profile_id: str | None = None
    label: str | None = None
    description: str | None = None
    module_ids: list[str] | None = None


class ProfilePublic(ProfileBase):
    """Public schema for Profile responses."""

    id: uuid.UUID
    commit_sha: str | None = None
    created_at: datetime
    updated_at: datetime
