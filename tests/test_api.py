"""Pytest tests for authentication, documents, and AI services."""
import os
import sys
import json
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app
from models import db as _db
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_SECRET_KEY = 'test-secret'
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'test_uploads')
    VECTOR_STORE_PATH = os.path.join(os.path.dirname(__file__), 'test_vectors')


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Register a user and return auth headers."""
    res = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'TestPass123',
        'name': 'Test User',
    })
    data = json.loads(res.data)
    return {'Authorization': f'Bearer {data["access_token"]}'}


# ─── Auth Tests ───

class TestAuth:
    def test_register(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'new@example.com',
            'password': 'ValidPass1',
            'name': 'New User',
        })
        assert res.status_code == 201
        data = json.loads(res.data)
        assert 'access_token' in data
        assert data['user']['email'] == 'new@example.com'

    def test_register_duplicate(self, client):
        client.post('/api/auth/register', json={
            'email': 'dup@example.com', 'password': 'ValidPass1', 'name': 'User',
        })
        res = client.post('/api/auth/register', json={
            'email': 'dup@example.com', 'password': 'ValidPass1', 'name': 'User2',
        })
        assert res.status_code == 422

    def test_register_weak_password(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'weak@example.com', 'password': 'short', 'name': 'User',
        })
        assert res.status_code == 422

    def test_login(self, client):
        client.post('/api/auth/register', json={
            'email': 'login@example.com', 'password': 'ValidPass1', 'name': 'User',
        })
        res = client.post('/api/auth/login', json={
            'email': 'login@example.com', 'password': 'ValidPass1',
        })
        assert res.status_code == 200
        assert 'access_token' in json.loads(res.data)

    def test_login_wrong_password(self, client):
        client.post('/api/auth/register', json={
            'email': 'wrong@example.com', 'password': 'ValidPass1', 'name': 'User',
        })
        res = client.post('/api/auth/login', json={
            'email': 'wrong@example.com', 'password': 'WrongPass1',
        })
        assert res.status_code == 401

    def test_profile(self, client, auth_headers):
        res = client.get('/api/auth/profile', headers=auth_headers)
        assert res.status_code == 200
        assert json.loads(res.data)['email'] == 'test@example.com'

    def test_profile_unauthorized(self, client):
        res = client.get('/api/auth/profile')
        assert res.status_code == 401


# ─── Document Tests ───

class TestDocuments:
    def test_list_empty(self, client, auth_headers):
        res = client.get('/api/documents', headers=auth_headers)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert data['total'] == 0

    def test_upload_txt(self, client, auth_headers):
        import io
        data = {'file': (io.BytesIO(b'Hello world test content'), 'test.txt')}
        res = client.post('/api/documents/upload',
                          headers=auth_headers, data=data,
                          content_type='multipart/form-data')
        assert res.status_code == 201
        doc = json.loads(res.data)
        assert doc['title'] == 'Test'
        assert doc['status'] in ('ready', 'processing')

    def test_upload_invalid_type(self, client, auth_headers):
        import io
        data = {'file': (io.BytesIO(b'data'), 'virus.exe')}
        res = client.post('/api/documents/upload',
                          headers=auth_headers, data=data,
                          content_type='multipart/form-data')
        assert res.status_code == 422

    def test_delete_document(self, client, auth_headers):
        import io
        data = {'file': (io.BytesIO(b'Delete me'), 'delete.txt')}
        res = client.post('/api/documents/upload',
                          headers=auth_headers, data=data,
                          content_type='multipart/form-data')
        doc_id = json.loads(res.data)['id']
        res = client.delete(f'/api/documents/{doc_id}', headers=auth_headers)
        assert res.status_code == 200

    def test_cross_user_access(self, client):
        """Ensure user A cannot access user B's documents."""
        # Register user A
        res = client.post('/api/auth/register', json={
            'email': 'a@example.com', 'password': 'ValidPass1', 'name': 'A',
        })
        headers_a = {'Authorization': f'Bearer {json.loads(res.data)["access_token"]}'}

        # Register user B
        res = client.post('/api/auth/register', json={
            'email': 'b@example.com', 'password': 'ValidPass1', 'name': 'B',
        })
        headers_b = {'Authorization': f'Bearer {json.loads(res.data)["access_token"]}'}

        # User A uploads
        import io
        data = {'file': (io.BytesIO(b'Secret'), 'secret.txt')}
        res = client.post('/api/documents/upload',
                          headers=headers_a, data=data,
                          content_type='multipart/form-data')
        doc_id = json.loads(res.data)['id']

        # User B tries to access
        res = client.get(f'/api/documents/{doc_id}', headers=headers_b)
        assert res.status_code == 403


# ─── AI Tests ───

class TestAI:
    def test_query_empty(self, client, auth_headers):
        res = client.post('/api/ai/query', headers=auth_headers,
                          json={'query': 'test question'})
        assert res.status_code == 200
        data = json.loads(res.data)
        assert 'answer' in data

    def test_query_no_body(self, client, auth_headers):
        res = client.post('/api/ai/query', headers=auth_headers, json={})
        assert res.status_code == 422


# ─── Roadmap Tests ───

class TestRoadmaps:
    def test_generate(self, client, auth_headers):
        res = client.post('/api/roadmap/generate', headers=auth_headers,
                          json={'goal': 'AI Engineer', 'level': 'beginner'})
        assert res.status_code == 201
        data = json.loads(res.data)
        assert data['goal'] == 'AI Engineer'
        assert 'roadmap_data' in data

    def test_list_roadmaps(self, client, auth_headers):
        client.post('/api/roadmap/generate', headers=auth_headers,
                    json={'goal': 'Data Science'})
        res = client.get('/api/roadmap', headers=auth_headers)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert len(data['roadmaps']) >= 1


# ─── Health Check ───

class TestHealth:
    def test_health(self, client):
        res = client.get('/health')
        assert res.status_code == 200
        data = json.loads(res.data)
        assert data['status'] in ('healthy', 'degraded')
