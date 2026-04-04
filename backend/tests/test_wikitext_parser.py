"""Tests for wikitext parser and generator round-trip fidelity."""

from app.services.generators.wikitext_generator import (
    generate_category_wikitext,
    generate_property_wikitext,
    generate_resource_wikitext,
    generate_subobject_wikitext,
)
from app.services.parsers.wikitext_parser import (
    _extract_template_call,
    _split_comma,
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


class TestExtractTemplateCall:
    def test_basic(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_type=Text
|has_description=The name
}}
<!-- OntologySync End -->"""

        name, params = _extract_template_call(wikitext)
        assert name == "Property"
        assert params["has_type"] == "Text"
        assert params["has_description"] == "The name"

    def test_multi_value_comma_separated(self):
        wikitext = """<!-- OntologySync Start -->
{{Category
|has_required_property=Has name, Has email
}}
<!-- OntologySync End -->"""

        name, params = _extract_template_call(wikitext)
        assert name == "Category"
        assert params["has_required_property"] == "Has name, Has email"

    def test_ignores_empty_params(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_type=Text
}}
<!-- OntologySync End -->"""

        _, params = _extract_template_call(wikitext)
        assert "has_description" not in params

    def test_no_markers(self):
        wikitext = "{{Property|has_type=Text}}"
        name, params = _extract_template_call(wikitext)
        assert name == ""
        assert params == {}


class TestSplitComma:
    def test_basic(self):
        assert _split_comma("Dog, Cat, Mouse") == ["Dog", "Cat", "Mouse"]

    def test_single(self):
        assert _split_comma("Dog") == ["Dog"]

    def test_empty(self):
        assert _split_comma("") == []


class TestExtractCategories:
    def test_extracts_outside_block(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_type=Text
}}
<!-- OntologySync End -->
[[Category:Person]]
[[Category:OntologySync-managed-resource]]"""

        cats = extract_categories(wikitext)
        assert cats == ["Person", "OntologySync-managed-resource"]


class TestParseCategory:
    def test_full_category(self):
        wikitext = """<!-- OntologySync Start -->
{{Category
|has_description=A human being
|display_label=Person
|has_parent_category=Agent
|has_required_property=Has name
|has_optional_property=Has email
|has_optional_subobject=Address
}}
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
{{Category
|has_description=Base agent
}}
<!-- OntologySync End -->
[[Category:OntologySync-managed]]"""

        result = parse_category_wikitext(wikitext, "Agent")
        assert result["id"] == "Agent"
        assert "parents" not in result
        assert "required_properties" not in result

    def test_multiple_parents(self):
        wikitext = """<!-- OntologySync Start -->
{{Category
|has_description=A researcher
|has_parent_category=Person, Staff
}}
<!-- OntologySync End -->
[[Category:OntologySync-managed]]"""

        result = parse_category_wikitext(wikitext, "Researcher")
        assert result["parents"] == ["Person", "Staff"]


class TestParseProperty:
    def test_simple_text(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=The name of an entity
|has_type=Text
|display_label=Name
}}
<!-- OntologySync End -->
[[Category:OntologySync-managed-property]]"""

        result = parse_property_wikitext(wikitext, "Has_name")
        assert result["datatype"] == "Text"
        assert result["cardinality"] == "single"
        assert result["label"] == "Name"

    def test_multiple_cardinality(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=Email address
|has_type=Email
|display_label=Email
|allows_multiple_values=Yes
}}
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_email")
        assert result["cardinality"] == "multiple"

    def test_allowed_values(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=Status
|has_type=Text
|allows_value=Active, Inactive
}}
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_status")
        assert result["allowed_values"] == ["Active", "Inactive"]

    def test_display_template(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=Related page
|has_type=Page
|has_template=Property/Page
}}
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_related")
        assert result["has_display_template"] == "Property/Page"

    def test_value_from_category(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=The assignee
|has_type=Page
|allows_value_from_category=Person
}}
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_assignee")
        assert result["Allows_value_from_category"] == "Person"

    def test_unique_values(self):
        wikitext = """<!-- OntologySync Start -->
{{Property
|has_description=Unique ID
|has_type=Text
|has_unique_values=Yes
}}
<!-- OntologySync End -->"""

        result = parse_property_wikitext(wikitext, "Has_uid")
        assert result["unique_values"] is True


class TestParseSubobject:
    def test_with_properties(self):
        wikitext = """<!-- OntologySync Start -->
{{Subobject
|has_description=A physical address
|has_required_property=Has street, Has city
|has_optional_property=Has postal code
}}
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
{{Person
|display_label=John Doe
|has_name=John Doe
|has_email=john@example.com
}}
<!-- OntologySync End -->
[[Category:Person]]
[[Category:OntologySync-managed-resource]]"""

        result = parse_resource_wikitext(wikitext, "Person/John_doe")
        assert result["categories"] == ["Person"]
        assert result["Has_Name"] == "John Doe"
        assert result["Has_Email"] == "john@example.com"

    def test_with_body(self):
        wikitext = """<!-- OntologySync Start -->
{{SOP
|has_description=A procedure
|display_label=My SOP
|has_document_type=SOP
}}
<!-- OntologySync End -->
[[Category:SOP]]
[[Category:OntologySync-managed-resource]]

== Procedure ==
Step 1: Do the thing."""

        result = parse_resource_wikitext(wikitext, "SOP/My_sop")
        assert result["categories"] == ["SOP"]
        assert result["Has_Document_Type"] == "SOP"
        assert "== Procedure ==" in result["wikitext"]


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
        assert "display_label" not in wikitext

        parsed = parse_category_wikitext(wikitext, "Person")
        assert parsed["label"] == "Person"

    def test_multiple_properties(self):
        original = {
            "id": "Equipment",
            "label": "Equipment",
            "description": "Lab equipment",
            "required_properties": ["Has_name", "Has_serial"],
            "optional_properties": ["Has_location", "Has_notes", "Has_url"],
        }
        wikitext = generate_category_wikitext(original)
        parsed = parse_category_wikitext(wikitext, "Equipment")

        assert parsed["required_properties"] == original["required_properties"]
        assert parsed["optional_properties"] == original["optional_properties"]


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

    def test_allowed_values_round_trip(self):
        original = {
            "id": "Has_status",
            "label": "Status",
            "description": "Status field",
            "datatype": "Text",
            "cardinality": "single",
            "allowed_values": ["Active", "Inactive", "Retired"],
        }
        wikitext = generate_property_wikitext(original)
        parsed = parse_property_wikitext(wikitext, "Has_status")
        assert parsed["allowed_values"] == original["allowed_values"]

    def test_value_from_category_round_trip(self):
        original = {
            "id": "Has_assignee",
            "label": "Assignee",
            "description": "Person assigned",
            "datatype": "Page",
            "cardinality": "single",
            "Allows_value_from_category": "Person",
        }
        wikitext = generate_property_wikitext(original)
        parsed = parse_property_wikitext(wikitext, "Has_assignee")
        assert parsed["Allows_value_from_category"] == "Person"

    def test_display_template_round_trip(self):
        original = {
            "id": "Has_link",
            "label": "Link",
            "description": "A link",
            "datatype": "Page",
            "cardinality": "single",
            "has_display_template": "Property/Page",
        }
        wikitext = generate_property_wikitext(original)
        parsed = parse_property_wikitext(wikitext, "Has_link")
        assert parsed["has_display_template"] == "Property/Page"


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
        assert parsed["Has_Name"] == "John Doe"
        assert parsed["Has_Email"] == "john@example.com"

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
        assert parsed["Has_Name"] == "Microscope 1"

    def test_with_body_round_trip(self):
        original = {
            "id": "SOP/Test_procedure",
            "label": "Test Procedure",
            "description": "A test SOP",
            "categories": ["SOP"],
            "Has_document_type": "SOP",
            "wikitext": "== Steps ==\n1. Do the thing.\n2. Check the thing.",
        }
        wikitext = generate_resource_wikitext(original)
        parsed = parse_resource_wikitext(wikitext, "SOP/Test_procedure")

        assert parsed["categories"] == ["SOP"]
        assert "== Steps ==" in parsed["wikitext"]
        assert "Do the thing" in parsed["wikitext"]


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
