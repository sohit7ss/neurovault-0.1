"""Authentication service: register, login, JWT tokens, bcrypt hashing."""
import bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token
from flask import request
from error_handler import ValidationError, UnauthorizedError
from security import validate_email, validate_password, sanitize_string
from monitoring import log_security_event
from supabase_client import sb_select, sb_insert


def register_user(email, password, name):
    """Register a new user with validated inputs."""
    email = validate_email(email)
    password = validate_password(password)
    name = sanitize_string(name, 100)
    
    if not name:
        raise ValidationError("Name is required")
    
    if sb_select('users', eq=('email', email), single=True):
        raise ValidationError("Email already registered")
    
    password_hash = bcrypt.hashpw(
        password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')
    
    # Store in Supabase
    res = sb_insert('users', {
        'email': email,
        'password_hash': password_hash,
        'name': name,
        'role': 'user'
    })
    
    user_dict = res.data[0] if res.data else None
    if not user_dict:
        raise ValidationError("Failed to register user")
        
    user_id = user_dict['id']
    
    # Log activity
    log_activity(user_id, 'register', 'User registered')
    
    # Generate tokens
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))
    
    # Clean up password before returning
    if 'password_hash' in user_dict:
        del user_dict['password_hash']
        
    return {
        'user': user_dict,
        'access_token': access_token,
        'refresh_token': refresh_token,
    }


def login_user(email, password):
    """Authenticate user and return JWT tokens."""
    email = validate_email(email)
    
    user = sb_select('users', eq=('email', email), single=True)
    if not user:
        log_security_event('failed_login', f'Unknown email: {email}')
        raise UnauthorizedError("Invalid email or password")
    
    password_hash = user['password_hash']
    if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
        log_security_event('failed_login', f'Wrong password for: {email}', user['id'])
        raise UnauthorizedError("Invalid email or password")
    
    user_id = user['id']
    # Generate tokens
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))
    
    log_activity(user_id, 'login', 'User logged in')
    
    if 'password_hash' in user:
        del user['password_hash']
        
    return {
        'user': user,
        'access_token': access_token,
        'refresh_token': refresh_token,
    }


def get_user_profile(user_id):
    """Get user profile by ID."""
    uid = int(user_id) if isinstance(user_id, str) else user_id
    user = sb_select('users', eq=('id', uid), single=True)
    if not user:
        raise UnauthorizedError("User not found")
    if 'password_hash' in user:
        del user['password_hash']
    return user


def log_activity(user_id, action, details=''):
    """Log user activity."""
    try:
        sb_insert('activity_logs', {
            'user_id': user_id,
            'action': action,
            'details': details,
            'ip_address': request.remote_addr if request else None,
        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to log activity: {e}")
