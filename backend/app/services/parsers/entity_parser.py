"""Entity parser service for v2.0 ingest pipeline.

Parses raw JSON from labki-schemas repo into v2.0 model instances
and extracts relationships for separate relationship tables.
"""

from dataclasses import dataclass, field

from app.models.v2 import (
    Bundle,
    Category,
    EntityType,
    Module,
    Property,
    Subobject,
    Template,
)


@dataclass
class PendingRelationship:
    """Holds relationship data before UUID resolution.

    During parsing, we only have entity_keys (strings). After all entities
    are inserted and UUIDs are generated, these are resolved to proper
    relationship table rows with foreign keys.
    """

    type: str  # "category_parent", "category_property", "module_entity", "bundle_module"
    source_key: str  # entity_key of the source entity
    target_key: str  # entity_key of the target entity
    extra: dict = field(default_factory=dict)  # additional fields like is_required, entity_type


@dataclass
class ParsedEntities:
    """Container for all parsed data from a repository.

    Holds entity model instances (ready for database insertion) and
    pending relationships (need UUID resolution before insertion).
    """

    categories: list[Category]
    properties: list[Property]
    subobjects: list[Subobject]
    modules: list[Module]
    bundles: list[Bundle]
    templates: list[Template]
    relationships: list[PendingRelationship]

    def entity_counts(self) -> dict[str, int]:
        """Return counts for each entity type (for OntologyVersion tracking)."""
        return {
            "categories": len(self.categories),
            "properties": len(self.properties),
            "subobjects": len(self.subobjects),
            "modules": len(self.modules),
            "bundles": len(self.bundles),
            "templates": len(self.templates),
            "relationships": len(self.relationships),
        }


class EntityParser:
    """Parses entity JSON files into v2.0 model instances.

    Extracts relationship data (parents, properties, module membership)
    into PendingRelationship objects for later UUID resolution.
    """

    def parse_category(
        self, content: dict, source_path: str
    ) -> tuple[Category, list[PendingRelationship]]:
        """Parse category JSON into model and extracted relationships.

        Args:
            content: Parsed JSON content from category file
            source_path: Original file path, e.g., "categories/Person.json"

        Returns:
            (Category instance, list of PendingRelationship objects)
        """
        entity_key = content["id"]

        category = Category(
            entity_key=entity_key,
            source_path=source_path,
            label=content.get("label", entity_key),
            description=content.get("description"),
            canonical_json=content,
        )

        relationships: list[PendingRelationship] = []

        # Extract parent relationships
        for parent_key in content.get("parents", []):
            relationships.append(
                PendingRelationship(
                    type="category_parent",
                    source_key=entity_key,
                    target_key=parent_key,
                )
            )

        # Extract required property relationships
        for prop_key in content.get("required_properties", []):
            relationships.append(
                PendingRelationship(
                    type="category_property",
                    source_key=entity_key,
                    target_key=prop_key,
                    extra={"is_required": True},
                )
            )

        # Extract optional property relationships
        for prop_key in content.get("optional_properties", []):
            relationships.append(
                PendingRelationship(
                    type="category_property",
                    source_key=entity_key,
                    target_key=prop_key,
                    extra={"is_required": False},
                )
            )

        # Extract required subobject relationships
        for sub_key in content.get("required_subobjects", []):
            relationships.append(
                PendingRelationship(
                    type="category_subobject",
                    source_key=entity_key,
                    target_key=sub_key,
                    extra={"is_required": True},
                )
            )

        # Extract optional subobject relationships
        for sub_key in content.get("optional_subobjects", []):
            relationships.append(
                PendingRelationship(
                    type="category_subobject",
                    source_key=entity_key,
                    target_key=sub_key,
                    extra={"is_required": False},
                )
            )

        return category, relationships

    def parse_property(self, content: dict, source_path: str) -> Property:
        """Parse property JSON into model instance.

        Args:
            content: Parsed JSON content from property file
            source_path: Original file path, e.g., "properties/Has_name.json"

        Returns:
            Property instance (no relationships extracted)
        """
        entity_key = content["id"]

        return Property(
            entity_key=entity_key,
            source_path=source_path,
            label=content.get("label", entity_key),
            description=content.get("description"),
            canonical_json=content,
            # Core fields
            datatype=content.get("datatype"),
            cardinality=content.get("cardinality"),
            # Validation constraints
            allowed_values=content.get("allowed_values"),
            allowed_pattern=content.get("allowed_pattern"),
            allowed_value_list=content.get("allowed_value_list"),
            # Display configuration
            display_units=content.get("display_units"),
            display_precision=content.get("display_precision"),
            # Constraints and relationships
            unique_values=content.get("unique_values", False),
            has_display_template_key=content.get("has_display_template"),
        )

    def parse_subobject(
        self, content: dict, source_path: str
    ) -> tuple[Subobject, list[PendingRelationship]]:
        """Parse subobject JSON into model and extracted relationships.

        Args:
            content: Parsed JSON content from subobject file
            source_path: Original file path, e.g., "subobjects/Address.json"

        Returns:
            (Subobject instance, list of PendingRelationship objects)
        """
        entity_key = content["id"]

        subobject = Subobject(
            entity_key=entity_key,
            source_path=source_path,
            label=content.get("label", entity_key),
            description=content.get("description"),
            canonical_json=content,
        )

        relationships: list[PendingRelationship] = []

        # Extract required property relationships
        for prop_key in content.get("required_properties", []):
            relationships.append(
                PendingRelationship(
                    type="subobject_property",
                    source_key=entity_key,
                    target_key=prop_key,
                    extra={"is_required": True},
                )
            )

        # Extract optional property relationships
        for prop_key in content.get("optional_properties", []):
            relationships.append(
                PendingRelationship(
                    type="subobject_property",
                    source_key=entity_key,
                    target_key=prop_key,
                    extra={"is_required": False},
                )
            )

        return subobject, relationships

    def parse_module(
        self, content: dict, source_path: str
    ) -> tuple[Module, list[PendingRelationship]]:
        """Parse module JSON into model and extracted relationships.

        Args:
            content: Parsed JSON content from module file
            source_path: Original file path, e.g., "modules/Core.json"

        Returns:
            (Module instance, list of PendingRelationship objects)
        """
        entity_key = content["id"]

        module = Module(
            entity_key=entity_key,
            source_path=source_path,
            version=content.get("version"),
            label=content.get("label", entity_key),
            description=content.get("description"),
            canonical_json=content,
        )

        relationships: list[PendingRelationship] = []

        # Extract category memberships
        for cat_key in content.get("categories", []):
            relationships.append(
                PendingRelationship(
                    type="module_entity",
                    source_key=entity_key,
                    target_key=cat_key,
                    extra={"entity_type": EntityType.CATEGORY},
                )
            )

        # Extract property memberships
        for prop_key in content.get("properties", []):
            relationships.append(
                PendingRelationship(
                    type="module_entity",
                    source_key=entity_key,
                    target_key=prop_key,
                    extra={"entity_type": EntityType.PROPERTY},
                )
            )

        # Extract subobject memberships
        for sub_key in content.get("subobjects", []):
            relationships.append(
                PendingRelationship(
                    type="module_entity",
                    source_key=entity_key,
                    target_key=sub_key,
                    extra={"entity_type": EntityType.SUBOBJECT},
                )
            )

        # Extract template memberships
        for tmpl_key in content.get("templates", []):
            relationships.append(
                PendingRelationship(
                    type="module_entity",
                    source_key=entity_key,
                    target_key=tmpl_key,
                    extra={"entity_type": EntityType.TEMPLATE},
                )
            )

        # Extract module dependencies
        for dep_key in content.get("dependencies", []):
            relationships.append(
                PendingRelationship(
                    type="module_dependency",
                    source_key=entity_key,
                    target_key=dep_key,
                )
            )

        return module, relationships

    def parse_bundle(
        self, content: dict, source_path: str
    ) -> tuple[Bundle, list[PendingRelationship]]:
        """Parse bundle JSON into model and extracted relationships.

        Args:
            content: Parsed JSON content from bundle file
            source_path: Original file path, e.g., "bundles/Default.json"

        Returns:
            (Bundle instance, list of PendingRelationship objects)
        """
        entity_key = content["id"]

        bundle = Bundle(
            entity_key=entity_key,
            source_path=source_path,
            version=content.get("version"),
            label=content.get("label", entity_key),
            description=content.get("description"),
            canonical_json=content,
        )

        relationships: list[PendingRelationship] = []

        # Extract module memberships
        for module_key in content.get("modules", []):
            relationships.append(
                PendingRelationship(
                    type="bundle_module",
                    source_key=entity_key,
                    target_key=module_key,
                )
            )

        return bundle, relationships

    def parse_template(self, content: dict, source_path: str) -> Template:
        """Parse template JSON into model instance.

        Args:
            content: Parsed JSON content from template file
            source_path: Original file path, e.g., "templates/Property/Page.json"

        Returns:
            Template instance (no relationships extracted)

        Note:
            Template entity_key may include "/" for nested templates
            (e.g., "Property/Page" from templates/Property/Page.json)
        """
        entity_key = content["id"]

        return Template(
            entity_key=entity_key,
            source_path=source_path,
            label=content.get("label", entity_key),
            description=content.get("description"),
            wikitext=content.get("wikitext"),
            canonical_json=content,
        )

    def parse_all(self, files: dict[str, list[tuple[str, dict]]]) -> ParsedEntities:
        """Parse all entity files from a repository.

        Args:
            files: Dict mapping entity type to list of (path, content) tuples.
                   e.g., {"categories": [("categories/Person.json", {...}), ...], ...}

        Returns:
            ParsedEntities container with all models and pending relationships.
        """
        categories: list[Category] = []
        properties: list[Property] = []
        subobjects: list[Subobject] = []
        modules: list[Module] = []
        bundles: list[Bundle] = []
        templates: list[Template] = []
        relationships: list[PendingRelationship] = []

        # Parse categories
        for path, content in files.get("categories", []):
            category, rels = self.parse_category(content, path)
            categories.append(category)
            relationships.extend(rels)

        # Parse properties
        for path, content in files.get("properties", []):
            prop = self.parse_property(content, path)
            properties.append(prop)

        # Parse subobjects
        for path, content in files.get("subobjects", []):
            subobj, rels = self.parse_subobject(content, path)
            subobjects.append(subobj)
            relationships.extend(rels)

        # Parse modules
        for path, content in files.get("modules", []):
            module, rels = self.parse_module(content, path)
            modules.append(module)
            relationships.extend(rels)

        # Parse bundles
        for path, content in files.get("bundles", []):
            bundle, rels = self.parse_bundle(content, path)
            bundles.append(bundle)
            relationships.extend(rels)

        # Parse templates
        for path, content in files.get("templates", []):
            template = self.parse_template(content, path)
            templates.append(template)

        return ParsedEntities(
            categories=categories,
            properties=properties,
            subobjects=subobjects,
            modules=modules,
            bundles=bundles,
            templates=templates,
            relationships=relationships,
        )
