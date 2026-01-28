"""Draft change schemas for v2.0 API request/response validation.

Provides Pydantic schemas for draft change management with JSON Patch
validation using the jsonpatch library (RFC 6902 compliance).
"""

from datetime import datetime
from uuid import UUID

import jsonpatch
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.v2 import ChangeType

# Valid entity types for draft changes
VALID_ENTITY_TYPES = frozenset(
    {"category", "property", "subobject", "module", "bundle", "template", "dashboard", "resource"}
)

# Valid JSON Patch operations (RFC 6902)
VALID_PATCH_OPS = frozenset({"add", "remove", "replace", "move", "copy", "test"})


class DraftChangeCreate(BaseModel):
    """Request schema for adding a change to a draft.

    For UPDATE operations, patch contains RFC 6902 JSON Patch operations.
    For CREATE operations, replacement_json contains the full entity definition.
    For DELETE operations, both patch and replacement_json must be None.
    """

    change_type: ChangeType
    entity_type: str
    entity_key: str
    patch: list[dict] | None = None
    replacement_json: dict | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("patch")
    @classmethod
    def validate_patch(cls, v: list[dict] | None) -> list[dict] | None:
        """Validate JSON Patch format against RFC 6902.

        Args:
            v: The patch value to validate

        Returns:
            The validated patch or None

        Raises:
            ValueError: If patch format is invalid
        """
        if v is None:
            return None

        if not isinstance(v, list):
            raise ValueError("patch must be a list of operations")

        for op in v:
            if not isinstance(op, dict):
                raise ValueError("each patch operation must be a dict")
            if "op" not in op:
                raise ValueError("patch operation missing 'op' field")
            if "path" not in op:
                raise ValueError("patch operation missing 'path' field")
            if op["op"] not in VALID_PATCH_OPS:
                raise ValueError(
                    f"invalid patch op '{op['op']}', "
                    f"must be one of: {', '.join(sorted(VALID_PATCH_OPS))}"
                )

        # Validate using jsonpatch library - raises InvalidJsonPatch on error
        try:
            jsonpatch.JsonPatch(v)
        except jsonpatch.InvalidJsonPatch as e:
            raise ValueError(f"invalid JSON Patch: {e}") from e

        return v

    @model_validator(mode="after")
    def validate_change_type_fields(self) -> "DraftChangeCreate":
        """Validate that fields are appropriate for the change type.

        - UPDATE requires patch, must not have replacement_json
        - CREATE requires replacement_json, must not have patch
        - DELETE must not have patch or replacement_json
        """
        # Validate entity_type
        if self.entity_type not in VALID_ENTITY_TYPES:
            raise ValueError(
                f"invalid entity_type '{self.entity_type}', "
                f"must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
            )

        # Validate fields based on change_type
        if self.change_type == ChangeType.UPDATE:
            if self.patch is None:
                raise ValueError("UPDATE change requires 'patch' field")
            if self.replacement_json is not None:
                raise ValueError("UPDATE change must not have 'replacement_json' field")

        elif self.change_type == ChangeType.CREATE:
            if self.replacement_json is None:
                raise ValueError("CREATE change requires 'replacement_json' field")
            if self.patch is not None:
                raise ValueError("CREATE change must not have 'patch' field")

        elif self.change_type == ChangeType.DELETE:
            if self.patch is not None:
                raise ValueError("DELETE change must not have 'patch' field")
            if self.replacement_json is not None:
                raise ValueError("DELETE change must not have 'replacement_json' field")

        return self


class DraftChangeResponse(BaseModel):
    """Response schema for a single draft change."""

    id: UUID
    change_type: ChangeType
    entity_type: str
    entity_key: str
    patch: list[dict] | None = None
    replacement_json: dict | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DraftChangesListResponse(BaseModel):
    """Response schema for listing all changes in a draft."""

    changes: list[DraftChangeResponse]
    total: int
