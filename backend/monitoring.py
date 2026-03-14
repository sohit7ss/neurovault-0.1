"""Monitoring, structured logging, and health checks."""
import logging
import json
import sys
from datetime import datetime, timezone
from flask import request, g
import time


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter."""
    def format(self, record):
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(app):
    """Configure structured logging for the application."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    
    app.logger.handlers = [handler]
    app.logger.setLevel(logging.INFO)
    
    # Set level for werkzeug
    logging.getLogger('werkzeug').setLevel(logging.WARNING)


def setup_request_tracking(app):
    """Track request timing and log requests."""
    
    @app.before_request
    def before_request():
        g.start_time = time.time()
    
    @app.after_request
    def after_request(response):
        if hasattr(g, 'start_time'):
            duration = round((time.time() - g.start_time) * 1000, 2)
            app.logger.info(
                f"{request.method} {request.path} "
                f"status={response.status_code} "
                f"duration={duration}ms"
            )
        return response


def register_health_check(app):
    """Register /health endpoint."""
    
    @app.route('/health')
    def health_check():
        from models import db
        try:
            db.session.execute(db.text('SELECT 1'))
            db_status = 'healthy'
        except Exception:
            db_status = 'unhealthy'
        
        return {
            'status': 'healthy' if db_status == 'healthy' else 'degraded',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'components': {
                'database': db_status,
                'api': 'healthy',
            }
        }


def log_security_event(event_type, details, user_id=None):
    """Log security events (failed logins, unauthorized access, etc.)."""
    logger = logging.getLogger('security')
    logger.warning(json.dumps({
        'event': event_type,
        'details': details,
        'user_id': user_id,
        'ip': request.remote_addr if request else None,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }))
