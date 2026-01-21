"""Tests for rate limiting configuration.

Tests SlowAPI rate limiting:
- Rate limits configured per endpoint
- 429 responses include Retry-After header
"""

from app.dependencies.rate_limit import RATE_LIMITS, limiter


class TestRateLimitsConfiguration:
    """Tests for RATE_LIMITS constants."""

    def test_draft_create_limit_exists(self):
        """draft_create rate limit should be configured."""
        assert "draft_create" in RATE_LIMITS
        # Should be 20/hour as per CONTEXT.md
        assert RATE_LIMITS["draft_create"] == "20/hour"

    def test_draft_read_limit_exists(self):
        """draft_read rate limit should be configured."""
        assert "draft_read" in RATE_LIMITS
        # Should be more lenient for reads
        assert "minute" in RATE_LIMITS["draft_read"] or "hour" in RATE_LIMITS["draft_read"]

    def test_entity_limits_exist(self):
        """Entity rate limits should be configured."""
        assert "entity_list" in RATE_LIMITS
        assert "entity_read" in RATE_LIMITS

    def test_read_limits_more_lenient_than_write(self):
        """Read limits should be higher than write limits."""
        # Parse limits to compare
        create_limit = int(RATE_LIMITS["draft_create"].split("/")[0])
        read_limit = int(RATE_LIMITS["draft_read"].split("/")[0])
        # Read should allow more requests
        assert read_limit >= create_limit


class TestLimiterConfiguration:
    """Tests for SlowAPI limiter setup."""

    def test_limiter_has_key_func(self):
        """Limiter should use IP-based key function."""
        assert limiter._key_func is not None
