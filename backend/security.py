"""Security utilities: validation, sanitization, rate limiting setup."""
import re
import hashlib
import mimetypes
from functools import wraps
from flask import request
from werkzeug.utils import secure_filename
from error_handler import ValidationError, ForbiddenError


# ---------- File Validation ----------

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_file(file):
    """Validate uploaded file: extension, MIME type, size."""
    if not file or file.filename == '':
        raise ValidationError("No file provided")
    
    filename = secure_filename(file.filename)
    if not filename:
        raise ValidationError("Invalid filename")
    
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"File type '.{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check MIME type
    mime = file.content_type or mimetypes.guess_type(filename)[0]
    if mime and mime not in ALLOWED_MIME_TYPES:
        # Be lenient with MIME for .md and .txt
        if ext not in ('md', 'txt'):
            raise ValidationError(f"MIME type '{mime}' not allowed")
    
    # Check file size (read and seek back)
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        raise ValidationError(f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    return filename, ext, mime, size


def compute_file_hash(file_data: bytes) -> str:
    """Compute SHA256 hash of file contents."""
    return hashlib.sha256(file_data).hexdigest()


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage."""
    name = secure_filename(filename)
    # Remove any remaining problematic characters
    name = re.sub(r'[^\w\-.]', '_', name)
    return name or 'unnamed_file'


# ---------- Input Sanitization ----------

def sanitize_string(value: str, max_length: int = 1000) -> str:
    """Sanitize string input: strip, truncate, remove dangerous patterns."""
    if not isinstance(value, str):
        return ''
    value = value.strip()
    value = value[:max_length]
    # Remove potential XSS patterns
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    value = re.sub(r'on\w+\s*=', '', value, flags=re.IGNORECASE)
    return value


def validate_email(email: str) -> str:
    """Validate and sanitize email address."""
    email = sanitize_string(email, 255).lower()
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValidationError("Invalid email address")
    return email


def validate_password(password: str) -> str:
    """Validate password strength."""
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")
    if len(password) > 128:
        raise ValidationError("Password too long")
    if not re.search(r'[A-Z]', password):
        raise ValidationError("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        raise ValidationError("Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        raise ValidationError("Password must contain at least one number")
    return password


# ---------- Ownership Check Decorator ----------

def require_ownership(model_class, id_param='id'):
    """Decorator to verify resource ownership."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask_jwt_extended import get_jwt_identity
            resource_id = kwargs.get(id_param)
            resource = model_class.query.get(resource_id)
            if not resource:
                from error_handler import NotFoundError
                raise NotFoundError()
            if resource.user_id != get_jwt_identity():
                raise ForbiddenError("You don't have access to this resource")
            kwargs['resource'] = resource
            return f(*args, **kwargs)
        return decorated_function
    return decorator
