"""Celery async tasks with synchronous fallback."""
import logging

logger = logging.getLogger(__name__)

# Try to initialize Celery; fall back to sync if unavailable
try:
    from celery import Celery
    from config import get_config
    
    config = get_config()
    celery_app = Celery(
        'knowledge_platform',
        broker=config.REDIS_URL,
        backend=config.REDIS_URL,
    )
    celery_app.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        task_track_started=True,
        task_time_limit=300,  # 5 min max per task
    )
    CELERY_AVAILABLE = True
    logger.info("Celery initialized successfully")
except ImportError:
    CELERY_AVAILABLE = False
    celery_app = None
    logger.warning("Celery not available. Tasks will run synchronously.")


def process_document_async(user_id, document_id):
    """Process document embeddings asynchronously if possible."""
    if CELERY_AVAILABLE:
        _process_document_task.delay(user_id, document_id)
        logger.info(f"Queued document processing: user={user_id}, doc={document_id}")
    else:
        _process_document_sync(user_id, document_id)


def generate_roadmap_async(user_id, goal, level, time_available):
    """Generate roadmap asynchronously if possible."""
    if CELERY_AVAILABLE:
        _generate_roadmap_task.delay(user_id, goal, level, time_available)
    else:
        from services.ai_service import generate_roadmap
        return generate_roadmap(user_id, goal, level, time_available)


def _process_document_sync(user_id, document_id):
    """Synchronous fallback for document processing."""
    try:
        from app import create_app
        app = create_app()
        with app.app_context():
            from services.ai_service import process_document_embeddings
            process_document_embeddings(user_id, document_id)
            logger.info(f"Processed document: user={user_id}, doc={document_id}")
    except Exception as e:
        logger.error(f"Document processing failed: {e}")


if CELERY_AVAILABLE:
    @celery_app.task(bind=True, max_retries=3)
    def _process_document_task(self, user_id, document_id):
        """Celery task for document processing."""
        try:
            from app import create_app
            app = create_app()
            with app.app_context():
                from services.ai_service import process_document_embeddings
                process_document_embeddings(user_id, document_id)
        except Exception as exc:
            logger.error(f"Document processing task failed: {exc}")
            self.retry(exc=exc, countdown=30)
    
    @celery_app.task(bind=True, max_retries=3)
    def _generate_roadmap_task(self, user_id, goal, level, time_available):
        """Celery task for roadmap generation."""
        try:
            from app import create_app
            app = create_app()
            with app.app_context():
                from services.ai_service import generate_roadmap
                generate_roadmap(user_id, goal, level, time_available)
        except Exception as exc:
            logger.error(f"Roadmap generation task failed: {exc}")
            self.retry(exc=exc, countdown=30)
