"""Authentication routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from services.auth_service import register_user, login_user, get_user_profile
from error_handler import ValidationError

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - password
          properties:
            email:
              type: string
            password:
              type: string
            name:
              type: string
    responses:
      201:
        description: User registered successfully
      400:
        description: Validation Error
    """
    data = request.get_json()
    if not data:
        raise ValidationError("Request body required")
    
    email = data.get('email', '')
    password = data.get('password', '')
    name = data.get('name', '')
    
    try:
        result = register_user(email, password, name)
        return jsonify(result), 201
    except Exception as e:
        error_msg = str(e)
        if "rls policy" in error_msg.lower() or "42501" in error_msg:
            return jsonify({'error': 'Database permission error. Please ensure Supabase RLS policies are configured.'}), 403
        return jsonify({'error': error_msg}), 400


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login and get JWT tokens.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - password
          properties:
            email:
              type: string
            password:
              type: string
    responses:
      200:
        description: Login successful
      401:
        description: Invalid credentials
    """
    data = request.get_json()
    if not data:
        raise ValidationError("Request body required")
    
    email = data.get('email', '')
    password = data.get('password', '')
    
    try:
        result = login_user(email, password)
        return jsonify(result), 200
    except Exception as e:
        error_msg = str(e)
        if "rls policy" in error_msg.lower() or "42501" in error_msg:
            return jsonify({'error': 'Database permission error.'}), 403
        if "invalid" in error_msg.lower() or "unauthorized" in error_msg.lower():
            return jsonify({'error': error_msg}), 401
        return jsonify({'error': error_msg}), 400


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    """
    Get authenticated user's profile.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: User profile data
      401:
        description: Unauthorized
    """
    user_id = get_jwt_identity()
    result = get_user_profile(user_id)
    return jsonify(result), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: New access token generated
    """
    user_id = get_jwt_identity()
    new_token = create_access_token(identity=str(user_id))
    return jsonify({'access_token': new_token}), 200
