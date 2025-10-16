# app/controllers/ai_usage_analytics_controller.py

from datetime import datetime, timedelta
from flask import current_app, g
from sqlalchemy import func, desc
from app.models import (
    db, AIUsageLog, AISurveyGeneration, AIAnalyticsGeneration, 
    Business
)
from app.utils.openai_cost_calculator import OpenAICostCalculator

class AIUsageAnalyticsController:
    """Controller for AI usage analytics and tracking"""

    @staticmethod
    def log_ai_operation(operation_type, operation_subtype=None, survey_id=None, 
                        points_cost=0, processing_time=None, success=True, 
                        error_message=None, metadata=None, estimated_tokens=None,
                        openai_cost_usd=None, input_tokens=None, output_tokens=None,
                        model_used=None, openai_request_id=None, business_id=None):
        """
        Log an AI operation for analytics tracking
        
        Args:
            operation_type: 'survey_generation', 'analytics_report', 'response_generation'
            operation_subtype: 'quick', 'guided_short', 'guided_medium', 'guided_long', 'insights', 'auto_responses'
            survey_id: ID of the survey if applicable
            points_cost: Number of AI points consumed
            processing_time: Time taken in seconds
            success: Whether the operation succeeded
            error_message: Error message if failed
            metadata: Additional context data
            estimated_tokens: Estimated OpenAI tokens used
            openai_cost_usd: Actual OpenAI API cost in USD
            input_tokens: Actual input tokens from OpenAI response
            output_tokens: Actual output tokens from OpenAI response
            model_used: OpenAI model used (e.g., 'gpt-4o')
            openai_request_id: OpenAI request ID for tracking
            business_id: Optional explicit business context override
        """
        try:
            metadata_payload = metadata if isinstance(metadata, dict) else (metadata or {})

            # Resolve user/admin context
            current_user = getattr(g, 'current_user', None)
            user_role = getattr(g, 'user_role', None)
            
            # Determine if this is a super admin or regular user
            user_id = None
            admin_id = None
            
            if current_user:
                if user_role == 'super_admin':
                    # This is a super admin from the admins table
                    admin_id = current_user.id
                    current_app.logger.info(f"[AI ANALYTICS] Detected super_admin operation by admin_id: {admin_id}")
                else:
                    # This is a regular user or business_admin from the users table
                    user_id = current_user.id

            # Resolve business context with explicit override precedence
            resolved_business_id = business_id

            if resolved_business_id is None and current_user and hasattr(current_user, 'business_id'):
                resolved_business_id = current_user.business_id

            # Decorators may inject business context on g
            if resolved_business_id is None:
                business_ctx = getattr(g, 'business', None)
                if business_ctx is not None:
                    resolved_business_id = getattr(business_ctx, 'id', None)

            if resolved_business_id is None and isinstance(metadata_payload, dict):
                resolved_business_id = metadata_payload.get('business_id')

            # Allow logging without business context for super admin operations
            # The database schema supports NULL business_id
            if resolved_business_id is None:
                identifier = f"admin {admin_id}" if admin_id else f"user {user_id}" if user_id else "unknown"
                current_app.logger.info(
                    f"[AI ANALYTICS] Logging AI operation without business context: {operation_type} by {identifier} (likely super_admin)"
                )
            
            # Create the usage log entry
            usage_log = AIUsageLog(
                business_id=resolved_business_id,
                user_id=user_id,
                admin_id=admin_id,
                operation_type=operation_type,
                operation_subtype=operation_subtype,
                survey_id=survey_id,
                points_cost=points_cost,
                estimated_tokens_used=estimated_tokens,
                openai_cost_usd=openai_cost_usd,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                model_used=model_used,
                openai_request_id=openai_request_id,
                processing_time_seconds=processing_time,
                success=success,
                error_message=error_message,
                additional_data=metadata_payload
            )
            
            db.session.add(usage_log)
            db.session.flush()  # Get the ID
            
            business_context = f"business {resolved_business_id}" if resolved_business_id else "no business context (super_admin)"
            current_app.logger.info(f"[AI ANALYTICS] Logged AI operation: {operation_type}/{operation_subtype} for {business_context}")
            return usage_log.id
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to log AI operation: {e}", exc_info=True)
            db.session.rollback()
            return None

    @staticmethod
    def log_survey_generation(usage_log_id, generation_type, prompt_text=None, 
                            industry=None, goal=None, tone_length=None,
                            questions_generated=None, survey_title=None):
        """Log detailed survey generation information"""
        try:
            survey_gen = AISurveyGeneration(
                usage_log_id=usage_log_id,
                generation_type=generation_type,
                prompt_text=prompt_text,
                industry=industry,
                goal=goal,
                tone_length=tone_length,
                questions_generated=questions_generated,
                survey_title=survey_title
            )
            
            db.session.add(survey_gen)
            current_app.logger.info(f"[AI ANALYTICS] Logged survey generation details for usage_log {usage_log_id}")
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to log survey generation: {e}", exc_info=True)

    @staticmethod
    def log_analytics_generation(usage_log_id, survey_id, questions_analyzed, 
                               filters_applied=None, comparison_mode=False,
                               insights_generated=None, charts_generated=None):
        """Log detailed analytics generation information"""
        try:
            analytics_gen = AIAnalyticsGeneration(
                usage_log_id=usage_log_id,
                survey_id=survey_id,
                questions_analyzed=questions_analyzed,
                filters_applied=filters_applied,
                comparison_mode=comparison_mode,
                insights_generated=insights_generated,
                charts_generated=charts_generated
            )
            
            db.session.add(analytics_gen)
            current_app.logger.info(f"[AI ANALYTICS] Logged analytics generation details for usage_log {usage_log_id}")
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to log analytics generation: {e}", exc_info=True)

    @staticmethod
    def mark_survey_as_saved(survey_id):
        """Mark AI-generated surveys as saved when they're actually persisted"""
        try:
            # Find recent AI usage logs for this survey and mark as saved
            recent_logs = AIUsageLog.query.filter(
                AIUsageLog.survey_id == survey_id,
                AIUsageLog.operation_type == 'survey_generation',
                AIUsageLog.created_at >= datetime.utcnow() - timedelta(hours=1)  # Within last hour
            ).all()
            
            for log in recent_logs:
                log.survey_saved = True
            
            if recent_logs:
                db.session.commit()
                current_app.logger.info(f"[AI ANALYTICS] Marked {len(recent_logs)} AI generation logs as saved for survey {survey_id}")
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to mark survey as saved: {e}", exc_info=True)
            db.session.rollback()

    @staticmethod
    def get_ai_usage_dashboard_stats():
        """Get AI usage statistics for super admin dashboard"""
        try:
            # Time ranges
            now = datetime.utcnow()
            last_30_days = now - timedelta(days=30)
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Survey generation stats
            total_surveys_generated = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'survey_generation'
            ).count()
            
            surveys_generated_last_30_days = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'survey_generation',
                AIUsageLog.created_at >= last_30_days
            ).count()
            
            surveys_generated_today = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'survey_generation',
                AIUsageLog.created_at >= today
            ).count()
            
            surveys_saved = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'survey_generation',
                AIUsageLog.survey_saved
            ).count()
            
            surveys_discarded = total_surveys_generated - surveys_saved
            
            # Analytics reports generated
            total_analytics_reports = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'analytics_report'
            ).count()
            
            analytics_reports_last_30_days = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'analytics_report',
                AIUsageLog.created_at >= last_30_days
            ).count()
            
            # Response generation stats
            total_response_generations = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'response_generation'
            ).count()
            
            response_generations_last_30_days = AIUsageLog.query.filter(
                AIUsageLog.operation_type == 'response_generation',
                AIUsageLog.created_at >= last_30_days
            ).count()
            
            # OpenAI cost consumption
            total_openai_cost = db.session.query(func.sum(AIUsageLog.openai_cost_usd)).scalar() or 0
            openai_cost_last_30_days = db.session.query(func.sum(AIUsageLog.openai_cost_usd)).filter(
                AIUsageLog.created_at >= last_30_days
            ).scalar() or 0
            openai_cost_today = db.session.query(func.sum(AIUsageLog.openai_cost_usd)).filter(
                AIUsageLog.created_at >= today
            ).scalar() or 0
            
            # Most active businesses
            top_businesses = db.session.query(
                Business.name,
                func.count(AIUsageLog.id).label('operation_count'),
                func.sum(AIUsageLog.openai_cost_usd).label('total_openai_cost')
            ).join(AIUsageLog).group_by(Business.id, Business.name).order_by(
                desc('operation_count')
            ).limit(5).all()
            
            # Super admin operations (no business context)
            super_admin_operations = AIUsageLog.query.filter(
                AIUsageLog.business_id.is_(None)
            ).count()
            
            super_admin_cost = db.session.query(func.sum(AIUsageLog.openai_cost_usd)).filter(
                AIUsageLog.business_id.is_(None)
            ).scalar() or 0
            
            return {
                'overview': {
                    'total_surveys_generated': total_surveys_generated,
                    'surveys_generated_last_30_days': surveys_generated_last_30_days,
                    'surveys_generated_today': surveys_generated_today,
                    'total_analytics_reports': total_analytics_reports,
                    'analytics_reports_last_30_days': analytics_reports_last_30_days,
                    'total_response_generations': total_response_generations,
                    'response_generations_last_30_days': response_generations_last_30_days,
                    'total_openai_cost_usd': float(total_openai_cost) if total_openai_cost else 0,
                    'openai_cost_last_30_days': float(openai_cost_last_30_days) if openai_cost_last_30_days else 0,
                    'openai_cost_today': float(openai_cost_today) if openai_cost_today else 0
                },
                'survey_generation': {
                    'total_generated': total_surveys_generated,
                    'surveys_saved': surveys_saved,
                    'surveys_discarded': surveys_discarded
                },
                'super_admin_operations': {
                    'total_operations': super_admin_operations,
                    'total_openai_cost_usd': float(super_admin_cost) if super_admin_cost else 0
                },
                'top_businesses': [
                    {
                        'name': business.name,
                        'operations': business.operation_count,
                        'openai_cost_usd': float(business.total_openai_cost) if business.total_openai_cost else 0
                    }
                    for business in top_businesses
                ]
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to get dashboard stats: {e}", exc_info=True)
            return {"error": "Failed to retrieve AI usage statistics"}, 500

    @staticmethod
    def get_ai_usage_detailed_logs(page=1, per_page=50, filters=None):
        """Get detailed AI usage logs with filtering and pagination"""
        try:
            query = db.session.query(AIUsageLog).order_by(desc(AIUsageLog.created_at))
            
            # Apply filters
            if filters:
                if filters.get('operation_type'):
                    query = query.filter(AIUsageLog.operation_type == filters['operation_type'])
                
                if filters.get('business_id'):
                    query = query.filter(AIUsageLog.business_id == filters['business_id'])
                
                if filters.get('success') is not None:
                    query = query.filter(AIUsageLog.success == filters['success'])
                
                if filters.get('date_from'):
                    query = query.filter(AIUsageLog.created_at >= filters['date_from'])
                
                if filters.get('date_to'):
                    query = query.filter(AIUsageLog.created_at <= filters['date_to'])
            
            # Paginate
            paginated = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            # Convert to dict with additional info
            logs = []
            for log in paginated.items:
                log_dict = log.to_dict()
                
                # Add survey generation details if applicable
                if log.operation_type == 'survey_generation' and log.survey_generations:
                    survey_gen = log.survey_generations[0]
                    log_dict['generation_details'] = survey_gen.to_dict()
                
                # Add analytics generation details if applicable
                if log.operation_type == 'analytics_report' and log.analytics_generations:
                    analytics_gen = log.analytics_generations[0]
                    log_dict['analytics_details'] = analytics_gen.to_dict()
                
                logs.append(log_dict)
            
            return {
                'logs': logs,
                'pagination': {
                    'page': paginated.page,
                    'per_page': paginated.per_page,
                    'total': paginated.total,
                    'pages': paginated.pages,
                    'has_prev': paginated.has_prev,
                    'has_next': paginated.has_next
                }
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to get detailed logs: {e}", exc_info=True)
            return {"error": "Failed to retrieve detailed AI usage logs"}, 500

    @staticmethod
    def get_ai_usage_charts_data():
        """Get data for AI usage analytics charts"""
        try:
            # Usage over time (last 30 days)
            last_30_days = datetime.utcnow() - timedelta(days=30)
            
            daily_usage = db.session.query(
                func.date(AIUsageLog.created_at).label('date'),
                func.count(AIUsageLog.id).label('operations'),
                func.sum(AIUsageLog.openai_cost_usd).label('openai_cost'),
                func.sum(AIUsageLog.input_tokens).label('input_tokens'),
                func.sum(AIUsageLog.output_tokens).label('output_tokens')
            ).filter(
                AIUsageLog.created_at >= last_30_days
            ).group_by(
                func.date(AIUsageLog.created_at)
            ).order_by('date').all()
            
            # Operation type distribution
            operation_distribution = db.session.query(
                AIUsageLog.operation_type,
                func.count(AIUsageLog.id).label('count')
            ).group_by(AIUsageLog.operation_type).all()
            
            # Survey generation type distribution
            survey_type_distribution = db.session.query(
                AISurveyGeneration.generation_type,
                func.count(AISurveyGeneration.id).label('count')
            ).group_by(AISurveyGeneration.generation_type).all()
            
            return {
                'daily_usage': [
                    {
                        'date': str(usage.date),
                        'operations': usage.operations,
                        'openai_cost_usd': float(usage.openai_cost) if usage.openai_cost else 0,
                        'input_tokens': usage.input_tokens or 0,
                        'output_tokens': usage.output_tokens or 0,
                        'total_tokens': (usage.input_tokens or 0) + (usage.output_tokens or 0)
                    }
                    for usage in daily_usage
                ],
                'operation_distribution': [
                    {
                        'operation_type': op.operation_type,
                        'count': op.count
                    }
                    for op in operation_distribution
                ],
                'survey_type_distribution': [
                    {
                        'generation_type': survey.generation_type,
                        'count': survey.count
                    }
                    for survey in survey_type_distribution
                ]
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to get charts data: {e}", exc_info=True)
            return {"error": "Failed to retrieve AI usage charts data"}, 500

    @staticmethod
    def get_business_ai_usage_summary():
        """Get AI usage summary by business for super admin"""
        try:
            business_usage = db.session.query(
                Business.id,
                Business.name,
                func.count(AIUsageLog.id).label('total_operations'),
                func.sum(AIUsageLog.openai_cost_usd).label('total_openai_cost'),
                func.max(AIUsageLog.created_at).label('last_activity')
            ).join(AIUsageLog).group_by(
                Business.id, Business.name
            ).order_by(desc('total_operations')).all()
            
            return {
                'business_usage': [
                    {
                        'business_id': usage.id,
                        'business_name': usage.name,
                        'total_operations': usage.total_operations,
                        'openai_cost_usd': float(usage.total_openai_cost) if usage.total_openai_cost else 0,
                        'last_activity': usage.last_activity.isoformat() if usage.last_activity else None
                    }
                    for usage in business_usage
                ]
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to get business usage summary: {e}", exc_info=True)
            return {"error": "Failed to retrieve business AI usage summary"}, 500

    @staticmethod
    def get_openai_cost_breakdown():
        """Get detailed OpenAI cost breakdown and pricing information"""
        try:
            # Model usage distribution with costs
            model_usage = db.session.query(
                AIUsageLog.model_used,
                func.count(AIUsageLog.id).label('request_count'),
                func.sum(AIUsageLog.openai_cost_usd).label('total_cost'),
                func.sum(AIUsageLog.input_tokens).label('total_input_tokens'),
                func.sum(AIUsageLog.output_tokens).label('total_output_tokens'),
                func.avg(AIUsageLog.openai_cost_usd).label('avg_cost_per_request')
            ).filter(
                AIUsageLog.model_used.isnot(None)
            ).group_by(AIUsageLog.model_used).order_by(
                desc('total_cost')
            ).all()

            # Daily cost breakdown (last 30 days)
            last_30_days = datetime.utcnow() - timedelta(days=30)
            daily_costs = db.session.query(
                func.date(AIUsageLog.created_at).label('date'),
                func.sum(AIUsageLog.openai_cost_usd).label('daily_cost'),
                func.count(AIUsageLog.id).label('daily_requests')
            ).filter(
                AIUsageLog.created_at >= last_30_days,
                AIUsageLog.openai_cost_usd.isnot(None)
            ).group_by(
                func.date(AIUsageLog.created_at)
            ).order_by('date').all()

            # Cost by operation type
            operation_costs = db.session.query(
                AIUsageLog.operation_type,
                AIUsageLog.operation_subtype,
                func.count(AIUsageLog.id).label('request_count'),
                func.sum(AIUsageLog.openai_cost_usd).label('total_cost'),
                func.avg(AIUsageLog.openai_cost_usd).label('avg_cost')
            ).filter(
                AIUsageLog.openai_cost_usd.isnot(None)
            ).group_by(
                AIUsageLog.operation_type, AIUsageLog.operation_subtype
            ).order_by(desc('total_cost')).all()

            # Top 10 most expensive requests
            expensive_requests = db.session.query(AIUsageLog).filter(
                AIUsageLog.openai_cost_usd.isnot(None)
            ).order_by(desc(AIUsageLog.openai_cost_usd)).limit(10).all()

            return {
                'model_usage': [
                    {
                        'model': usage.model_used,
                        'request_count': usage.request_count,
                        'total_cost_usd': float(usage.total_cost) if usage.total_cost else 0,
                        'total_input_tokens': usage.total_input_tokens or 0,
                        'total_output_tokens': usage.total_output_tokens or 0,
                        'total_tokens': (usage.total_input_tokens or 0) + (usage.total_output_tokens or 0),
                        'avg_cost_per_request': float(usage.avg_cost_per_request) if usage.avg_cost_per_request else 0
                    }
                    for usage in model_usage
                ],
                'daily_costs': [
                    {
                        'date': str(cost.date),  # cost.date is already a string from func.date()
                        'daily_cost_usd': float(cost.daily_cost) if cost.daily_cost else 0,
                        'daily_requests': cost.daily_requests
                    }
                    for cost in daily_costs
                ],
                'operation_costs': [
                    {
                        'operation_type': cost.operation_type,
                        'operation_subtype': cost.operation_subtype,
                        'request_count': cost.request_count,
                        'total_cost_usd': float(cost.total_cost) if cost.total_cost else 0,
                        'avg_cost_usd': float(cost.avg_cost) if cost.avg_cost else 0
                    }
                    for cost in operation_costs
                ],
                'expensive_requests': [
                    {
                        'id': req.id,
                        'operation_type': req.operation_type,
                        'operation_subtype': req.operation_subtype,
                        'model_used': req.model_used,
                        'cost_usd': float(req.openai_cost_usd) if req.openai_cost_usd else 0,
                        'input_tokens': req.input_tokens,
                        'output_tokens': req.output_tokens,
                        'created_at': req.created_at.isoformat() if req.created_at else None,
                        'business_name': req.business.name if req.business else None
                    }
                    for req in expensive_requests
                ],
                'pricing_info': OpenAICostCalculator.get_model_pricing_info()
            }, 200

        except Exception as e:
            current_app.logger.error(f"[AI ANALYTICS] Failed to get OpenAI cost breakdown: {e}", exc_info=True)
            return {"error": "Failed to retrieve OpenAI cost breakdown"}, 500

