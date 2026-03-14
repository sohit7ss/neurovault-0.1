"""Collaboration service for shared workspaces and team knowledge bases."""
import logging
from models import db
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class Workspace(db.Model):
    __tablename__ = 'workspaces'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default='')
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    
    owner = relationship('User', backref='owned_workspaces')
    members = relationship('WorkspaceMember', backref='workspace', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'owner_id': self.owner_id,
            'is_public': self.is_public,
            'member_count': len(self.members),
            'created_at': self.created_at.isoformat(),
        }


class WorkspaceMember(db.Model):
    __tablename__ = 'workspace_members'
    
    id = Column(Integer, primary_key=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    role = Column(String(20), default='viewer')  # owner, editor, viewer
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship('User', backref='workspace_memberships')
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'user_id': self.user_id,
            'role': self.role,
            'user_name': self.user.name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'joined_at': self.joined_at.isoformat(),
        }


class SharedDocument(db.Model):
    __tablename__ = 'shared_documents'
    
    id = Column(Integer, primary_key=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id'), nullable=False)
    document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
    shared_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    shared_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    workspace = relationship('Workspace', backref='shared_documents')
    document = relationship('Document', backref='shares')


# ─── Service Functions ───

def create_workspace(owner_id: int, name: str, description: str = '') -> dict:
    """Create a new workspace and add owner as member."""
    workspace = Workspace(name=name, description=description, owner_id=owner_id)
    db.session.add(workspace)
    db.session.flush()
    
    member = WorkspaceMember(workspace_id=workspace.id, user_id=owner_id, role='owner')
    db.session.add(member)
    db.session.commit()
    
    return workspace.to_dict()


def get_user_workspaces(user_id: int) -> list:
    """Get all workspaces a user is a member of."""
    memberships = WorkspaceMember.query.filter_by(user_id=user_id).all()
    return [m.workspace.to_dict() for m in memberships if m.workspace]


def invite_member(workspace_id: int, user_email: str, role: str, inviter_id: int) -> dict:
    """Invite a user to a workspace."""
    from models import User
    
    # Check inviter is owner/editor
    inviter = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=inviter_id
    ).first()
    if not inviter or inviter.role not in ('owner', 'editor'):
        raise PermissionError("Only owners and editors can invite members")
    
    # Find user
    user = User.query.filter_by(email=user_email).first()
    if not user:
        raise ValueError("User not found")
    
    # Check not already member
    existing = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=user.id
    ).first()
    if existing:
        raise ValueError("User is already a member")
    
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=role)
    db.session.add(member)
    db.session.commit()
    
    return member.to_dict()


def share_document(workspace_id: int, document_id: int, user_id: int) -> dict:
    """Share a document to a workspace."""
    from models import Document
    
    # Check user is member
    member = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=user_id
    ).first()
    if not member or member.role == 'viewer':
        raise PermissionError("You don't have permission to share documents")
    
    # Check document belongs to user
    doc = Document.query.filter_by(id=document_id, user_id=user_id).first()
    if not doc:
        raise ValueError("Document not found")
    
    shared = SharedDocument(
        workspace_id=workspace_id, document_id=document_id, shared_by=user_id
    )
    db.session.add(shared)
    db.session.commit()
    
    return {'id': shared.id, 'document_id': document_id, 'workspace_id': workspace_id}


def get_workspace_documents(workspace_id: int, user_id: int) -> list:
    """Get all documents shared in a workspace."""
    member = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=user_id
    ).first()
    if not member:
        raise PermissionError("Not a member of this workspace")
    
    shared_docs = SharedDocument.query.filter_by(workspace_id=workspace_id).all()
    return [{
        'id': sd.document.id,
        'title': sd.document.title,
        'filename': sd.document.filename,
        'shared_by': sd.shared_by,
        'shared_at': sd.shared_at.isoformat(),
    } for sd in shared_docs if sd.document]


def remove_member(workspace_id: int, user_id: int, remover_id: int):
    """Remove a member from workspace."""
    remover = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=remover_id
    ).first()
    if not remover or remover.role != 'owner':
        raise PermissionError("Only workspace owner can remove members")
    
    member = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=user_id
    ).first()
    if not member:
        raise ValueError("Member not found")
    if member.role == 'owner':
        raise ValueError("Cannot remove owner")
    
    db.session.delete(member)
    db.session.commit()
