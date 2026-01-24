"""MediaWiki import payload schemas.

Payload format documentation for MediaWiki extension team:

```json
{
  "source": "mediawiki_push",
  "wiki_url": "https://smw.example.com",
  "user": "WikiUser",
  "comment": "Updated Person category properties",
  "changes": [
    {
      "action": "modify",
      "entity_type": "category",
      "entity_key": "Person",
      "patch": [
        {"op": "replace", "path": "/description", "value": "A human being (updated)"}
      ]
    },
    {
      "action": "create",
      "entity_type": "property",
      "entity_key": "birthPlace",
      "entity": {
        "entity_key": "birthPlace",
        "label": "Birth place",
        "description": "Location where person was born",
        "data_type": "Page"
      }
    },
    {
      "action": "delete",
      "entity_type": "property",
      "entity_key": "deprecated_field"
    }
  ]
}
```

Action field meanings:
- "create": Add new entity (entity_key must NOT exist in canonical)
- "modify": Update existing entity (entity_key MUST exist in canonical)
- "delete": Remove entity (entity_key MUST exist in canonical)
"""

from typing import Literal

import jsonpatch
from pydantic import BaseModel, field_validator, model_validator

VALID_ENTITY_TYPES = {"category", "property", "subobject", "module", "bundle", "template"}


class MediaWikiChange(BaseModel):
    """Single entity change from MediaWiki.

    Explicit action field prevents ambiguity from entity_key typos.
    """

    action: Literal["create", "modify", "delete"]
    entity_type: str
    entity_key: str
    patch: list[dict] | None = None  # For action="modify"
    entity: dict | None = None  # For action="create"

    @field_validator("entity_type")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        if v not in VALID_ENTITY_TYPES:
            raise ValueError(
                f"Invalid entity_type: {v}. "
                f"Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
            )
        return v

    @field_validator("patch")
    @classmethod
    def validate_patch(cls, v: list[dict] | None) -> list[dict] | None:
        if v is None:
            return v
        try:
            jsonpatch.JsonPatch(v)
        except jsonpatch.InvalidJsonPatch as e:
            raise ValueError(f"Invalid JSON Patch: {e}")
        return v

    @model_validator(mode="after")
    def validate_action_fields(self) -> "MediaWikiChange":
        """Validate action-specific field requirements."""
        if self.action == "modify":
            if not self.patch:
                raise ValueError("action 'modify' requires patch field")
            if self.entity:
                raise ValueError("action 'modify' must not have entity field")
        elif self.action == "create":
            if not self.entity:
                raise ValueError("action 'create' requires entity field")
            if self.patch:
                raise ValueError("action 'create' must not have patch field")
            # Validate entity has required fields
            if "entity_key" not in self.entity:
                raise ValueError("entity must have 'entity_key' field")
            if self.entity["entity_key"] != self.entity_key:
                raise ValueError(
                    f"entity.entity_key ({self.entity['entity_key']}) "
                    f"must match change.entity_key ({self.entity_key})"
                )
        elif self.action == "delete":
            if self.patch or self.entity:
                raise ValueError(
                    "action 'delete' must not have patch or entity field"
                )
        return self


class MediaWikiImportPayload(BaseModel):
    """Complete payload from MediaWiki push.

    Each push creates a NEW draft (not appended to existing).
    """

    source: str = "mediawiki_push"
    wiki_url: str
    user: str
    comment: str
    changes: list[MediaWikiChange]

    @field_validator("changes")
    @classmethod
    def validate_changes_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("changes list cannot be empty")
        return v


class MediaWikiImportResponse(BaseModel):
    """Response after successful MediaWiki import."""

    draft_id: str  # UUID as string
    capability_url: str
    change_count: int
    expires_at: str  # ISO datetime
