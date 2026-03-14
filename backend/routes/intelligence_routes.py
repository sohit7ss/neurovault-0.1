"""Routes for mind maps, knowledge graph, quiz, and AI assistant."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.intelligence_service import (
    generate_mind_map, generate_knowledge_graph,
    generate_quiz, summarize_document, explain_concept,
    save_mind_map, get_user_mind_maps, get_mind_map,
    update_mind_map, delete_mind_map, convert_mindmap_to_roadmap,
)
from models import db, Document

intelligence_bp = Blueprint('intelligence', __name__, url_prefix='/api/intelligence')


@intelligence_bp.route('/mindmap', methods=['POST'])
@jwt_required()
def create_mind_map():
    """
    Generate a mind map for a topic.
    ---
    tags:
      - Intelligence
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - topic
          properties:
            topic:
              type: string
            use_documents:
              type: boolean
              default: false
            depth:
              type: integer
              default: 3
    responses:
      200:
        description: Generated mind map graph
      400:
        description: Validation Error
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        return jsonify({'error': 'Topic is required'}), 422
    
    # Optionally use user's documents for context
    docs = []
    if data.get('use_documents'):
        user_docs = Document.query.filter_by(user_id=user_id).all()
        docs = [{'id': d.id, 'title': d.title, 'content_text': d.content_text} for d in user_docs]
    
    mind_map = generate_mind_map(topic, docs, depth=data.get('depth', 3))
    return jsonify(mind_map), 200


@intelligence_bp.route('/mindmap/save', methods=['POST'])
@jwt_required()
def save_map():
    """Save a mind map to database."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    title = data.get('title')
    topic = data.get('topic')
    mindmap_data = data.get('mindmap_data')
    if not title or not mindmap_data:
        return jsonify({'error': 'title and mindmap_data required'}), 422
    result = save_mind_map(user_id, title, topic or title, mindmap_data)
    return jsonify(result), 201


@intelligence_bp.route('/mindmaps', methods=['GET'])
@jwt_required()
def list_mind_maps():
    """
    List user's saved mind maps.
    ---
    tags:
      - Intelligence
    security:
      - Bearer: []
    responses:
      200:
        description: A list of mind maps
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    maps = get_user_mind_maps(user_id)
    return jsonify({'mindmaps': maps}), 200


@intelligence_bp.route('/mindmap/<int:map_id>', methods=['GET'])
@jwt_required()
def get_map(map_id):
    """Get a saved mind map."""
    user_id = int(get_jwt_identity())
    result = get_mind_map(user_id, map_id)
    if not result:
        return jsonify({'error': 'Mind map not found'}), 404
    return jsonify(result), 200


@intelligence_bp.route('/mindmap/<int:map_id>', methods=['PUT'])
@jwt_required()
def update_map(map_id):
    """Update a mind map (edit nodes)."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    result = update_mind_map(user_id, map_id, data.get('title'), data.get('mindmap_data'))
    if not result:
        return jsonify({'error': 'Mind map not found or access denied'}), 404
    return jsonify(result), 200


@intelligence_bp.route('/mindmap/<int:map_id>', methods=['DELETE'])
@jwt_required()
def delete_map(map_id):
    """Delete a mind map."""
    user_id = int(get_jwt_identity())
    success = delete_mind_map(user_id, map_id)
    if not success:
        return jsonify({'error': 'Mind map not found'}), 404
    return jsonify({'message': 'Mind map deleted'}), 200


@intelligence_bp.route('/mindmap-to-roadmap', methods=['POST'])
@jwt_required()
def map_to_roadmap():
    """Convert a mind map to a learning roadmap."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    mindmap_data = data.get('mindmap_data')
    if not mindmap_data:
        return jsonify({'error': 'mindmap_data required'}), 422
    result = convert_mindmap_to_roadmap(
        user_id, mindmap_data,
        level=data.get('level', 'beginner'),
        time_available=data.get('time_available', '2 hours/day'),
    )
    return jsonify(result), 201


@intelligence_bp.route('/knowledge-graph', methods=['GET'])
@jwt_required()
def get_knowledge_graph():
    """Generate knowledge graph from user's documents."""
    user_id = int(get_jwt_identity())
    user_docs = Document.query.filter_by(user_id=user_id).all()
    
    if not user_docs:
        return jsonify({'nodes': [], 'edges': [], 'stats': {
            'total_nodes': 0, 'total_edges': 0, 'documents': 0, 'concepts': 0,
        }}), 200
    
    docs = [{'id': d.id, 'title': d.title, 'content_text': d.content_text} for d in user_docs]
    graph = generate_knowledge_graph(user_id, docs)
    return jsonify(graph), 200


@intelligence_bp.route('/quiz', methods=['POST'])
@jwt_required()
def create_quiz():
    """Generate quiz questions from a topic or document."""
    data = request.get_json()
    topic = data.get('topic', 'General Knowledge')
    content = ''
    
    doc_id = data.get('document_id')
    if doc_id:
        user_id = int(get_jwt_identity())
        doc = Document.query.filter_by(id=doc_id, user_id=user_id).first()
        if doc and doc.content_text:
            content = doc.content_text
            topic = doc.title
    
    questions = generate_quiz(topic, content, data.get('num_questions', 5))
    questions['topic'] = topic  # Keep topic parameter for frontend convenience
    return jsonify(questions), 200


@intelligence_bp.route('/summarize/<int:doc_id>', methods=['GET'])
@jwt_required()
def summarize(doc_id):
    """Summarize a document."""
    user_id = int(get_jwt_identity())
    doc = Document.query.filter_by(id=doc_id, user_id=user_id).first()
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    if not doc.content_text:
        return jsonify({'error': 'No text content to summarize'}), 422
    
    summary = summarize_document(doc.content_text)
    return jsonify({'document_id': doc_id, 'title': doc.title, 'summary': summary}), 200


@intelligence_bp.route('/explain', methods=['POST'])
@jwt_required()
def explain():
    """Explain a concept using AI."""
    data = request.get_json()
    concept = data.get('concept')
    if not concept:
        return jsonify({'error': 'Concept is required'}), 422
    
    # Use docs for context
    context = ''
    if data.get('use_documents'):
        user_id = int(get_jwt_identity())
        docs = Document.query.filter_by(user_id=user_id).all()
        context = ' '.join([d.content_text or '' for d in docs[:5]])[:3000]
    
    explanation = explain_concept(concept, context)
    return jsonify({'concept': concept, 'explanation': explanation}), 200
