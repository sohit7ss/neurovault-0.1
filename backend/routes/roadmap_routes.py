"""Roadmap routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.ai_service import (
    generate_roadmap, get_roadmap, get_user_roadmaps, update_roadmap_progress
)
from error_handler import ValidationError

roadmap_bp = Blueprint('roadmap', __name__, url_prefix='/api/roadmap')


@roadmap_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate():
    """
    Generate a new learning roadmap.
    ---
    tags:
      - Roadmaps
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - goal
          properties:
            goal:
              type: string
            level:
              type: string
              default: beginner
            time_available:
              type: string
              default: 2 hours/day
    responses:
      201:
        description: Roadmap generated successfully
      400:
        description: Validation Error
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data or not data.get('goal'):
        raise ValidationError("Goal is required")
    
    result = generate_roadmap(
        user_id,
        data['goal'],
        level=data.get('level', 'beginner'),
        time_available=data.get('time_available', '2 hours/day'),
    )
    return jsonify(result), 201


@roadmap_bp.route('', methods=['GET'])
@jwt_required()
def list_roadmaps():
    """
    List user's roadmaps.
    ---
    tags:
      - Roadmaps
    security:
      - Bearer: []
    responses:
      200:
        description: A list of roadmaps
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    result = get_user_roadmaps(user_id)
    return jsonify({'roadmaps': result}), 200


@roadmap_bp.route('/<int:roadmap_id>', methods=['GET'])
@jwt_required()
def get_one(roadmap_id):
    """
    Get a single roadmap.
    ---
    tags:
      - Roadmaps
    security:
      - Bearer: []
    parameters:
      - in: path
        name: roadmap_id
        type: integer
        required: true
        description: ID of the roadmap
    responses:
      200:
        description: Roadmap details
      404:
        description: Roadmap not found
      401:
        description: Unauthorized
    """
    user_id = int(get_jwt_identity())
    result = get_roadmap(user_id, roadmap_id)
    return jsonify(result), 200


@roadmap_bp.route('/<int:roadmap_id>/progress', methods=['PUT'])
@jwt_required()
def update_progress(roadmap_id):
    """Update progress on a roadmap topic."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        raise ValidationError("Request body required")
    
    result = update_roadmap_progress(
        user_id,
        roadmap_id,
        data.get('phase_id', ''),
        data.get('topic_index', 0),
        data.get('completed', False),
    )
    return jsonify(result), 200


@roadmap_bp.route('/<int:roadmap_id>', methods=['DELETE'])
@jwt_required()
def delete(roadmap_id):
    """Delete a roadmap."""
    user_id = int(get_jwt_identity())
    from supabase_client import sb_select, sb_delete
    roadmap = sb_select('roadmaps', match={'id': roadmap_id, 'user_id': user_id}, single=True)
    if not roadmap:
        return jsonify({'error': 'Roadmap not found or access denied'}), 404
    
    sb_delete('roadmaps', match={'id': roadmap_id})
    return jsonify({'message': 'Roadmap deleted'}), 200
