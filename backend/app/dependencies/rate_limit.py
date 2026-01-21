"""Rate limiting configuration using SlowAPI.

Implements IP-based rate limiting to prevent abuse while allowing
anonymous draft submissions. Uses sliding window algorithm.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import Response

# Create limiter with IP-based key function
# Uses X-Forwarded-For if behind proxy, falls back to client IP
limiter = Limiter(key_func=get_remote_address)


# Rate limit constants (from CONTEXT.md decisions)
RATE_LIMITS = {
    # Draft operations - more restrictive for writes
    "draft_create": "20/hour",  # Per user decision in CONTEXT.md
    "draft_read": "100/minute",  # More lenient for reads
    # Entity operations - read-heavy, be lenient
    "entity_list": "100/minute",
    "entity_read": "200/minute",
    # Module/Profile operations
    "module_list": "100/minute",
    "module_read": "200/minute",
}


def _parse_retry_after(detail: str) -> int:
    """Parse rate limit detail to estimate retry-after seconds.

    Examples:
        "20 per 1 hour" -> 3600
        "100 per 1 minute" -> 60

    Args:
        detail: Rate limit detail string

    Returns:
        Estimated seconds until rate limit resets
    """
    detail_lower = detail.lower()
    if "hour" in detail_lower:
        return 3600
    elif "minute" in detail_lower:
        return 60
    elif "second" in detail_lower:
        return 1
    elif "day" in detail_lower:
        return 86400
    else:
        return 60  # Default to 1 minute


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> Response:
    """Handle rate limit exceeded errors with proper 429 response.

    Returns JSON response with:
    - 429 status code
    - Retry-After header (RFC 6585 compliant)
    - JSON body with detail message

    Args:
        request: The incoming request
        exc: The rate limit exception with limit details

    Returns:
        JSONResponse with 429 status and Retry-After header
    """
    retry_after = _parse_retry_after(exc.detail)

    response = JSONResponse(
        status_code=429,
        headers={"Retry-After": str(retry_after)},
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "retry_after": retry_after,
        },
    )
    return response
