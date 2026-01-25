"""JSON Schema validation against _schema.json definitions for v2 drafts.

Validates effective entity JSON against _schema.json definitions from the canonical repo.
"""

import logging

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.schemas.validation_v2 import ValidationResultV2
from app.services.github import GitHubClient

logger = logging.getLogger(__name__)

# Entity type to schema path mapping (same as ingest_v2.py)
ENTITY_SCHEMA_PATHS = {
    "category": "categories/_schema.json",
    "property": "properties/_schema.json",
    "subobject": "subobjects/_schema.json",
    "module": "modules/_schema.json",
    "bundle": "bundles/_schema.json",
    "template": "templates/_schema.json",
}


async def check_schema_v2(
    effective_entities: dict[str, dict[str, dict]],
    session: AsyncSession,
) -> list[ValidationResultV2]:
    """Validate effective entity JSON against _schema.json definitions.

    This loads the _schema.json files from the canonical GitHub repository
    and validates each effective entity against its type's schema.

    Args:
        effective_entities: Dict like {"category": {"Person": {...}, ...}, ...}
        session: Async database session (not used but kept for consistency)

    Returns:
        List of ValidationResultV2 for schema violations
    """
    results: list[ValidationResultV2] = []

    # Load schemas from GitHub
    schemas = await _load_schemas_from_github()

    # Validate each entity type
    for entity_type, entities in effective_entities.items():
        # Get schema for this entity type
        schema = schemas.get(entity_type)

        if not schema:
            # No schema found - log info but don't error
            # Some entity types may not have schemas yet
            logger.info(f"No _schema.json found for entity type: {entity_type}")
            continue

        # Create validator for this schema
        try:
            validator = Draft202012Validator(schema)
        except Exception as e:
            # Schema itself is invalid - log error but continue
            logger.error(f"Invalid _schema.json for {entity_type}: {e}")
            continue

        # Validate each entity of this type
        for entity_key, entity_json in entities.items():
            # Skip deleted entities
            if entity_json.get("_deleted"):
                continue

            # Remove metadata fields before validation
            # These are added by DraftOverlayService and aren't part of canonical JSON
            entity_data = {
                k: v for k, v in entity_json.items()
                if not k.startswith("_")
            }

            # Validate against schema
            errors = list(validator.iter_errors(entity_data))

            for error in errors:
                # Convert JSON Schema error to ValidationResultV2
                field_path = _format_json_path(error.path)
                message = _format_error_message(error)

                results.append(
                    ValidationResultV2(
                        entity_type=entity_type,
                        entity_key=entity_key,
                        field_path=field_path,
                        code="SCHEMA_VIOLATION",
                        message=message,
                        severity="error",
                    )
                )

    return results


async def _load_schemas_from_github() -> dict[str, dict]:
    """Load _schema.json files from GitHub canonical repo.

    Returns:
        Dict mapping entity type to schema JSON
    """
    schemas = {}

    # Initialize GitHub client
    github = GitHubClient(token=settings.GITHUB_TOKEN)

    # Load each schema file
    for entity_type, schema_path in ENTITY_SCHEMA_PATHS.items():
        try:
            schema_json = await github.get_file_content(
                owner=settings.GITHUB_REPO_OWNER,
                repo=settings.GITHUB_REPO_NAME,
                path=schema_path,
                ref="main",  # Use main branch for schema validation
            )
            schemas[entity_type] = schema_json
        except Exception as e:
            # Schema not found - log warning but continue
            # Some entity types may not have schemas yet
            logger.warning(f"Could not load {schema_path}: {e}")

    return schemas


def _format_json_path(path_deque) -> str:
    """Format jsonschema path deque as JSON pointer string.

    Args:
        path_deque: collections.deque from jsonschema error.path

    Returns:
        JSON pointer string like "/properties/0" or "/label"
    """
    if not path_deque:
        return "/"

    # Convert deque to list and join with /
    path_parts = list(path_deque)
    return "/" + "/".join(str(p) for p in path_parts)


def _format_error_message(error: JsonSchemaValidationError) -> str:
    """Format jsonschema error into human-readable message.

    Args:
        error: ValidationError from jsonschema

    Returns:
        Human-readable error message
    """
    # Get the validation rule that failed
    validator_name = error.validator

    # Common patterns
    if validator_name == "required":
        missing_prop = error.message.split("'")[1] if "'" in error.message else "field"
        return f"Missing required field '{missing_prop}'"

    elif validator_name == "type":
        expected_type = error.validator_value
        return f"Invalid type: expected {expected_type}"

    elif validator_name == "enum":
        allowed_values = ", ".join(str(v) for v in error.validator_value)
        return f"Value must be one of: {allowed_values}"

    elif validator_name == "pattern":
        return f"Value does not match required pattern: {error.validator_value}"

    elif validator_name == "minItems":
        return f"Array must have at least {error.validator_value} items"

    elif validator_name == "maxItems":
        return f"Array must have at most {error.validator_value} items"

    elif validator_name == "minLength":
        return f"String must be at least {error.validator_value} characters"

    elif validator_name == "maxLength":
        return f"String must be at most {error.validator_value} characters"

    else:
        # Fallback to original message
        return error.message
