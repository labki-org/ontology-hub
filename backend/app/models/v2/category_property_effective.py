"""Materialized view for computed category property inheritance.

This view precomputes all effective properties for each category,
including inherited properties with their source and depth. It enables
fast reads for property lookups without traversing the inheritance chain
at query time.
"""

import uuid
from typing import TYPE_CHECKING

from sqlmodel import SQLModel

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# SQL for creating the materialized view
CATEGORY_PROPERTY_EFFECTIVE_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS category_property_effective AS
WITH RECURSIVE inheritance_chain AS (
    -- Base case: direct parents
    SELECT
        cp.category_id,
        cp.parent_id,
        1 as depth,
        ARRAY[cp.parent_id] as path
    FROM category_parent cp

    UNION ALL

    -- Recursive case: grandparents and beyond
    SELECT
        ic.category_id,
        cp.parent_id,
        ic.depth + 1,
        ic.path || cp.parent_id
    FROM inheritance_chain ic
    JOIN category_parent cp ON cp.category_id = ic.parent_id
    WHERE NOT cp.parent_id = ANY(ic.path)  -- Prevent cycles
),
all_properties AS (
    -- Direct properties (depth = 0)
    SELECT
        cp.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        0 as depth,
        cp.is_required
    FROM category_property cp

    UNION ALL

    -- Inherited properties
    SELECT
        ic.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        ic.depth,
        cp.is_required
    FROM inheritance_chain ic
    JOIN category_property cp ON cp.category_id = ic.parent_id
)
SELECT DISTINCT ON (category_id, property_id)
    category_id,
    property_id,
    source_category_id,
    depth,
    is_required
FROM all_properties
ORDER BY category_id, property_id, depth;
"""

# SQL for creating the unique index on the view
CATEGORY_PROPERTY_EFFECTIVE_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpe_category_property
ON category_property_effective (category_id, property_id);
"""

# SQL for refreshing the view concurrently (non-blocking)
CATEGORY_PROPERTY_EFFECTIVE_REFRESH_SQL = """
REFRESH MATERIALIZED VIEW CONCURRENTLY category_property_effective;
"""

# SQL for dropping the view (for migrations/cleanup)
DROP_CATEGORY_PROPERTY_EFFECTIVE_SQL = """
DROP MATERIALIZED VIEW IF EXISTS category_property_effective;
"""


class CategoryPropertyEffective(SQLModel):
    """Read-only model for querying the materialized view.

    This is NOT a table=True model. It's used for type hints and ORM queries
    against the materialized view created by raw SQL.

    Columns:
    - category_id: The category that has this property (directly or inherited)
    - property_id: The property assigned
    - source_category_id: Where the property was originally assigned
    - depth: 0 = direct, 1+ = inherited from ancestor
    - is_required: Whether the property is required on the category
    """

    category_id: uuid.UUID
    property_id: uuid.UUID
    source_category_id: uuid.UUID
    depth: int
    is_required: bool


async def refresh_category_property_effective(session: "AsyncSession") -> None:
    """Refresh the materialized view concurrently (non-blocking).

    This should be called after any changes to category_parent or
    category_property tables to update the computed inheritance.

    Uses CONCURRENTLY to allow reads during refresh. Requires the unique
    index created by CATEGORY_PROPERTY_EFFECTIVE_INDEX_SQL.
    """
    from sqlalchemy import text

    await session.execute(text(CATEGORY_PROPERTY_EFFECTIVE_REFRESH_SQL))
    await session.commit()
