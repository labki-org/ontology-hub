"""v2 Entity response schemas with draft change status metadata.

Provides response models for v2.0 entity endpoints that support
both canonical data and draft overlay contexts. All entities in
draft context include change_status metadata.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# Change status type for draft overlay
ChangeStatus = Literal["added", "modified", "deleted", "unchanged"]


class EntityWithStatus(BaseModel):
    """Base model for entities with draft change status.

    Used for list items where minimal metadata is needed.
    """

    entity_key: str
    label: str
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status (added/modified/deleted/unchanged)",
    )
    deleted: bool = Field(
        default=False,
        validation_alias="_deleted",
        description="True if entity is deleted in draft context",
    )

    model_config = ConfigDict(populate_by_name=True)


class PropertyProvenance(BaseModel):
    """Property with inheritance provenance information.

    Used in category detail to show where properties come from.
    """

    entity_key: str
    label: str
    is_direct: bool = Field(description="True if property is directly assigned to this category")
    is_inherited: bool = Field(description="True if property is inherited from parent category")
    is_required: bool = Field(description="True if property is required")
    source_category: str = Field(description="Entity key of category that defines this property")
    inheritance_depth: int = Field(
        description="0 for direct, >0 for inherited (depth in hierarchy)"
    )


class SubobjectProvenance(BaseModel):
    """Subobject assignment information for categories.

    Used in category detail to show required/optional subobjects.
    """

    entity_key: str
    label: str
    is_required: bool = Field(description="True if subobject is required")


class CategoryDetailResponse(BaseModel):
    """Detailed category response with parents, properties, and subobjects.

    Includes full property provenance for inheritance visualization.
    """

    entity_key: str
    label: str
    description: str | None = None
    parents: list[str] = Field(default_factory=list, description="Entity keys of parent categories")
    properties: list[PropertyProvenance] = Field(
        default_factory=list,
        description="Properties with provenance (direct + inherited)",
    )
    subobjects: list[SubobjectProvenance] = Field(
        default_factory=list,
        description="Subobjects assigned to this category (required + optional)",
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )
    patch_error: str | None = Field(
        default=None,
        validation_alias="_patch_error",
        description="Error if JSON Patch failed to apply",
    )

    model_config = ConfigDict(populate_by_name=True)


class PropertyDetailResponse(BaseModel):
    """Detailed property response."""

    entity_key: str
    label: str
    description: str | None = None
    datatype: str = Field(description="Property data type")
    cardinality: str = Field(description="Property cardinality (single/multiple)")
    # Validation constraints
    allowed_values: list[str] | None = Field(
        default=None, description="Enumeration of permitted values"
    )
    allowed_pattern: str | None = Field(
        default=None, description="Regex pattern for validating values"
    )
    allowed_value_list: str | None = Field(
        default=None, description="Reference to a wiki page containing allowed values"
    )
    # Display configuration
    display_units: list[str] | None = Field(
        default=None, description="Units or formats for display"
    )
    display_precision: int | None = Field(
        default=None, description="Number of decimal places for numeric display"
    )
    # Constraints and relationships
    unique_values: bool = Field(
        default=False,
        description="If true, each value can only be assigned once across all pages",
    )
    has_display_template: str | None = Field(
        default=None, description="Template entity key for custom rendering"
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class SubobjectPropertyInfo(BaseModel):
    """Property assignment info for subobjects."""

    entity_key: str
    label: str
    is_required: bool = Field(description="True if property is required")


class SubobjectDetailResponse(BaseModel):
    """Detailed subobject response with required and optional properties."""

    entity_key: str
    label: str
    description: str | None = None
    required_properties: list[SubobjectPropertyInfo] = Field(
        default_factory=list, description="Required property assignments"
    )
    optional_properties: list[SubobjectPropertyInfo] = Field(
        default_factory=list, description="Optional property assignments"
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class TemplateDetailResponse(BaseModel):
    """Detailed template response."""

    entity_key: str
    label: str
    description: str | None = None
    wikitext: str | None = Field(default=None, description="Template wikitext content")
    property_key: str | None = Field(default=None, description="Associated property entity key")
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class ModuleDetailResponse(BaseModel):
    """Detailed module response with entities, dependencies, and closure.

    Entities are grouped by type for easy UI rendering.
    Closure contains computed transitive dependencies.
    """

    entity_key: str
    label: str
    version: str | None = None
    description: str | None = None
    entities: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Entities by type: {category: [...], property: [...], ...}",
    )
    dependencies: list[str] = Field(
        default_factory=list,
        description="Module entity keys that this module depends on",
    )
    closure: list[str] = Field(
        default_factory=list,
        description="Computed transitive category dependencies (entity keys)",
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class BundleDetailResponse(BaseModel):
    """Detailed bundle response with modules and closure.

    Closure contains computed transitive module dependencies.
    """

    entity_key: str
    label: str
    version: str | None = None
    modules: list[str] = Field(
        default_factory=list, description="Module entity keys in this bundle"
    )
    closure: list[str] = Field(
        default_factory=list,
        description="Computed transitive module closure (all modules including dependencies)",
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class EntityListResponse(BaseModel):
    """Generic paginated list response for entities.

    Uses cursor-based pagination on entity_key for efficient
    traversal of large result sets.
    """

    items: list[EntityWithStatus]
    next_cursor: str | None = Field(
        default=None,
        description="Entity key to use for fetching next page (None if no more)",
    )
    has_next: bool = Field(description="Whether more results exist after this page")


class DashboardPage(BaseModel):
    """Dashboard page with wikitext content."""

    name: str = Field(description="Page name (empty string for root page)")
    wikitext: str = Field(description="MediaWiki wikitext content")


class DashboardDetailResponse(BaseModel):
    """Detailed dashboard response with pages array."""

    entity_key: str
    label: str
    description: str | None = None
    pages: list[DashboardPage] = Field(
        default_factory=list, description="Dashboard pages with wikitext content"
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)


class ResourceDetailResponse(BaseModel):
    """Detailed resource response with dynamic properties."""

    entity_key: str
    label: str
    description: str | None = None
    category_key: str = Field(description="Category this resource belongs to")
    properties: dict[str, Any] = Field(
        default_factory=dict, description="Dynamic property values"
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False, validation_alias="_deleted", description="Deleted in draft"
    )

    model_config = ConfigDict(populate_by_name=True)
