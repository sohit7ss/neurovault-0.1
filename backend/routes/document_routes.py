"""Document management routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.document_service import (
    upload_document, get_user_documents, get_document,
    delete_document, get_document_content
)
from services.ai_service import process_document_embeddings
from error_handler import ValidationError

document_bp = Blueprint('documents', __name__, url_prefix='/api/documents')


@document_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload():
    """
    Upload a new document.
    ---
    tags:
      - Documents
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: The document file to upload
      - in: formData
        name: title
        type: string
        required: false
        description: Optional title for the document
    responses:
      201:
        description: Document uploaded successfully
      400:
        description: Validation Error
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    
    if 'file' not in request.files:
        raise ValidationError("No file provided")
    
    file = request.files['file']
    title = request.form.get('title', None)
    
    result = upload_document(user_id, file, title)
    
    # Process embeddings in background thread
    import threading
    from flask import current_app
    app = current_app._get_current_object()
    doc_id = result['id']
    
    def _process_bg():
        with app.app_context():
            try:
                process_document_embeddings(user_id, doc_id)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Background embedding failed: {e}")
    
    thread = threading.Thread(target=_process_bg, daemon=True)
    thread.start()
    
    return jsonify(result), 201


@document_bp.route('', methods=['GET'])
@jwt_required()
def list_documents():
    """
    List user's documents with pagination.
    ---
    tags:
      - Documents
    security:
      - Bearer: []
    parameters:
      - in: query
        name: page
        type: integer
        required: false
        description: Page number (default 1)
      - in: query
        name: per_page
        type: integer
        required: false
        description: Items per page (default 20, max 50)
    responses:
      200:
        description: A list of documents
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    if per_page > 50:
        per_page = 50
    
    result = get_user_documents(user_id, page, per_page)
    return jsonify(result), 200


@document_bp.route('/<int:document_id>', methods=['GET'])
@jwt_required()
def get_doc(document_id):
    """Get a single document."""
    user_id = int(get_jwt_identity())
    result = get_document(user_id, document_id)
    return jsonify(result), 200


@document_bp.route('/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_doc(document_id):
    """Delete a document."""
    user_id = int(get_jwt_identity())
    result = delete_document(user_id, document_id)
    return jsonify(result), 200


@document_bp.route('/<int:document_id>/content', methods=['GET'])
@jwt_required()
def get_content(document_id):
    """Get document text content."""
    user_id = int(get_jwt_identity())
    content = get_document_content(user_id, document_id)
    return jsonify({'content': content}), 200
