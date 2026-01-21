"""Rate limiting configuration using SlowAPI.

Implements IP-based rate limiting to prevent abuse while allowing
anonymous draft submissions. Uses sliding window algorithm.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

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


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Handle rate limit exceeded errors with proper 429 response.

    Returns JSON response with:
    - 429 status code
    - Retry-After header (required by RFC 6585)
    - JSON body with detail and retry_after fields

    Args:
        request: The incoming request
        exc: The rate limit exception with retry_after info

    Returns:
        JSONResponse with 429 status and Retry-After header
    """
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(exc.retry_after)},
        content={
            "detail": "Rate limit exceeded",
            "retry_after": exc.retry_after,
        },
    )
