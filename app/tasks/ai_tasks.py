"""
Celery Tasks for AI Operations
Handles long-running AI generation tasks asynchronously
"""
import time
import logging
from datetime import datetime
from celery import Task
from celery_config import celery_app
from flask import current_app

logger = logging.getLogger(__name__)


class AITask(Task):
    """Base task with AI usage tracking"""
    
    def before_start(self, task_id, args, kwargs):
        """Called before task starts"""
        from app.models import db
        from app.models_ai_tracking import AIUsageLog, AIOperationStatus
        from app.websocket_manager import emit_task_status
        
        try:
            log_id = kwargs.get('log_id')
            user_id = kwargs.get('user_id')
            
            if log_id:
                with current_app.app_context():
                    log = AIUsageLog.query.get(log_id)
                    if log:
                        log.status = AIOperationStatus.PROCESSING
                        log.started_at = datetime.utcnow()
                        log.celery_task_id = task_id
                        db.session.commit()
                        
                        # Emit WebSocket status update
                        if user_id:
                            emit_task_status(user_id, {
                                'task_id': task_id,
                                'log_id': log_id,
                                'status': 'processing',
                                'message': 'AI generation in progress...'
                            })
        except Exception as e:
            logger.error(f"[CELERY] Error in before_start: {e}")
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        from app.models import db
        from app.models_ai_tracking import AIUsageLog, AIOperationStatus
        from app.websocket_manager import emit_task_status
        
        try:
            log_id = kwargs.get('log_id')
            user_id = kwargs.get('user_id')
            
            if log_id:
                with current_app.app_context():
                    log = AIUsageLog.query.get(log_id)
                    if log:
                        log.status = AIOperationStatus.COMPLETED
                        log.completed_at = datetime.utcnow()
                        if log.started_at:
                            processing_time = (log.completed_at - log.started_at).total_seconds()
                            log.processing_time_seconds = processing_time
                        db.session.commit()
                        
                        # Emit WebSocket status update
                        if user_id:
                            emit_task_status(user_id, {
                                'task_id': task_id,
                                'log_id': log_id,
                                'status': 'completed',
                                'message': 'AI generation completed successfully!',
                                'result': retval
                            })
        except Exception as e:
            logger.error(f"[CELERY] Error in on_success: {e}")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        from app.models import db
        from app.models_ai_tracking import AIUsageLog, AIOperationStatus
        from app.websocket_manager import emit_task_status
        
        try:
            log_id = kwargs.get('log_id')
            user_id = kwargs.get('user_id')
            
            if log_id:
                with current_app.app_context():
                    log = AIUsageLog.query.get(log_id)
                    if log:
                        log.status = AIOperationStatus.FAILED
                        log.completed_at = datetime.utcnow()
                        log.error_message = str(exc)
                        if log.started_at:
                            processing_time = (log.completed_at - log.started_at).total_seconds()
                            log.processing_time_seconds = processing_time
                        db.session.commit()
                        
                        # Emit WebSocket status update
                        if user_id:
                            emit_task_status(user_id, {
                                'task_id': task_id,
                                'log_id': log_id,
                                'status': 'failed',
                                'message': f'AI generation failed: {str(exc)}'
                            })
        except Exception as e:
            logger.error(f"[CELERY] Error in on_failure: {e}")


@celery_app.task(base=AITask, bind=True, name='app.tasks.ai_tasks.generate_survey_quick')
def generate_survey_quick_task(self, prompt, user_id=None, business_id=None, log_id=None):
    """
    Celery task for quick survey generation
    """
    logger.info(f"[CELERY] Starting quick survey generation task {self.request.id}")
    
    try:
        with current_app.app_context():
            from app.controllers.ai_controller import quick_generate_survey_ai
            
            result, status = quick_generate_survey_ai(prompt)
            
            if status == 200:
                logger.info(f"[CELERY] Quick survey generation completed successfully")
                return {'success': True, 'survey': result.get('survey'), 'log_id': log_id}
            else:
                logger.error(f"[CELERY] Quick survey generation failed with status {status}")
                raise Exception(result.get('error', 'Unknown error'))
                
    except Exception as e:
        logger.error(f"[CELERY] Error in generate_survey_quick_task: {e}", exc_info=True)
        raise


@celery_app.task(base=AITask, bind=True, name='app.tasks.ai_tasks.generate_survey_guided')
def generate_survey_guided_task(self, industry, goal, description, tone_length, user_id=None, business_id=None, log_id=None):
    """
    Celery task for guided survey generation
    """
    logger.info(f"[CELERY] Starting guided survey generation task {self.request.id}")
    
    try:
        with current_app.app_context():
            from app.controllers.ai_controller import guided_generate_survey_ai
            
            result, status = guided_generate_survey_ai(industry, goal, description, tone_length)
            
            if status == 200:
                logger.info(f"[CELERY] Guided survey generation completed successfully")
                return {'success': True, 'survey': result.get('survey'), 'log_id': log_id}
            else:
                logger.error(f"[CELERY] Guided survey generation failed with status {status}")
                raise Exception(result.get('error', 'Unknown error'))
                
    except Exception as e:
        logger.error(f"[CELERY] Error in generate_survey_guided_task: {e}", exc_info=True)
        raise


@celery_app.task(base=AITask, bind=True, name='app.tasks.ai_tasks.generate_ai_insights')
def generate_ai_insights_task(self, survey_id, selected_question_ids, filters, comparison_settings, user_id=None, business_id=None, log_id=None):
    """
    Celery task for AI insights generation
    """
    logger.info(f"[CELERY] Starting AI insights generation task {self.request.id} for survey {survey_id}")
    
    try:
        with current_app.app_context():
            from app.controllers.ai_controller import generate_ai_report_insights
            
            result, status = generate_ai_report_insights(survey_id, selected_question_ids, filters, comparison_settings)
            
            if status == 200:
                logger.info(f"[CELERY] AI insights generation completed successfully")
                return {'success': True, 'report': result, 'log_id': log_id}
            else:
                logger.error(f"[CELERY] AI insights generation failed with status {status}")
                raise Exception(result.get('error', 'Unknown error'))
                
    except Exception as e:
        logger.error(f"[CELERY] Error in generate_ai_insights_task: {e}", exc_info=True)
        raise


@celery_app.task(base=AITask, bind=True, name='app.tasks.ai_tasks.generate_survey_responses')
def generate_survey_responses_task(self, survey_id, num_responses, user_id=None, business_id=None, log_id=None):
    """
    Celery task for AI response generation
    """
    logger.info(f"[CELERY] Starting response generation task {self.request.id} for survey {survey_id}")
    
    try:
        with current_app.app_context():
            from app.controllers.ai_controller import auto_generate_survey_responses_ai
            
            result, status = auto_generate_survey_responses_ai(survey_id, num_responses)
            
            if status == 200:
                logger.info(f"[CELERY] Response generation completed successfully")
                return {'success': True, 'result': result, 'log_id': log_id}
            else:
                logger.error(f"[CELERY] Response generation failed with status {status}")
                raise Exception(result.get('error', 'Unknown error'))
                
    except Exception as e:
        logger.error(f"[CELERY] Error in generate_survey_responses_task: {e}", exc_info=True)
        raise


@celery_app.task(name='app.tasks.ai_tasks.cleanup_old_logs')
def cleanup_old_logs_task():
    """
    Periodic task to cleanup old AI usage logs
    Runs daily to maintain database performance
    """
    logger.info("[CELERY] Starting cleanup of old AI usage logs")
    
    try:
        with current_app.app_context():
            from app.models import db
            from app.models_ai_tracking import AIUsageLog
            from datetime import timedelta
            
            # Delete logs older than 90 days
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            old_logs = AIUsageLog.query.filter(AIUsageLog.created_at < cutoff_date).all()
            
            count = len(old_logs)
            for log in old_logs:
                db.session.delete(log)
            
            db.session.commit()
            logger.info(f"[CELERY] Cleaned up {count} old AI usage logs")
            return {'success': True, 'deleted_count': count}
            
    except Exception as e:
        logger.error(f"[CELERY] Error in cleanup_old_logs_task: {e}", exc_info=True)
        raise


