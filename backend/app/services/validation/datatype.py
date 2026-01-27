"""Datatype validation against SemanticMediaWiki allowed types."""

# SemanticMediaWiki allowed datatypes
# Source of truth: labki-ontology/properties/_schema.json
# Reference: https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes
#
# IMPORTANT: Keep this in sync with the enum in labki-ontology properties/_schema.json
# This provides fallback validation when GitHub schema fetch is unavailable.
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
