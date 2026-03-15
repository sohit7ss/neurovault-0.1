"""Document service: upload, process, extract text, manage documents."""
import os
import hashlib
from werkzeug.utils import secure_filename
from error_handler import NotFoundError, ForbiddenError, ValidationError
from security import validate_file, sanitize_string, compute_file_hash
from flask import current_app
from supabase_client import sb_select, sb_insert, sb_delete, sb_update


def upload_document(user_id, file, title=None):
    """Upload and store a document for a user."""
    # Validate file
    filename, ext, mime, size = validate_file(file)
    
    # Read file data
    file_data = file.read()
    file.seek(0)
    
    # Compute hash for deduplication
    file_hash = compute_file_hash(file_data)
    
    # Check for duplicate
    existing = sb_select('documents', eq=('file_hash', file_hash), single=True)
    if existing and existing.get('user_id') == user_id:
        raise ValidationError("This document has already been uploaded")
    
    # Create user directory
    user_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    
    # Store with hashed filename for security
    stored_name = f"{file_hash[:16]}_{secure_filename(filename)}"
    file_path = os.path.join(user_dir, stored_name)
    
    with open(file_path, 'wb') as f:
        f.write(file_data)
    
    # Extract text
    content_text = extract_text(file_data, ext)
    
    # Create title from filename if not provided
    if not title:
        title = os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ').title()
    else:
        title = sanitize_string(title, 500)
    
    # Save to Supabase
    doc_data = {
        'user_id': user_id,
        'title': title,
        'filename': filename,
        'file_path': file_path,
        'file_hash': file_hash,
        'content_text': content_text,
        'file_size': size,
        'mime_type': mime,
        'status': 'ready' if content_text else 'processing',
    }
    res = sb_insert('documents', doc_data)
    
    document = res.data[0] if res.data else None
    if not document:
        raise ValidationError("Failed to save document record")
    
    # Check achievements
    try:
        from services.achievement_service import check_and_award_achievements
        check_and_award_achievements(user_id, 'document_upload')
    except Exception:
        pass
        
    return document


def extract_text(file_data: bytes, extension: str) -> str:
    """Extract text from document based on file type."""
    try:
        if extension == 'pdf':
            return _extract_pdf(file_data)
        elif extension == 'docx':
            return _extract_docx(file_data)
        elif extension in ('txt', 'md'):
            return file_data.decode('utf-8', errors='ignore')
        else:
            return ''
    except Exception as e:
        current_app.logger.error(f"Text extraction failed: {e}")
        return ''


def _extract_pdf(file_data: bytes) -> str:
    """Extract text from PDF file."""
    try:
        import io
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_data))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return '\n\n'.join(text_parts)
    except ImportError:
        current_app.logger.warning("PyPDF2 not installed, skipping PDF extraction")
        return ''


def _extract_docx(file_data: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        import io
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(file_data))
        text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
        return '\n\n'.join(text_parts)
    except ImportError:
        current_app.logger.warning("python-docx not installed, skipping DOCX extraction")
        return ''


def get_user_documents(user_id, page=1, per_page=20):
    """List documents for a user with pagination."""
    # Supabase simple pagination using range
    from supabase_client import get_supabase
    start = (page - 1) * per_page
    end = start + per_page - 1
    
    res = get_supabase().table('documents') \
        .select("*", count="exact") \
        .eq('user_id', user_id) \
        .order('created_at', desc=True) \
        .range(start, end) \
        .execute()
    
    total = res.count if res.count is not None else 0
    pages = (total + per_page - 1) // per_page
    
    return {
        'documents': res.data,
        'total': total,
        'page': page,
        'pages': pages,
    }


def get_document(user_id, document_id):
    """Get a single document with ownership check."""
    document = sb_select('documents', eq=('id', document_id), single=True)
    if not document:
        raise NotFoundError("Document not found")
    if document.get('user_id') != user_id:
        raise ForbiddenError("Access denied")
    return document



def delete_document(user_id, document_id):
    """Delete a document with ownership check."""
    document = sb_select('documents', eq=('id', document_id), single=True)
    if not document:
        raise NotFoundError("Document not found")
    if document.get('user_id') != user_id:
        raise ForbiddenError("Access denied")
    
    # Delete file from disk
    file_path = document.get('file_path')
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from Supabase
    sb_delete('documents', match={'id': document_id})
    # Also delete embeddings for this document
    sb_delete('embeddings', match={'document_id': document_id})
    
    return {'message': 'Document deleted successfully'}


def get_document_content(user_id, document_id):
    """Get full text content of a document."""
    document = sb_select('documents', eq=('id', document_id), single=True)
    if not document:
        raise NotFoundError("Document not found")
    if document.get('user_id') != user_id:
        raise ForbiddenError("Access denied")
    return document.get('content_text', '')

