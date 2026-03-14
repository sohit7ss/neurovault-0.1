"""Application configuration loaded from environment variables."""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


class Config:
    """Base configuration."""
    # Flask
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000))
    )
    
    # AI
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
    GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama3-70b-8192')
    
    # Redis
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    # File Storage
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    UPLOAD_MAX_SIZE = int(os.getenv('UPLOAD_MAX_SIZE', 10485760))  # 10MB
    UPLOAD_ALLOWED_EXTENSIONS = set(
        os.getenv('UPLOAD_ALLOWED_EXTENSIONS', 'pdf,docx,txt,md').split(',')
    )
    
    # Vector Store
    VECTOR_STORE_PATH = os.path.join(os.path.dirname(__file__), 'vector_store')
    
    # Rate Limiting
    RATE_LIMIT_AUTH = os.getenv('RATE_LIMIT_AUTH', '5/minute')
    RATE_LIMIT_UPLOAD = os.getenv('RATE_LIMIT_UPLOAD', '10/minute')
    RATE_LIMIT_SEARCH = os.getenv('RATE_LIMIT_SEARCH', '30/minute')
    RATE_LIMIT_DEFAULT = os.getenv('RATE_LIMIT_DEFAULT', '60/minute')
    
    # RAG
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 50
    TOP_K_RESULTS = 10
    RERANK_TOP_K = 5
    MAX_CONTEXT_TOKENS = 3000
    
    # Frontend
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}


def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    return config_map.get(env, DevelopmentConfig)
