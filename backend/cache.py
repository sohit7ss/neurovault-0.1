"""Redis caching layer for performance optimization."""
import json
import logging
from functools import wraps
from flask import request

logger = logging.getLogger(__name__)

_redis_client = None
CACHE_AVAILABLE = False


def init_cache(app):
    """Initialize Redis cache connection."""
    global _redis_client, CACHE_AVAILABLE
    redis_url = app.config.get('REDIS_URL', '')
    if not redis_url:
        logger.info("No REDIS_URL configured, caching disabled")
        return
    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        CACHE_AVAILABLE = True
        logger.info("Redis cache initialized")
    except Exception as e:
        logger.warning(f"Redis not available, caching disabled: {e}")
        CACHE_AVAILABLE = False


def cache_get(key):
    """Get value from cache."""
    if not CACHE_AVAILABLE:
        return None
    try:
        val = _redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def cache_set(key, value, ttl=300):
    """Set value in cache with TTL (default 5 min)."""
    if not CACHE_AVAILABLE:
        return
    try:
        _redis_client.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


def cache_delete(pattern):
    """Delete cache entries matching pattern."""
    if not CACHE_AVAILABLE:
        return
    try:
        keys = _redis_client.keys(pattern)
        if keys:
            _redis_client.delete(*keys)
    except Exception:
        pass


def cached(prefix, ttl=300, user_specific=True):
    """Decorator to cache API responses."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not CACHE_AVAILABLE:
                return f(*args, **kwargs)
            
            # Build cache key
            cache_key = prefix
            if user_specific:
                from flask_jwt_extended import get_jwt_identity
                try:
                    user_id = get_jwt_identity()
                    cache_key = f"{prefix}:user:{user_id}"
                except Exception:
                    pass
            
            # Add query params to key
            if request.args:
                params = '&'.join(f"{k}={v}" for k, v in sorted(request.args.items()))
                cache_key += f":{params}"
            
            # Try cache
            result = cache_get(cache_key)
            if result is not None:
                return result
            
            # Execute and cache
            result = f(*args, **kwargs)
            cache_set(cache_key, result, ttl)
            return result
        
        return decorated
    return decorator
