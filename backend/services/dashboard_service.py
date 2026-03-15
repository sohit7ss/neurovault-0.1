"""Dashboard service: analytics and overview data."""
import logging
from supabase_client import sb_select, get_supabase

logger = logging.getLogger(__name__)

def get_dashboard_stats(user_id: int):
    """Get overview statistics for the user dashboard."""
    try:
        # Total documents
        docs_res = sb_select('documents', eq=('user_id', user_id))
        total_docs = len(docs_res)
        
        # Total storage used (bytes)
        total_size = sum(d.get('file_size', 0) for d in docs_res)
        
        # Total roadmaps
        roadmaps_res = sb_select('roadmaps', eq=('user_id', user_id))
        total_roadmaps = len(roadmaps_res)
        
        # Total mind maps
        mindmaps_res = sb_select('mind_maps', eq=('user_id', user_id))
        total_mindmaps = len(mindmaps_res)
        
        # Recent activity
        activity_res = get_supabase().table('activity_logs') \
            .select("*") \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(5) \
            .execute()
            
        # Achievements count
        achievements_res = sb_select('user_achievements', eq=('user_id', user_id))
        total_achievements = len(achievements_res)
        
        return {
            'stats': {
                'documents': total_docs,
                'storage_used_mb': round(total_size / (1024 * 1024), 2),
                'roadmaps': total_roadmaps,
                'mind_maps': total_mindmaps,
                'achievements': total_achievements,
            },
            'recent_activity': activity_res.data
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return {
            'stats': {'documents': 0, 'storage_used_mb': 0, 'roadmaps': 0, 'mind_maps': 0, 'achievements': 0},
            'recent_activity': []
        }
