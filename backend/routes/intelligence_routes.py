"""Routes for mind maps, knowledge graph, quiz, and AI assistant."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.intelligence_service import (
    generate_mind_map, generate_knowledge_graph,
    generate_quiz, summarize_document, explain_concept,
    generate_tutor_followup,
    save_mind_map, get_user_mind_maps, get_mind_map,
    update_mind_map, delete_mind_map, convert_mindmap_to_roadmap,
)
from supabase_client import sb_select, sb_insert, get_supabase

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
        user_docs = sb_select('documents', eq=('user_id', user_id))
        docs = [{'id': d['id'], 'title': d['title'], 'content_text': d['content_text']} for d in user_docs]
    
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
    user_docs = sb_select('documents', eq=('user_id', user_id))
    
    if not user_docs:
        return jsonify({'nodes': [], 'edges': [], 'stats': {
            'total_nodes': 0, 'total_edges': 0, 'documents': 0, 'concepts': 0,
        }}), 200
    
    docs = [{'id': d['id'], 'title': d['title'], 'content_text': d['content_text']} for d in user_docs]
    graph = generate_knowledge_graph(user_id, docs)
    return jsonify(graph), 200


@intelligence_bp.route('/quiz', methods=['POST'])
@jwt_required()
def create_quiz():
    """Generate quiz questions from a topic or document."""
    data = request.get_json()
    topic = data.get('topic', 'General Knowledge')
    content = ''
    
    # Check if we should use all documents (RAG mode)
    use_documents = data.get('use_documents', False)
    doc_id = data.get('document_id')
    user_id = int(get_jwt_identity())
    
    if use_documents:
        user_docs = sb_select('documents', eq=('user_id', user_id))
        content = ' '.join([str(d.get('content_text', '')) for d in user_docs[:10]])[:15000] # Provide general context
        if not content.strip():
            content = "WARNING: No document content found. Switch to general knowledge. "
    elif doc_id:
        doc = sb_select('documents', match={'id': doc_id, 'user_id': user_id}, single=True)
        if doc and doc.get('content_text'):
            content = doc['content_text']
            topic = doc['title']
    
    difficulty = data.get('difficulty', 'medium')
    questions = generate_quiz(topic, content, data.get('num_questions', 5), difficulty)
    questions['topic'] = topic  # Keep topic parameter for frontend convenience
    return jsonify(questions), 200

@intelligence_bp.route('/quiz/save-attempt', methods=['POST'])
@jwt_required()
def save_quiz_attempt():
    """Save user quiz result."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    attempt = {
        'user_id': user_id,
        'topic': data.get('topic', 'General Knowledge'),
        'score': data.get('score', 0),
        'total_questions': data.get('total_questions', 0),
        'time_taken_seconds': data.get('time_taken_seconds', 0),
        'difficulty': data.get('difficulty', 'medium')
    }
    
    try:
        sb_insert('quiz_attempts', attempt)
        return jsonify({'message': 'Attempt saved'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@intelligence_bp.route('/quiz/history', methods=['GET'])
@jwt_required()
def get_quiz_history():
    """Get user's recent quiz attempts."""
    user_id = int(get_jwt_identity())
    try:
        attempts = sb_select('quiz_attempts', eq=('user_id', user_id), order=('created_at', {'ascending': False}))
        # Return last 10
        return jsonify({'attempts': attempts[:10] if attempts else []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@intelligence_bp.route('/quiz/weak-topics', methods=['GET'])
@jwt_required()
def get_weak_topics():
    """Get topics where user scores below 60% repeatedly."""
    user_id = int(get_jwt_identity())
    try:
        attempts = sb_select('quiz_attempts', eq=('user_id', user_id))
        if not attempts:
            return jsonify({'weak_topics': []}), 200
            
        topic_stats = {}
        for a in attempts:
            t = a.get('topic', '')
            if t not in topic_stats:
                topic_stats[t] = {'total_score': 0, 'total_qs': 0, 'count': 0}
            topic_stats[t]['total_score'] += a.get('score', 0)
            topic_stats[t]['total_qs'] += a.get('total_questions', 0)
            topic_stats[t]['count'] += 1
            
        weak = []
        for t, stats in topic_stats.items():
            if stats['total_qs'] > 0 and stats['count'] >= 2:
                pct = (stats['total_score'] / stats['total_qs']) * 100
                if pct < 60:
                    weak.append({'topic': t, 'average': round(pct, 1), 'attempts': stats['count']})
                    
        return jsonify({'weak_topics': sorted(weak, key=lambda x: x['average'])}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@intelligence_bp.route('/summarize/<int:doc_id>', methods=['GET'])
@jwt_required()
def summarize(doc_id):
    """Summarize a document."""
    user_id = int(get_jwt_identity())
    doc = sb_select('documents', match={'id': doc_id, 'user_id': user_id}, single=True)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    if not doc.get('content_text'):
        return jsonify({'error': 'No text content to summarize'}), 422
    
    summary = summarize_document(doc['content_text'])
    return jsonify({'document_id': doc_id, 'title': doc['title'], 'summary': summary}), 200


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
        docs = sb_select('documents', eq=('user_id', user_id))
        context = ' '.join([d.get('content_text', '') for d in docs[:5]])[:3000]
    
    explanation = explain_concept(concept, context)
    return jsonify({'concept': concept, 'explanation': explanation}), 200

@intelligence_bp.route('/tutor/followup', methods=['POST'])
@jwt_required()
def followup():
    """AI Tutor responds to follow up questions."""
    data = request.get_json()
    topic = data.get('topic')
    question = data.get('question')
    context = data.get('context', [])
    
    if not question:
        return jsonify({'error': 'Question is required'}), 422
        
    answer = generate_tutor_followup(topic, question, context)
    return jsonify({'answer': answer}), 200
