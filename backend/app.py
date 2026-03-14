"""Flask application factory with all middleware and routes."""
import os
import sys

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flasgger import Swagger

from config import get_config
from models import db
from error_handler import register_error_handlers
from monitoring import setup_logging, setup_request_tracking, register_health_check


def create_app(config=None):
    """Application factory."""
    app = Flask(__name__)
    
    # Load config
    app_config = config or get_config()
    app.config.from_object(app_config)
    
    # Ensure directories exist
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)
    os.makedirs(app.config.get('VECTOR_STORE_PATH', 'vector_store'), exist_ok=True)
    
    # ---------- Extensions ----------
    
    # CORS
    CORS(app, origins=[app.config.get('FRONTEND_URL', 'http://localhost:3000')],
         supports_credentials=True)
    
    # Database
    db.init_app(app)
    
    # Migrations
    Migrate(app, db)
    
    # JWT
    jwt = JWTManager(app)
    
    # Rate Limiting (use memory:// for dev; Redis in production)
    redis_url = app.config.get('REDIS_URL', '')
    storage_uri = 'memory://'
    if redis_url and app.config.get('FLASK_ENV') == 'production':
        try:
            import redis
            r = redis.from_url(redis_url)
            r.ping()
            storage_uri = redis_url
        except Exception:
            pass
    
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=[app.config.get('RATE_LIMIT_DEFAULT', '60/minute')],
        storage_uri=storage_uri,
    )
    
    # ---------- Logging & Monitoring ----------
    setup_logging(app)
    setup_request_tracking(app)
    register_health_check(app)
    register_error_handlers(app)
    
    # ---------- Register Blueprints ----------
    from routes.auth_routes import auth_bp
    from routes.document_routes import document_bp
    from routes.ai_routes import ai_bp
    from routes.roadmap_routes import roadmap_bp
    from routes.intelligence_routes import intelligence_bp
    from routes.collaboration_routes import collab_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(document_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(roadmap_bp)
    app.register_blueprint(intelligence_bp)
    app.register_blueprint(collab_bp)
    
    # Apply rate limits per category
    limiter.limit(app.config.get('RATE_LIMIT_AUTH', '5/minute'))(auth_bp)
    limiter.limit(app.config.get('RATE_LIMIT_UPLOAD', '10/minute'))(document_bp)
    limiter.limit(app.config.get('RATE_LIMIT_SEARCH', '30/minute'))(ai_bp)
    
    # ---------- Root Route ----------
    @app.route('/')
    def index():
        return {
            'name': 'AI Knowledge Platform API',
            'version': '1.0.0',
            'status': 'running',
            'docs': '/api/docs',
        }

    # ---------- Swagger UI ----------
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec',
                "route": '/apispec.json',
                "rule_filter": lambda rule: True,  # all in
                "model_filter": lambda tag: True,  # all in
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/docs"
    }
    
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "NeuroVault API",
            "description": "API Documentation for NeuroVault AI Knowledge Platform",
            "version": "1.0.0"
        },
        "securityDefinitions": {
            "Bearer": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\""
            }
        },
        "security": [
            {
                "Bearer": []
            }
        ]
    }
    Swagger(app, config=swagger_config, template=swagger_template)
    
    # ---------- Create Tables ----------
    with app.app_context():
        db.create_all()
        app.logger.info("Database tables created")
    
    return app


# ---------- Run ----------
if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5001, debug=True)
