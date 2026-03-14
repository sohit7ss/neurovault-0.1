"""Authentication service: register, login, JWT tokens, bcrypt hashing."""
import bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token
from models import db, User, ActivityLog
from flask import request
from error_handler import ValidationError, UnauthorizedError
from security import validate_email, validate_password, sanitize_string
from monitoring import log_security_event


def register_user(email, password, name):
    """Register a new user with validated inputs."""
    email = validate_email(email)
    password = validate_password(password)
    name = sanitize_string(name, 100)
    
    if not name:
        raise ValidationError("Name is required")
    
    if User.query.filter_by(email=email).first():
        raise ValidationError("Email already registered")
    
    password_hash = bcrypt.hashpw(
        password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')
    
    user = User(
        email=email,
        password_hash=password_hash,
        name=name,
    )
    db.session.add(user)
    db.session.commit()
    
    # Log activity
    log_activity(user.id, 'register', 'User registered')
    
    # Generate tokens
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return {
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
    }


def login_user(email, password):
    """Authenticate user and return JWT tokens."""
    email = validate_email(email)
    
    user = User.query.filter_by(email=email).first()
    if not user:
        log_security_event('failed_login', f'Unknown email: {email}')
        raise UnauthorizedError("Invalid email or password")
    
    if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        log_security_event('failed_login', f'Wrong password for: {email}', user.id)
        raise UnauthorizedError("Invalid email or password")
    
    # Generate tokens
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    log_activity(user.id, 'login', 'User logged in')
    
    return {
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
    }


def get_user_profile(user_id):
    """Get user profile by ID."""
    uid = int(user_id) if isinstance(user_id, str) else user_id
    user = db.session.get(User, uid)
    if not user:
        raise UnauthorizedError("User not found")
    return user.to_dict()


def log_activity(user_id, action, details=''):
    """Log user activity."""
    try:
        log = ActivityLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=request.remote_addr if request else None,
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
