"""Workspace/collaboration API routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import services.collaboration_service as cs

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
    
    ws = cs.create_workspace(
        user_id, name, 
        description=data.get('description', ''),
        color=data.get('color', '#3b82f6'),
        icon=data.get('icon', 'folder')
    )
    return jsonify(ws), 201


@collab_bp.route('', methods=['GET'])
@jwt_required()
def list_workspaces():
    """List user's workspaces."""
    user_id = int(get_jwt_identity())
    workspaces = cs.get_user_workspaces(user_id)
    return jsonify({'workspaces': workspaces}), 200


@collab_bp.route('/<int:ws_id>', methods=['GET'])
@jwt_required()
def get_workspace(ws_id):
    """Get single workspace details."""
    user_id = int(get_jwt_identity())
    try:
        ws = cs.get_workspace_details(ws_id, user_id)
        return jsonify(ws), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>', methods=['PUT', 'PATCH'])
@jwt_required()
def update_settings(ws_id):
    """Update workspace settings (owner only)."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    try:
        ws = cs.update_workspace_settings(ws_id, user_id, data)
        return jsonify(ws), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


# ─── Members & Roles ───

@collab_bp.route('/<int:ws_id>/members', methods=['GET'])
@jwt_required()
def get_members(ws_id):
    """Get workspace members."""
    user_id = int(get_jwt_identity())
    try:
        members = cs.get_workspace_members(ws_id, user_id)
        return jsonify({'members': members}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/members/<int:member_id>/role', methods=['PUT'])
@jwt_required()
def change_role(ws_id, member_id):
    """Change member role."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    new_role = data.get('role')
    try:
        cs.change_member_role(ws_id, member_id, new_role, user_id)
        return jsonify({'message': 'Role updated successfully'}), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(ws_id, member_id):
    """Remove a member (owner only)."""
    user_id = int(get_jwt_identity())
    try:
        cs.remove_member(ws_id, member_id, user_id)
        return jsonify({'message': 'Member removed'}), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/leave', methods=['POST'])
@jwt_required()
def leave_workspace(ws_id):
    """Leave a workspace voluntarily."""
    user_id = int(get_jwt_identity())
    try:
        cs.leave_workspace(ws_id, user_id)
        return jsonify({'message': 'Successfully left workspace'}), 200
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


# ─── Invites ───

@collab_bp.route('/<int:ws_id>/invites', methods=['GET'])
@jwt_required()
def list_invites(ws_id):
    """List pending invites."""
    user_id = int(get_jwt_identity())
    try:
        invites = cs.get_pending_invites(ws_id, user_id)
        return jsonify({'invites': invites.data if invites else []}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/invites', methods=['POST'])
@jwt_required()
def invite(ws_id):
    """Create a new invite."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    email = data.get('email')
    role = data.get('role', 'viewer')
    
    if not email:
        return jsonify({'error': 'Email required'}), 422
        
    try:
        inv = cs.invite_member(ws_id, email, role, user_id)
        return jsonify(inv), 201
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/invites/accept', methods=['POST'])
@jwt_required()
def accept_inv(ws_id):
    """Accept an invite."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email required'}), 422
        
    try:
        cs.accept_invite(ws_id, user_id, email)
        return jsonify({'message': 'Invite accepted'}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@collab_bp.route('/<int:ws_id>/invites/<int:invite_id>', methods=['DELETE'])
@jwt_required()
def cancel_inv(ws_id, invite_id):
    """Cancel an invite."""
    user_id = int(get_jwt_identity())
    try:
        cs.cancel_invite(ws_id, invite_id, user_id)
        return jsonify({'message': 'Invite cancelled'}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


# ─── Documents ───

@collab_bp.route('/<int:ws_id>/documents', methods=['GET'])
@jwt_required()
def list_documents(ws_id):
    user_id = int(get_jwt_identity())
    try:
        docs = cs.get_workspace_documents(ws_id, user_id)
        return jsonify({'documents': docs}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/share', methods=['POST'])
@jwt_required()
def share_document(ws_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    doc_id = data.get('document_id')
    perm = data.get('permission_level', 'viewer')
    
    if not doc_id:
        return jsonify({'error': 'document_id required'}), 422
        
    try:
        res = cs.share_document(ws_id, doc_id, user_id, perm)
        return jsonify(res), 201
    except (PermissionError, ValueError) as e:
        return jsonify({'error': str(e)}), 403


# ─── Activity & Chat ───

@collab_bp.route('/<int:ws_id>/activity', methods=['GET'])
@jwt_required()
def get_activity(ws_id):
    user_id = int(get_jwt_identity())
    limit = int(request.args.get('limit', 50))
    try:
        acts = cs.get_workspace_activity(ws_id, user_id, limit)
        return jsonify({'activity': acts}), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(ws_id):
    user_id = int(get_jwt_identity())
    limit = int(request.args.get('limit', 50))
    try:
        msgs = cs.get_workspace_messages(ws_id, user_id, limit)
        return jsonify({'messages': msgs})
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403


@collab_bp.route('/<int:ws_id>/messages', methods=['POST'])
@jwt_required()
def send_message(ws_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    content = data.get('content')
    search_ai = data.get('search_ai', False)
    
    if not content:
        return jsonify({'error': 'Content required'}), 400
        
    try:
        # Save human message
        msg = cs.send_workspace_message(ws_id, user_id, content)
        
        ai_response_dict = None
        if search_ai:
            from services.ai_service import query_documents
            from supabase_client import sb_insert
            
            # Query the AI restricted to the workspace
            ai_result = query_documents(user_id, content, top_k=5, workspace_id=ws_id)
            ai_text = ai_result.get('answer', 'Sorry, I could not process that.')
            
            # Insert AI response into chat
            ai_row = sb_insert('workspace_chat', {
                'workspace_id': ws_id,
                'user_id': user_id,  # Associate with the user who asked, or generic AI
                'message': ai_text,
                'is_ai': True
            })
            
            if ai_row.data:
                ai_response_dict = ai_row.data[0]
                
        return jsonify({'message': msg, 'ai_message': ai_response_dict}), 201
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403
