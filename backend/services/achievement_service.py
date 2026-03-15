"""Achievement service: track and reward user progress."""
import logging
from supabase_client import sb_select, sb_insert

logger = logging.getLogger(__name__)

def check_and_award_achievements(user_id: int, requirement_type: str):
    """Check if user qualifies for any achievement and award it."""
    try:
        # Get all achievements for this type
        all_achievements = sb_select('achievements', eq=('requirement_type', requirement_type))
        
        # Get user's current count for this type
        # For simplicity, we count records in specific tables
        count = 0
        if requirement_type == 'document_upload':
            res = sb_select('documents', eq=('user_id', user_id))
            count = len(res)
        elif requirement_type == 'quiz_completed':
            # This would normally be in a quiz_results table, but for now we look at activity logs
            res = sb_select('activity_logs', match={'user_id': user_id, 'action': 'quiz_completed'})
            count = len(res)
        elif requirement_type == 'mind_map_created':
            res = sb_select('mind_maps', eq=('user_id', user_id))
            count = len(res)
        elif requirement_type == 'workspace_joined':
            res = sb_select('workspace_members', eq=('user_id', user_id))
            count = len(res)
            
        # Get user's existing achievements to avoid duplicates
        existing_res = sb_select('user_achievements', eq=('user_id', user_id))
        existing_ids = [a['achievement_id'] for a in existing_res]
        
        awarded = []
        for achievement in all_achievements:
            if achievement['id'] not in existing_ids:
                if count >= achievement['requirement_count']:
                    # Award it!
                    sb_insert('user_achievements', {
                        'user_id': user_id,
                        'achievement_id': achievement['id']
                    })
                    awarded.append(achievement)
                    logger.info(f"User {user_id} earned achievement: {achievement['name']}")
                    
        return awarded
    except Exception as e:
        logger.error(f"Error checking achievements: {e}")
        return []

def get_user_achievements(user_id: int):
    """Get all achievements earned by a user."""
    from supabase_client import get_supabase
    res = get_supabase().table('user_achievements') \
        .select("*, achievements(*)") \
        .eq('user_id', user_id) \
        .execute()
    
    achievements = []
    for ua in res.data:
        if ua.get('achievements'):
            a = ua['achievements']
            a['unlocked_at'] = ua['unlocked_at']
            achievements.append(a)
    return achievements
