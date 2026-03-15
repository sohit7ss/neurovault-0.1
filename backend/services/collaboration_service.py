"""Collaboration service for shared workspaces and team knowledge bases using Supabase."""
import logging
from flask import current_app
from supabase_client import sb_select, sb_insert, sb_update, sb_delete
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ─── Helper Functions ───

def log_workspace_activity(workspace_id: int, user_id: int, action: str, metadata: dict = None):
    """Log workspace activity to the activity feed."""
    try:
        sb_insert('workspace_activity', {
            'workspace_id': workspace_id,
            'user_id': user_id,
            'action': action,
            'metadata': metadata or {}
        })
    except Exception as e:
        logger.error(f"Failed to log workspace activity: {e}")

def get_member_role(workspace_id: int, user_id: int):
    """Helper to check member role. Returns None if not a member."""
    member = sb_select('workspace_members', match={
        'workspace_id': workspace_id, 'user_id': user_id
    }, single=True)
    return member.get('role') if member else None


# ─── Workspace Settings ───

def create_workspace(owner_id: int, name: str, description: str = '', color: str = '#3b82f6', icon: str = 'folder') -> dict:
    """Create a new workspace and add owner as member."""
    res = sb_insert('workspaces', {
        'name': name,
        'description': description,
        'color': color,
        'icon': icon,
        'owner_id': owner_id
    })
    
    workspace = res.data[0] if res.data else None
    if not workspace:
        raise ValueError("Failed to create workspace")
    
    sb_insert('workspace_members', {
        'workspace_id': workspace['id'],
        'user_id': owner_id,
        'role': 'owner'
    })
    
    workspace['member_count'] = 1
    log_workspace_activity(workspace['id'], owner_id, 'workspace_created', {'name': name})
    
    try:
        from services.achievement_service import check_and_award_achievements
        check_and_award_achievements(owner_id, 'workspace_joined')
    except Exception:
        pass
        
    return workspace


def update_workspace_settings(workspace_id: int, user_id: int, updates: dict) -> dict:
    """Update workspace details (name, description, color, icon). Owner only."""
    role = get_member_role(workspace_id, user_id)
    if role != 'owner':
        raise PermissionError("Only the workspace owner can update settings")
        
    allowed_keys = ['name', 'description', 'color', 'icon']
    valid_updates = {k: v for k, v in updates.items() if k in allowed_keys}
    
    if not valid_updates:
        return get_workspace_details(workspace_id, user_id)
        
    res = sb_update('workspaces', valid_updates, match={'id': workspace_id})
    if res.data:
        log_workspace_activity(workspace_id, user_id, 'workspace_updated', valid_updates)
        return res.data[0]
    raise ValueError("Workspace not found")


def get_workspace_details(workspace_id: int, user_id: int) -> dict:
    """Get single workspace details, including member count."""
    role = get_member_role(workspace_id, user_id)
    if not role:
        raise PermissionError("Not a member of this workspace")
        
    ws = sb_select('workspaces', eq=('id', workspace_id), single=True)
    if not ws:
        raise ValueError("Workspace not found")
        
    from supabase_client import get_supabase
    count_res = get_supabase().table('workspace_members').select('id', count='exact').eq('workspace_id', workspace_id).execute()
    ws['member_count'] = count_res.count if hasattr(count_res, 'count') and count_res.count is not None else 1
    ws['role'] = role
    return ws


def get_user_workspaces(user_id: int) -> list:
    """Get all workspaces a user is a member of with details."""
    from supabase_client import get_supabase
    res = get_supabase().table('workspace_members') \
        .select("role, workspaces(*)") \
        .eq('user_id', user_id) \
        .execute()
    
    workspaces = []
    for m in res.data:
        if m.get('workspaces'):
            ws = m['workspaces']
            ws['role'] = m.get('role', 'viewer')
            
            # Simple member count (doing it manually to save API calls, but could do a grouped query)
            count_res = get_supabase().table('workspace_members').select('id', count='exact').eq('workspace_id', ws['id']).execute()
            ws['member_count'] = count_res.count if hasattr(count_res, 'count') and count_res.count is not None else 1
            
            workspaces.append(ws)
            
    return workspaces


# ─── Member Management & Roles ───

def get_workspace_members(workspace_id: int, user_id: int) -> list:
    """Get all members and their roles for a workspace."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member")
        
    from supabase_client import get_supabase
    res = get_supabase().table('workspace_members') \
        .select("role, joined_at:created_at, users(id, name, email)") \
        .eq('workspace_id', workspace_id) \
        .execute()
        
    members = []
    for m in res.data:
        if m.get('users'):
            user = m['users']
            user['role'] = m['role']
            user['joined_at'] = m.get('joined_at')
            members.append(user)
    return members


def change_member_role(workspace_id: int, target_user_id: int, new_role: str, request_user_id: int):
    """Change a member's role. Only owner can do this."""
    if new_role not in ('owner', 'editor', 'viewer'):
        raise ValueError("Invalid role specified")
        
    req_role = get_member_role(workspace_id, request_user_id)
    if req_role != 'owner':
        raise PermissionError("Only owners can change roles")
        
    if target_user_id == request_user_id:
        raise ValueError("Cannot change your own role this way")
        
    target_role = get_member_role(workspace_id, target_user_id)
    if not target_role:
        raise ValueError("Target user is not a member")
        
    if target_role == 'owner' and new_role != 'owner':
        # Don't let the last owner be demoted. Check owner count first.
        from supabase_client import get_supabase
        owners = get_supabase().table('workspace_members').select('id').eq('workspace_id', workspace_id).eq('role', 'owner').execute()
        if len(owners.data) <= 1:
            raise ValueError("Cannot demote the last owner of the workspace")
            
    sb_update('workspace_members', {'role': new_role}, match={'workspace_id': workspace_id, 'user_id': target_user_id})
    log_workspace_activity(workspace_id, request_user_id, 'role_changed', {'target_user_id': target_user_id, 'new_role': new_role})
    return True


def remove_member(workspace_id: int, target_user_id: int, remover_id: int):
    """Remove a member from workspace. Owner only."""
    remover_role = get_member_role(workspace_id, remover_id)
    
    if remover_role != 'owner':
        raise PermissionError("Only workspace owner can remove members")
    
    if target_user_id == remover_id:
        raise ValueError("To leave the workspace, use the leave endpoint")
        
    target_role = get_member_role(workspace_id, target_user_id)
    if not target_role:
        raise ValueError("Member not found")
        
    if target_role == 'owner':
        raise ValueError("Cannot remove another owner")
    
    sb_delete('workspace_members', match={'workspace_id': workspace_id, 'user_id': target_user_id})
    log_workspace_activity(workspace_id, remover_id, 'member_removed', {'target_user_id': target_user_id})
    return True


def leave_workspace(workspace_id: int, user_id: int):
    """Allow a user to voluntarily exit a workspace."""
    role = get_member_role(workspace_id, user_id)
    if not role:
        raise ValueError("Not a member")
        
    if role == 'owner':
        from supabase_client import get_supabase
        owners = get_supabase().table('workspace_members').select('id').eq('workspace_id', workspace_id).eq('role', 'owner').execute()
        if len(owners.data) <= 1:
            raise ValueError("Cannot leave workspace as you are the only owner. Transfer ownership or delete workspace.")
            
    sb_delete('workspace_members', match={'workspace_id': workspace_id, 'user_id': user_id})
    log_workspace_activity(workspace_id, user_id, 'member_left', {})
    return True


# ─── Invites UI ───

def invite_member(workspace_id: int, email: str, role: str, inviter_id: int) -> dict:
    """Send an invitation to join workspace. Insert to workspace_invites."""
    inviter_role = get_member_role(workspace_id, inviter_id)
    if inviter_role not in ('owner', 'editor'):
        raise PermissionError("Only owners and editors can invite")
        
    if role == 'owner' and inviter_role != 'owner':
        raise PermissionError("Only owners can invite new owners")
        
    user = sb_select('users', eq=('email', email), single=True)
    if user:
        if get_member_role(workspace_id, user['id']):
            raise ValueError("User is already a member")
            
    existing_invite = sb_select('workspace_invites', match={'workspace_id': workspace_id, 'email': email}, single=True)
    if existing_invite:
        if existing_invite['status'] == 'pending':
            raise ValueError("Invitation already pending for this email")
        else:
            # Maybe update the old invite
            sb_delete('workspace_invites', match={'id': existing_invite['id']})

    res = sb_insert('workspace_invites', {
        'workspace_id': workspace_id,
        'email': email,
        'role': role,
        'status': 'pending'
    })
    
    log_workspace_activity(workspace_id, inviter_id, 'invite_sent', {'email': email, 'role': role})
    return res.data[0] if res.data else None


def get_pending_invites(workspace_id: int, user_id: int) -> list:
    """Get list of pending invites for a workspace."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member")
        
    res = sb_select('workspace_invites', match={'workspace_id': workspace_id, 'status': 'pending'})
    return res


def accept_invite(workspace_id: int, user_id: int, email: str):
    """Accept an invitation to join."""
    from supabase_client import get_supabase
    
    # Needs a real user check
    invite_res = get_supabase().table('workspace_invites').select('*').eq('workspace_id', workspace_id).eq('email', email).eq('status', 'pending').execute()
    if not invite_res.data:
        raise ValueError("No pending invite found")
    
    invite = invite_res.data[0]
        
    sb_insert('workspace_members', {
        'workspace_id': workspace_id,
        'user_id': user_id,
        'role': invite['role']
    })
    
    sb_update('workspace_invites', {'status': 'accepted'}, match={'id': invite['id']})
    log_workspace_activity(workspace_id, user_id, 'member_joined', {'role': invite['role']})
    return True


def cancel_invite(workspace_id: int, invite_id: int, user_id: int):
    """Cancel a pending invitation."""
    role = get_member_role(workspace_id, user_id)
    if role not in ('owner', 'editor'):
        raise PermissionError("Only owners and editors can cancel invites")
        
    sb_delete('workspace_invites', match={'id': invite_id, 'workspace_id': workspace_id})
    return True


# ─── Documents ───

def share_document(workspace_id: int, document_id: int, user_id: int, permission_level: str = 'viewer') -> dict:
    """Share a document to a workspace."""
    role = get_member_role(workspace_id, user_id)
    if role not in ('owner', 'editor'):
        raise PermissionError("Only owners and editors can share documents")
    
    doc = sb_select('documents', match={'id': document_id, 'user_id': user_id}, single=True)
    if not doc:
        raise ValueError("Document not found or access denied")
    
    res = sb_insert('workspace_documents', {
        'workspace_id': workspace_id,
        'document_id': document_id,
        'shared_by': user_id,
        'permission_level': permission_level
    })
    
    log_workspace_activity(workspace_id, user_id, 'document_shared', {'document_id': document_id, 'title': doc['title']})
    return res.data[0] if res.data else None


def get_workspace_documents(workspace_id: int, user_id: int) -> list:
    """Get all documents shared in a workspace."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member of this workspace")
    
    from supabase_client import get_supabase
    res = get_supabase().table('workspace_documents') \
        .select("permission_level, shared_by, created_at, documents(*), users!workspace_documents_shared_by_fkey(name, email)") \
        .eq('workspace_id', workspace_id) \
        .execute()
    
    docs = []
    for sd in res.data:
        if sd.get('documents'):
            d = sd['documents']
            owner_info = sd.get('users') or {}
            docs.append({
                'id': d['id'],
                'workspace_document_id': sd.get('id'), # if we need it for removing
                'title': d['title'],
                'filename': d['filename'],
                'permission_level': sd.get('permission_level'),
                'shared_by': owner_info.get('name', str(sd['shared_by'])),
                'shared_at': sd['created_at'],
                'mime_type': d.get('mime_type')
            })
    return docs


# ─── Activity Feeds and Chat ───

def get_workspace_activity(workspace_id: int, user_id: int, limit: int = 50) -> list:
    """Get the activity feed for the workspace."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member")
        
    from supabase_client import get_supabase
    res = get_supabase().table('workspace_activity') \
        .select("*, users(name)") \
        .eq('workspace_id', workspace_id) \
        .order('created_at', desc=True) \
        .limit(limit) \
        .execute()
    return res.data


def send_workspace_message(workspace_id: int, user_id: int, content: str) -> dict:
    """Send a human message to the workspace chat."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member of this workspace")
    
    res = sb_insert('workspace_chat', {
        'workspace_id': workspace_id,
        'user_id': user_id,
        'message': content,
        'is_ai': False
    })
    
    log_workspace_activity(workspace_id, user_id, 'chat_message', {})
    
    return res.data[0] if res.data else None


def get_workspace_messages(workspace_id: int, user_id: int, limit: int = 50) -> list:
    """Get recent messages from the workspace chat (both human and AI)."""
    if not get_member_role(workspace_id, user_id):
        raise PermissionError("Not a member")
    
    from supabase_client import get_supabase
    res = get_supabase().table('workspace_chat') \
        .select("*, users(name, email)") \
        .eq('workspace_id', workspace_id) \
        .order('created_at', desc=True) \
        .limit(limit) \
        .execute()
    
    return res.data[::-1] # Return in chronological order
