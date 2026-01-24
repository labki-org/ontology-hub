"""JSON Schema validation for entity files."""

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError


class SchemaValidator:
    """Validate entity JSON files against _schema.json schemas.

    Compiles validators once at initialization for performance.
    """

    def __init__(self, schemas: dict[str, dict]):
        """Initialize with pre-loaded schemas.

        Args:
            schemas: {"categories": {...}, "properties": {...}, ...}
                     Maps entity type to its JSON Schema.
        """
        self._validators: dict[str, Draft202012Validator] = {}
        self._schema_errors: list[str] = []

        for entity_type, schema in schemas.items():
            try:
                Draft202012Validator.check_schema(schema)
                self._validators[entity_type] = Draft202012Validator(schema)
            except SchemaError as e:
                self._schema_errors.append(
                    f"Invalid schema for {entity_type}: {e.message}"
                )

    @property
    def schema_errors(self) -> list[str]:
        """Return errors from schema compilation (invalid schemas)."""
        return self._schema_errors

    def validate(
        self,
        entity_type: str,
        data: dict,
        source_path: str,
    ) -> list[str]:
        """Validate entity data against its schema.

        Args:
            entity_type: Type key (e.g., "categories", "properties")
            data: Parsed JSON content
            source_path: File path for error messages

        Returns:
            List of error messages (empty if valid)
        """
        if entity_type not in self._validators:
            return [f"No validator for entity type: {entity_type}"]

        errors = []
        for error in self._validators[entity_type].iter_errors(data):
            json_path = error.json_path or "$"
            errors.append(f"{source_path}: {error.message} at {json_path}")
        return errors

    def validate_all(
        self,
        entities: dict[str, list[tuple[str, dict]]],
    ) -> list[str]:
        """Validate all entities at once.

        Args:
            entities: {entity_type: [(source_path, data), ...]}

        Returns:
            List of all validation errors
        """
        all_errors = list(self._schema_errors)  # Include schema compilation errors

        for entity_type, items in entities.items():
            for source_path, data in items:
                all_errors.extend(self.validate(entity_type, data, source_path))

        return all_errors
