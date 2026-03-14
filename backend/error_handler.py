"""Centralized error handling with standardized JSON responses."""
import logging
from flask import jsonify

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base API error with status code and message."""
    def __init__(self, message, code=400, details=None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(self.message)


class NotFoundError(APIError):
    def __init__(self, message="Resource not found"):
        super().__init__(message, 404)


class UnauthorizedError(APIError):
    def __init__(self, message="Unauthorized"):
        super().__init__(message, 401)


class ForbiddenError(APIError):
    def __init__(self, message="Access forbidden"):
        super().__init__(message, 403)


class ValidationError(APIError):
    def __init__(self, message="Validation failed", details=None):
        super().__init__(message, 422, details)


class RateLimitError(APIError):
    def __init__(self, message="Rate limit exceeded"):
        super().__init__(message, 429)


def register_error_handlers(app):
    """Register all error handlers on the Flask app."""
    
    @app.errorhandler(APIError)
    def handle_api_error(error):
        response = {
            'error': error.message,
            'code': error.code,
        }
        if error.details:
            response['details'] = error.details
        logger.warning(f"API Error {error.code}: {error.message}")
        return jsonify(response), error.code
    
    @app.errorhandler(400)
    def handle_bad_request(error):
        return jsonify({'error': 'Bad request', 'code': 400}), 400
    
    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({'error': 'Not found', 'code': 404}), 404
    
    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        return jsonify({'error': 'Method not allowed', 'code': 405}), 405
    
    @app.errorhandler(413)
    def handle_payload_too_large(error):
        return jsonify({'error': 'File too large', 'code': 413}), 413
    
    @app.errorhandler(429)
    def handle_rate_limit(error):
        return jsonify({'error': 'Rate limit exceeded', 'code': 429}), 429
    
    @app.errorhandler(500)
    def handle_internal_error(error):
        logger.error(f"Internal server error: {error}", exc_info=True)
        return jsonify({'error': 'Internal server error', 'code': 500}), 500
