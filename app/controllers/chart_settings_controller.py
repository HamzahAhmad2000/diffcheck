from app.models import Survey, Question, ReportSetting, db
import json # Ensure json is imported
from datetime import datetime
class ChartSettingsController:
    @staticmethod
    def save_chart_settings(survey_id, user_id, settings):
        """
        Save chart and report customization settings for a survey.
        Expects a comprehensive settings structure.
        """
        try:
            from app.models import User, Admin
            
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            # Validate the incoming settings structure (basic check)
            if not isinstance(settings, dict):
                 return {"error": "Invalid settings format"}, 400

            # Determine user type
            user_type = 'user'
            user = User.query.get(user_id)
            if not user:
                admin = Admin.query.get(user_id)
                if admin:
                    user_type = 'super_admin'
                else:
                    return {"error": "User not found"}, 404
            elif user.role == 'business_admin':
                user_type = 'business_admin'

            # Normalize legacy color keys
            if isinstance(settings.get("global"), dict):
                if "primaryColor" in settings["global"] and "chartColor" not in settings["global"]:
                    settings["global"]["chartColor"] = settings["global"].pop("primaryColor")

            for q_cfg in settings.get("questions", {}).values():
                if "primaryColor" in q_cfg and "chartColor" not in q_cfg:
                    q_cfg["chartColor"] = q_cfg.pop("primaryColor")

            # --- Update Question Display Order ---
            # Use displayOrder from within settings['questions'][qid] if present
            # Otherwise, fallback to sequence_number
            for qid_str, q_settings in settings.get("questions", {}).items():
                try:
                    question_id = int(qid_str)
                    display_order = q_settings.get('displayOrder')
                    if display_order is not None:
                        question = Question.query.get(question_id)
                        if question and question.survey_id == survey_id:
                            # Save to the new report_sequence field
                            question.report_sequence = int(display_order)
                except (ValueError, TypeError):
                    print(f"Warning: Invalid question ID or display order for {qid_str}")
                    continue
            # --- End Display Order Update ---

            existing_setting = ReportSetting.query.filter_by(
                survey_id=survey_id,
                user_id=user_id,
                user_type=user_type,
                view_name=None # Only update the default view for now
            ).first()

            if existing_setting:
                existing_setting.settings = settings
                existing_setting.updated_at = datetime.utcnow() # Manually update timestamp
            else:
                new_setting = ReportSetting(
                    survey_id=survey_id,
                    user_id=user_id,
                    user_type=user_type,
                    settings=settings,
                    view_name=None # Default view
                )
                db.session.add(new_setting)

            db.session.commit()
            return {"message": "Report settings saved successfully"}, 200

        except Exception as e:
            db.session.rollback()
            print(f"Error saving settings: {str(e)}") # Add print
            return {"error": f"Failed to save report settings: {str(e)}"}, 500

    @staticmethod
    def get_chart_settings(survey_id, user_id):
        """
        Get chart and report customization settings for a survey.
        Returns user-specific settings or a generated default.
        """
        try:
            from app.models import User, Admin
            
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            # Determine user type
            user_type = 'user'
            user = User.query.get(user_id)
            if not user:
                admin = Admin.query.get(user_id)
                if admin:
                    user_type = 'super_admin'
                else:
                    return {"error": "User not found"}, 404
            elif user.role == 'business_admin':
                user_type = 'business_admin'

            # Try user-specific default view setting first
            setting = ReportSetting.query.filter_by(
                survey_id=survey_id,
                user_id=user_id,
                user_type=user_type,
                view_name=None # Default view
            ).first()

            if setting and setting.settings:
                # Return existing settings exactly as saved, without modification
                settings_data = setting.settings
                print(f"[CHART_SETTINGS] Returning saved settings for user {user_id}, survey {survey_id}")
                print(f"[CHART_SETTINGS] Settings data: {json.dumps(settings_data, indent=2)}")
                
                # Only normalize legacy color keys (non-destructive)
                if "global" in settings_data and isinstance(settings_data["global"], dict):
                    if "primaryColor" in settings_data["global"] and "chartColor" not in settings_data["global"]:
                        settings_data["global"]["chartColor"] = settings_data["global"].pop("primaryColor")
                
                for q_cfg in settings_data.get("questions", {}).values():
                    if "primaryColor" in q_cfg and "chartColor" not in q_cfg:
                        q_cfg["chartColor"] = q_cfg.pop("primaryColor")

                return {"settings": settings_data}, 200

            # If no user-specific setting, generate complete default
            print(f"No specific setting found for user {user_id}, survey {survey_id}. Generating default.")
            default_settings = ChartSettingsController._get_default_settings(survey_id)
            return {"settings": default_settings}, 200

        except Exception as e:
            print(f"Error getting settings: {str(e)}") # Add print
            return {"error": f"Failed to retrieve report settings: {str(e)}"}, 500

    @staticmethod
    def _get_default_question_setting(question):
        """Helper to get default settings for a single question"""
        # Determine default chart type based on question type
        q_type = question.question_type
        default_chart = 'bar'
        if q_type in ['single-choice', 'multiple-choice']: default_chart = 'pie'
        if q_type in ['nps', 'rating', 'rating-scale']: default_chart = 'bar'
        # Add more specific defaults if needed

        return {
            "isHidden": False,
            "chartType": default_chart,
            "customTitle": "",
            "showStatsTable": True,
            "showResponseDist": True,
            "showWordCloud": True,
            "showDropdownResponses": True,
            "showImageThumbnails": True,
            "showNA": True,
            "showPercentages": True,
            "showLegend": True,
            "sortByCount": False,
            "showThumbnails": True,
            "showMean": True,
            "showMedian": True,
            "showMin": True,
            "showMax": True,
            "showStdDev": True,
            "dataLabels": "percent", # 'none', 'percent', 'count', 'both'
            "optionColors": {}, # Empty object for specific overrides
            "customColors": [], # Array for custom colors
            "chartColor": "#AA2EFF", # Global default color
            "sliderColors": {}, # For slider type questions
            "npsColors": {}, # For NPS type questions
            "starColors": {}, # For star rating questions
            "scaleColors": {}, # For scale questions
             # Use report_sequence if set, otherwise fallback to sequence_number
            "displayOrder": question.report_sequence if question.report_sequence is not None else (question.sequence_number or 0)
        }

    @staticmethod
    def _get_default_demographics_settings():
         """Helper to get default settings for demographics"""
         return {
            "showAge": True,
            "showGender": True, 
            "showLocation": True,
            "showEducation": True,
            "showCompanies": True,
            "includeDemographicsInPDF": True,
            "age_groups": { "chartType": "pie", "chartColor": "#4BC0C0", "customColors": [] },
            "genders": { "chartType": "pie", "chartColor": "#FF6384", "customColors": [] },
            "locations": { "chartType": "pie", "chartColor": "#FFCE56", "customColors": [] },
            "education": { "chartType": "pie", "chartColor": "#9966FF", "customColors": [] },
            "companies": { "chartType": "bar", "chartColor": "#FF9F40", "customColors": [] }
         }

    @staticmethod
    def _get_default_settings(survey_id):
        """ Generates the complete default settings structure """
        default_settings = {
            "global": {
                "chartType": "bar",
                "chartColor": "#AA2EFF"
            },
            "questions": {},
            "demographics": ChartSettingsController._get_default_demographics_settings()
        }
        all_questions = Question.query.filter_by(survey_id=survey_id).order_by(Question.sequence_number).all()
        for q in all_questions:
            default_settings["questions"][str(q.id)] = ChartSettingsController._get_default_question_setting(q)
        return default_settings

    @staticmethod
    def delete_chart_settings(survey_id, user_id):
        """
        Delete chart customization settings for a survey
        
        Args:
            survey_id (int): The survey ID
            user_id (int): The user/admin ID
            
        Returns:
            dict: Result of the operation and status code
        """
        try:
            from app.models import User, Admin
            
            # Check if survey exists
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404
            
            # Determine user type
            user_type = 'user'
            user = User.query.get(user_id)
            if not user:
                admin = Admin.query.get(user_id)
                if admin:
                    user_type = 'super_admin'
                else:
                    return {"error": "User not found"}, 404
            elif user.role == 'business_admin':
                user_type = 'business_admin'
            
            # Delete from ReportSetting
            setting = ReportSetting.query.filter_by(
                survey_id=survey_id,
                user_id=user_id,
                user_type=user_type
            ).first()
            
            if setting:
                db.session.delete(setting)
            
            # Also remove from survey.report_settings
            if survey.report_settings and 'chart_settings' in survey.report_settings:
                user_key = f"user_{user_id}"
                if user_key in survey.report_settings['chart_settings']:
                    del survey.report_settings['chart_settings'][user_key]
            
            db.session.commit()
            return {"message": "Chart settings deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            return {"error": f"Failed to delete chart settings: {str(e)}"}, 500