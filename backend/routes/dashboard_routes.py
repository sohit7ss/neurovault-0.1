"""Dashboard and Achievement routes."""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.dashboard_service import get_dashboard_stats
from services.achievement_service import get_user_achievements

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    """Get dashboard stats and recent activity."""
    user_id = int(get_jwt_identity())
    result = get_dashboard_stats(user_id)
    return jsonify(result), 200

@dashboard_bp.route('/achievements', methods=['GET'])
@jwt_required()
def achievements():
    """Get user achievements."""
    user_id = int(get_jwt_identity())
    result = get_user_achievements(user_id)
    return jsonify({'achievements': result}), 200
