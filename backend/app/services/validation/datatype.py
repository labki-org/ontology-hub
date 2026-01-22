"""Datatype validation against SemanticMediaWiki allowed types."""

from app.models.draft import DraftPayload
from app.schemas.validation import ValidationResult

# SemanticMediaWiki allowed datatypes
# Reference: https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes
ALLOWED_DATATYPES = {
    "Annotation URI",
    "Boolean",
    "Code",
    "Date",
    "Email",
    "External identifier",
    "Geographic coordinates",
    "Keyword",
    "Monolingual text",
    "Number",
    "Page",
    "Quantity",
    "Record",
    "Reference",
    "Telephone number",
    "Temperature",
    "Text",
    "URL",
}


def check_datatypes(payload: DraftPayload) -> list[ValidationResult]:
    """Check property datatypes are in the allowed set.

    Args:
        payload: Draft payload containing properties

    Returns:
        List of ValidationResult for invalid datatypes
    """
    results: list[ValidationResult] = []

    for prop in payload.entities.properties:
        schema = prop.schema_definition
        datatype = schema.get("datatype")

        if datatype and datatype not in ALLOWED_DATATYPES:
            results.append(
                ValidationResult(
                    entity_type="property",
                    entity_id=prop.entity_id,
                    field="datatype",
                    code="INVALID_DATATYPE",
                    message=f"Datatype '{datatype}' is not valid. Allowed: {', '.join(sorted(ALLOWED_DATATYPES))}",
                    severity="error",
                )
            )

    return results
