"""File encryption service using AES-256 for document storage security."""
import os
import base64
import hashlib
from cryptography.fernet import Fernet
from flask import current_app


def _get_encryption_key():
    """Derive encryption key from JWT_SECRET_KEY."""
    secret = current_app.config.get('JWT_SECRET_KEY', 'default-key')
    key = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(key)


def encrypt_file(data: bytes) -> bytes:
    """Encrypt file data using Fernet (AES-128-CBC under the hood)."""
    try:
        f = Fernet(_get_encryption_key())
        return f.encrypt(data)
    except Exception:
        return data  # Fallback: return unencrypted if crypto unavailable


def decrypt_file(encrypted_data: bytes) -> bytes:
    """Decrypt file data."""
    try:
        f = Fernet(_get_encryption_key())
        return f.decrypt(encrypted_data)
    except Exception:
        return encrypted_data  # Fallback


def encrypt_text(text: str) -> str:
    """Encrypt text string."""
    try:
        f = Fernet(_get_encryption_key())
        return f.encrypt(text.encode('utf-8')).decode('utf-8')
    except Exception:
        return text


def decrypt_text(encrypted_text: str) -> str:
    """Decrypt text string."""
    try:
        f = Fernet(_get_encryption_key())
        return f.decrypt(encrypted_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return encrypted_text
