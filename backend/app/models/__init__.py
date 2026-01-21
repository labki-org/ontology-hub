"""SQLModel database models.

All table models must be imported here before SQLModel.metadata.create_all runs.
"""

from app.models.draft import (
    Draft,
    DraftBase,
    DraftCreate,
    DraftPublic,
    DraftStatus,
    DraftUpdate,
    DraftWithCapability,
)
from app.models.entity import (
    Entity,
    EntityBase,
    EntityCreate,
    EntityPublic,
    EntityType,
    EntityUpdate,
)
from app.models.module import (
    Module,
    ModuleBase,
    ModuleCreate,
    ModulePublic,
    ModuleUpdate,
    Profile,
    ProfileBase,
    ProfileCreate,
    ProfilePublic,
    ProfileUpdate,
)

__all__ = [
    # Entity
    "Entity",
    "EntityBase",
    "EntityCreate",
    "EntityPublic",
    "EntityType",
    "EntityUpdate",
    # Module
    "Module",
    "ModuleBase",
    "ModuleCreate",
    "ModulePublic",
    "ModuleUpdate",
    # Profile
    "Profile",
    "ProfileBase",
    "ProfileCreate",
    "ProfilePublic",
    "ProfileUpdate",
    # Draft
    "Draft",
    "DraftBase",
    "DraftCreate",
    "DraftPublic",
    "DraftStatus",
    "DraftUpdate",
    "DraftWithCapability",
]
