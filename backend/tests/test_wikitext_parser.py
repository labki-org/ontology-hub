"""Tests for wikitext parser and generator round-trip fidelity."""

from app.services.generators.wikitext_generator import (
    generate_category_wikitext,
    generate_property_wikitext,
    generate_resource_wikitext,
    generate_subobject_wikitext,
)
from app.services.parsers.wikitext_parser import (
    extract_annotations,
    extract_categories,
    parse_category_wikitext,
    parse_module_vocab,
    parse_property_wikitext,
    parse_resource_wikitext,
    parse_subobject_wikitext,
    parse_template_wikitext,
    to_entity_key,
    to_page_name,
)


class TestNameConversion:
    def test_to_page_name(self):
        assert to_page_name("Has_name") == "Has name"
        assert to_page_name("Person") == "Person"

    def test_to_entity_key(self):
        assert to_entity_key("Has name") == "Has_name"
        assert to_entity_key("Person") == "Person"


class TestExtractAnnotations:
    def test_basic(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Text]]
[[Has description::The name]]
<!-- OntologySync End -->"""

        ann = extract_annotations(wikitext)
        assert ann["Has type"] == ["Text"]
        assert ann["Has description"] == ["The name"]

    def test_multi_value(self):
        wikitext = """<!-- OntologySync Start -->
[[Has required property::Property:Has name]]
[[Has required property::Property:Has email]]
<!-- OntologySync End -->"""

        ann = extract_annotations(wikitext)
        assert ann["Has required property"] == [
            "Property:Has name",
            "Property:Has email",
        ]

    def test_ignores_outside_block(self):
        wikitext = """[[Outside::value]]
<!-- OntologySync Start -->
[[Inside::value]]
<!-- OntologySync End -->
[[Also outside::value]]"""

        ann = extract_annotations(wikitext)
        assert len(ann) == 1
        assert "Inside" in ann


class TestExtractCategories:
    def test_extracts_outside_block(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Text]]
<!-- OntologySync End -->
[[Category:Person]]
[[Category:OntologySync-managed-resource]]"""

        cats = extract_categories(wikitext)
        assert cats == ["Person", "OntologySync-managed-resource"]


class TestParseCategory:
    def test_full_category(self):
        wikitext = """<!-- OntologySync Start -->
[[Has description::A human being]]
[[Display label::Person]]
[[Has parent category::Category:Agent]]
[[Has required property::Property:Has name]]
[[Has optional property::Property:Has email]]
[[Has optional subobject::Subobject:Address]]
<!-- OntologySync End -->
[[Category:OntologySync-managed]]"""

        result = parse_category_wikitext(wikitext, "Person")
        assert result["id"] == "Person"
        assert result["label"] == "Person"
        assert result["description"] == "A human being"
        assert result["parents"] == ["Agent"]
        assert result["required_properties"] == ["Has_name"]
        assert result["optional_properties"] == ["Has_email"]
        assert result["optional_subobjects"] == ["Address"]

    def test_minimal_category(self):
        wikitext = """<!-- OntologySync Start -->
[[Has description::Base agent]]
<!-- OntologySync End -->
[[Category:OntologySync-managed]]"""

        result = parse_category_wikitext(wikitext, "Agent")
        assert result["id"] == "Agent"
        assert "parents" not in result
        assert "required_properties" not in result


class TestParseProperty:
    def test_simple_text(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Text]]
[[Has description::The name of an entity]]
[[Display label::Name]]
<!-- OntologySync End -->
[[Category:OntologySync-managed-property]]"""

        result = parse_property_wikitext(wikitext, "Has_name")
        assert result["datatype"] == "Text"
        assert result["cardinality"] == "single"
        assert result["label"] == "Name"

    def test_multiple_cardinality(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Email]]
[[Has description::Email address]]
[[Display label::Email]]
[[Allows multiple values::true]]
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_email")
        assert result["cardinality"] == "multiple"

    def test_allowed_values(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Text]]
[[Has description::Status]]
[[Allows value::Active]]
[[Allows value::Inactive]]
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_status")
        assert result["allowed_values"] == ["Active", "Inactive"]

    def test_display_template(self):
        wikitext = """<!-- OntologySync Start -->
[[Has type::Page]]
[[Has description::Related page]]
[[Has template::Template:Property/Page]]
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_related")
        assert result["has_display_template"] == "Property/Page"


class TestParseSubobject:
    def test_with_properties(self):
        wikitext = """<!-- OntologySync Start -->
[[Has description::A physical address]]
[[Has required property::Property:Has street]]
[[Has required property::Property:Has city]]
[[Has optional property::Property:Has postal code]]
<!-- OntologySync End -->"""

        result = parse_subobject_wikitext(wikitext, "Address")
        assert result["required_properties"] == ["Has_street", "Has_city"]
        assert result["optional_properties"] == ["Has_postal_code"]


class TestParseTemplate:
    def test_raw_wikitext(self):
        wikitext = "<includeonly>{{{value|}}}</includeonly>\n"
        result = parse_template_wikitext(wikitext, "Property/Page")
        assert result["id"] == "Property/Page"
        assert result["wikitext"] == "<includeonly>{{{value|}}}</includeonly>"


class TestParseResource:
    def test_with_properties(self):
        wikitext = """<!-- OntologySync Start -->
[[Display label::John Doe]]
[[Has name::John Doe]]
[[Has email::john@example.com]]
<!-- OntologySync End -->
[[Category:Person]]
[[Category:OntologySync-managed-resource]]"""

        result = parse_resource_wikitext(wikitext, "Person/John_doe")
        assert result["categories"] == ["Person"]
        assert result["Has_name"] == "John Doe"
        assert result["Has_email"] == "john@example.com"


class TestParseModuleVocab:
    def test_extracts_entity_lists(self):
        vocab = {
            "id": "Core",
            "version": "1.0.0",
            "label": "Core Module",
            "description": "Core",
            "dependencies": [],
            "import": [
                {
                    "page": "Person",
                    "namespace": "NS_CATEGORY",
                    "contents": {"importFrom": "categories/Person.wikitext"},
                },
                {
                    "page": "Has name",
                    "namespace": "SMW_NS_PROPERTY",
                    "contents": {"importFrom": "properties/Has_name.wikitext"},
                },
            ],
            "meta": {"version": "1"},
        }

        result = parse_module_vocab(vocab)
        assert result["id"] == "Core"
        assert result["categories"] == ["Person"]
        assert result["properties"] == ["Has_name"]


# ─── Round-trip tests ────────────────────────────────────────────────────────


class TestCategoryRoundTrip:
    def test_full(self):
        original = {
            "id": "Person",
            "label": "Human Person",
            "description": "A human being",
            "parents": ["Agent"],
            "required_properties": ["Has_name"],
            "optional_properties": ["Has_email"],
            "optional_subobjects": ["Address"],
        }

        wikitext = generate_category_wikitext(original)
        parsed = parse_category_wikitext(wikitext, "Person")

        assert parsed["id"] == original["id"]
        assert parsed["label"] == original["label"]
        assert parsed["description"] == original["description"]
        assert parsed["parents"] == original["parents"]
        assert parsed["required_properties"] == original["required_properties"]
        assert parsed["optional_properties"] == original["optional_properties"]
        assert parsed["optional_subobjects"] == original["optional_subobjects"]

    def test_label_matches_page_name_omitted(self):
        original = {"id": "Person", "label": "Person", "description": "A person"}
        wikitext = generate_category_wikitext(original)
        assert "Display label" not in wikitext

        parsed = parse_category_wikitext(wikitext, "Person")
        assert parsed["label"] == "Person"


class TestPropertyRoundTrip:
    def test_simple(self):
        original = {
            "id": "Has_name",
            "label": "Name",
            "description": "The name",
            "datatype": "Text",
            "cardinality": "single",
        }
        wikitext = generate_property_wikitext(original)
        parsed = parse_property_wikitext(wikitext, "Has_name")

        assert parsed["datatype"] == "Text"
        assert parsed["cardinality"] == "single"
        assert parsed["label"] == "Name"

    def test_multiple_cardinality(self):
        original = {
            "id": "Has_email",
            "label": "Email",
            "description": "Email",
            "datatype": "Email",
            "cardinality": "multiple",
        }
        wikitext = generate_property_wikitext(original)
        parsed = parse_property_wikitext(wikitext, "Has_email")
        assert parsed["cardinality"] == "multiple"


class TestSubobjectRoundTrip:
    def test_full(self):
        original = {
            "id": "Address",
            "label": "Address",
            "description": "An address",
            "required_properties": ["Has_street", "Has_city"],
            "optional_properties": ["Has_postal_code"],
        }
        wikitext = generate_subobject_wikitext(original)
        parsed = parse_subobject_wikitext(wikitext, "Address")

        assert parsed["required_properties"] == original["required_properties"]
        assert parsed["optional_properties"] == original["optional_properties"]


class TestResourceRoundTrip:
    def test_with_properties(self):
        original = {
            "id": "Person/John_doe",
            "label": "John Doe",
            "description": "Example",
            "categories": ["Person"],
            "Has_name": "John Doe",
            "Has_email": "john@example.com",
        }
        wikitext = generate_resource_wikitext(original)
        parsed = parse_resource_wikitext(wikitext, "Person/John_doe")

        assert parsed["categories"] == ["Person"]
        assert parsed["Has_name"] == "John Doe"
        assert parsed["Has_email"] == "john@example.com"

    def test_multi_category_round_trip(self):
        original = {
            "id": "Lab/Microscope_1",
            "label": "Microscope 1",
            "description": "A microscope",
            "categories": ["Equipment", "Lab_item"],
            "Has_name": "Microscope 1",
        }
        wikitext = generate_resource_wikitext(original)
        parsed = parse_resource_wikitext(wikitext, "Lab/Microscope_1")

        assert set(parsed["categories"]) == {"Equipment", "Lab_item"}
        assert parsed["Has_name"] == "Microscope 1"


class TestModuleVocabRoundTrip:
    def test_parse_module_vocab(self):
        """Test parsing a vocab.json structure (for backward compat with existing repos)."""
        vocab = {
            "id": "Core",
            "version": "1.0.0",
            "label": "Core Module",
            "description": "Core entities",
            "dependencies": [],
            "import": [
                {
                    "page": "Person",
                    "namespace": "NS_CATEGORY",
                    "contents": {"importFrom": "categories/Person.wikitext"},
                    "options": {"replaceable": True},
                },
                {
                    "page": "Agent",
                    "namespace": "NS_CATEGORY",
                    "contents": {"importFrom": "categories/Agent.wikitext"},
                    "options": {"replaceable": True},
                },
                {
                    "page": "Has_name",
                    "namespace": "SMW_NS_PROPERTY",
                    "contents": {"importFrom": "properties/Has_name.wikitext"},
                    "options": {"replaceable": True},
                },
                {
                    "page": "Address",
                    "namespace": "NS_SUBOBJECT",
                    "contents": {"importFrom": "subobjects/Address.wikitext"},
                    "options": {"replaceable": True},
                },
            ],
        }
        parsed = parse_module_vocab(vocab)

        assert parsed["id"] == "Core"
        assert parsed["version"] == "1.0.0"
        assert set(parsed["categories"]) == {"Person", "Agent"}
        assert parsed["properties"] == ["Has_name"]
        assert parsed["subobjects"] == ["Address"]
