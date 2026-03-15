"""AI search and query routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.ai_service import query_documents
from error_handler import ValidationError

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


@ai_bp.route('/query', methods=['POST'])
@jwt_required()
def query():
    """
    Query user's documents using RAG.
    ---
    tags:
      - AI & Search
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - query
          properties:
            query:
              type: string
            top_k:
              type: integer
              default: 5
    responses:
      200:
        description: AI generated response and source document chunks
      400:
        description: Validation Error
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data or not data.get('query'):
        raise ValidationError("Query is required")
        
    workspace_id = data.get('workspace_id')
    
    if workspace_id:
        from services.collaboration_service import get_member_role
        role = get_member_role(workspace_id, user_id)
        if not role:
            from error_handler import AuthorizationError
            raise AuthorizationError("You must be a member of this workspace to search its documents.")
    
    result = query_documents(
        user_id,
        data['query'],
        top_k=data.get('top_k', 5),
        workspace_id=workspace_id
    )
    return jsonify(result), 200


@ai_bp.route('/summarize', methods=['POST'])
@jwt_required()
def summarize():
    """
    Summarize a document.
    ---
    tags:
      - AI & Search
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - document_id
          properties:
            document_id:
              type: integer
    responses:
      200:
        description: Summary generated successfully
      400:
        description: Validation Error
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data or not data.get('document_id'):
        raise ValidationError("Document ID is required")
    
    from services.document_service import get_document, get_document_content
    from services.intelligence_service import summarize_document
    
    doc = get_document(user_id, data['document_id'])
    content = get_document_content(user_id, data['document_id'])
    
    if not content:
        return jsonify({'summary': 'No content to summarize'}), 200
    
    summary = summarize_document(content)
    
    return jsonify({
        'summary': summary,
        'title': doc.get('title'),
        'document_id': data['document_id']
    }), 200
