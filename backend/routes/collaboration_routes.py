"""Workspace/collaboration API routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.collaboration_service import (
    create_workspace, get_user_workspaces, invite_member,
    share_document, get_workspace_documents, remove_member,
)

collab_bp = Blueprint('collaboration', __name__, url_prefix='/api/workspaces')


@collab_bp.route('', methods=['POST'])
@jwt_required()
def create():
    """Create a new workspace."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Workspace name is required'}), 422
    
    ws = create_workspace(user_id, name, data.get('description', ''))
    return jsonify(ws), 201


@collab_bp.route('', methods=['GET'])
@jwt_required()
def list_workspaces():
    """List user's workspaces."""
    user_id = int(get_jwt_identity())
    workspaces = get_user_workspaces(user_id)
    return jsonify({'workspaces': workspaces}), 200


@collab_bp.route('/<int:ws_id>/invite', methods=['POST'])
@jwt_required()
def invite(ws_id):
    """Invite a user to workspace."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    email = data.get('email')
    role = data.get('role', 'viewer')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 422
    if role not in ('editor', 'viewer'):
        return jsonify({'error': 'Role must be editor or viewer'}), 422
    
    try:
        member = invite_member(ws_id, email, role, user_id)
        return jsonify(member), 201
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403
    except ValueError as e:
        return jsonify({'error': str(e)}), 422


@collab_bp.route('/<int:ws_id>/share', methods=['POST'])
@jwt_required()
def share(ws_id):
    """Share a document to workspace."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    doc_id = data.get('document_id')
    
    if not doc_id:
        return jsonify({'error': 'document_id required'}), 422
    
    try:
        result = share_document(ws_id, doc_id, user_id)
        return jsonify(result), 201
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/documents', methods=['GET'])
@jwt_required()
def documents(ws_id):
    """Get workspace documents."""
    user_id = int(get_jwt_identity())
    try:
        docs = get_workspace_documents(ws_id, user_id)
        return jsonify({'documents': docs}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove(ws_id, member_id):
    """Remove a member from workspace."""
    user_id = int(get_jwt_identity())
    try:
        remove_member(ws_id, member_id, user_id)
        return jsonify({'message': 'Member removed'}), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403
