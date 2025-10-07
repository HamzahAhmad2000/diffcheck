# --- START OF FILE models.py ---

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import json # For JSON type handling if needed
from enum import Enum
import random
from .extensions import db
import secrets

db = SQLAlchemy()

# Activity types for business activities and points tracking
class ActivityType(Enum):
    """Enum for all possible activity types in the system."""
    # Survey Activities
    SURVEY_PUBLISHED = "SURVEY_PUBLISHED"
    SURVEY_COMPLETED = "SURVEY_COMPLETED"
    SURVEY_ARCHIVED = "SURVEY_ARCHIVED"
    
    # Quest Activities
    QUEST_CREATED = "QUEST_CREATED"
    QUEST_COMPLETED = "QUEST_COMPLETED" 
    QUEST_ARCHIVED = "QUEST_ARCHIVED"
    QUEST_PUBLISHED = "QUEST_PUBLISHED"
    QUEST_UNPUBLISHED = "QUEST_UNPUBLISHED"
    
    # Item Activities (Bugs/Features)
    BUG_REPORTED = "BUG_REPORTED"
    BUG_STATUS_UPDATED = "BUG_STATUS_UPDATED"
    FEATURE_REQUESTED = "FEATURE_REQUESTED"
    FEATURE_STATUS_UPDATED = "FEATURE_STATUS_UPDATED"
    FEATURE_VOTED = "FEATURE_VOTED"
    
    # Business Activities
    BUSINESS_CREATED = "BUSINESS_CREATED"
    BUSINESS_UPDATED = "BUSINESS_UPDATED"
    BUSINESS_APPROVED = "BUSINESS_APPROVED"
    
    # User Activities
    USER_JOINED = "USER_JOINED"
    USER_ROLE_UPDATED = "USER_ROLE_UPDATED"
    
    # Quest Credits Activities
    QUEST_CREDITS_PURCHASED = "QUEST_CREDITS_PURCHASED"
    
    # Custom Activities
    CUSTOM_POST = "CUSTOM_POST"
    ANNOUNCEMENT = "ANNOUNCEMENT"

# NEW: Business Tier Management Models
class BusinessTier(db.Model):
    """Super admin managed business subscription tiers"""
    __tablename__ = 'business_tiers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., 'Starter', 'Professional', 'Enterprise'
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Integer, nullable=False, default=0)  # Price in cents
    
    # Features and limits
    monthly_response_limit = db.Column(db.Integer, nullable=False, default=1000)
    monthly_quest_limit = db.Column(db.Integer, nullable=False, default=5)
    admin_seat_limit = db.Column(db.Integer, nullable=False, default=1)
    ai_points_included = db.Column(db.Integer, nullable=False, default=0)  # AI points included with tier
    
    # Feature flags
    can_use_ai_builder = db.Column(db.Boolean, default=True, nullable=False)
    can_use_ai_insights = db.Column(db.Boolean, default=True, nullable=False)
    can_create_surveys = db.Column(db.Boolean, default=True, nullable=False)
    can_generate_responses = db.Column(db.Boolean, default=True, nullable=False)
    can_request_featured = db.Column(db.Boolean, default=False, nullable=False)  # Feature request capability
    can_create_quests = db.Column(db.Boolean, default=False, nullable=False) # Quest creation capability
    
    # Additional features as JSON for flexibility
    additional_features = db.Column(db.JSON, nullable=True)  # Store any additional features
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)  # For ordering tiers
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    businesses = db.relationship('Business', backref='tier_info', lazy='dynamic')
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "monthly_response_limit": self.monthly_response_limit,
            "monthly_quest_limit": self.monthly_quest_limit,
            "admin_seat_limit": self.admin_seat_limit,
            "ai_points_included": self.ai_points_included,
            "can_use_ai_builder": self.can_use_ai_builder,
            "can_use_ai_insights": self.can_use_ai_insights,
            "can_create_surveys": self.can_create_surveys,
            "can_generate_responses": self.can_generate_responses,
            "can_request_featured": self.can_request_featured,
            "can_create_quests": self.can_create_quests,
            "additional_features": self.additional_features or {},
            "is_active": self.is_active,
            "display_order": self.display_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class AIPointsPackage(db.Model):
    """Super admin managed AI points pricing packages"""
    __tablename__ = 'ai_points_packages'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., 'Starter', 'Pro', 'Enterprise'
    description = db.Column(db.Text, nullable=True)
    points = db.Column(db.Integer, nullable=False)  # Number of AI points
    price = db.Column(db.Integer, nullable=False)  # Price in cents
    
    # Optional features
    bonus_points = db.Column(db.Integer, nullable=False, default=0)  # Bonus points (e.g., buy 100 get 10 free)
    is_popular = db.Column(db.Boolean, default=False, nullable=False)  # Mark as popular package
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)  # For ordering packages
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_total_points(self):
        """Get total points including bonus"""
        return self.points + self.bonus_points
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "points": self.points,
            "bonus_points": self.bonus_points,
            "total_points": self.get_total_points(),
            "price": self.price,
            "is_popular": self.is_popular,
            "is_active": self.is_active,
            "display_order": self.display_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# NEW: Response Package Management Models
class ResponsePackage(db.Model):
    """Super admin managed response packages"""
    __tablename__ = 'response_packages'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., 'Small Package', 'Medium Package'
    description = db.Column(db.Text, nullable=True)
    responses = db.Column(db.Integer, nullable=False, default=0)  # Number of responses in package
    price = db.Column(db.Integer, nullable=False, default=0)  # Price in cents
    
    # Display and management
    display_order = db.Column(db.Integer, nullable=False, default=0)  # For ordering packages
    is_popular = db.Column(db.Boolean, default=False, nullable=False)  # Mark as "Most Popular"
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'responses': self.responses,
            'price': self.price,
            'price_per_thousand': round((self.price / 100) / (self.responses / 1000), 3) if self.responses > 0 else 0,
            'display_order': self.display_order,
            'is_popular': self.is_popular,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class FeatureRequest(db.Model):
    """Feature requests from businesses for featured content"""
    __tablename__ = 'feature_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Business admin who requested
    
    request_type = db.Column(db.String(50), nullable=False)  # 'FEATURED_BUSINESS', 'FEATURED_SURVEY', 'FEATURED_QUEST'
    target_item_id = db.Column(db.Integer, nullable=True)  # ID of survey/quest to feature (null for business)
    target_item_title = db.Column(db.String(255), nullable=True)  # Title for reference
    
    message = db.Column(db.Text, nullable=True)  # Optional message from business
    status = db.Column(db.String(50), nullable=False, default='PENDING')  # 'PENDING', 'APPROVED', 'REJECTED'
    admin_response = db.Column(db.Text, nullable=True)  # Admin response message
    reviewed_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    business = db.relationship('Business', backref='feature_requests')
    user = db.relationship('User', backref='submitted_feature_requests')
    reviewed_by = db.relationship('Admin', backref='reviewed_feature_requests')
    
    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "business_name": self.business.name if self.business else None,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "request_type": self.request_type,
            "target_item_id": self.target_item_id,
            "target_item_title": self.target_item_title,
            "message": self.message,
            "status": self.status,
            "admin_response": self.admin_response,
            "reviewed_by_admin_id": self.reviewed_by_admin_id,
            "reviewed_by_admin_name": self.reviewed_by.name if self.reviewed_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None
        }

class Survey(db.Model):
    __tablename__ = 'surveys'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True, default=None)
    end_date = db.Column(db.DateTime, nullable=True, default=None)
    participant_limit = db.Column(db.Integer, nullable=True)
    published = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)
    # ADDED: is_quickpoll field
    is_quickpoll = db.Column(db.Boolean, default=False, nullable=False)
    branding = db.Column(db.String(255), nullable=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', name='fk_survey_business_id'), nullable=True)
    copy_of = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=True)
    is_restricted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    report_settings = db.Column(db.JSON, nullable=True)  # To store report configuration
        # ADDED: tags field for survey categorization
    tags = db.Column(db.JSON, nullable=True)  # Stores array of ProfileTag.id or ProfileTag.name
    # Flag to mark featured surveys shown prominently in dashboards
    is_featured = db.Column(db.Boolean, default=False)

    # Relationship to questions
    questions = db.relationship('Question', backref='survey', lazy='dynamic', cascade="all, delete-orphan")
    # Relationship to copies (self-referential)
    copies = db.relationship('Survey', remote_side=[id], backref=db.backref('original_survey', uselist=False))
    # Relationship to distribution links
    links = db.relationship('SurveyLink', backref='survey', lazy='dynamic', cascade="all, delete-orphan")
    submissions = db.relationship('Submission', backref='survey', lazy='dynamic', cascade="all, delete-orphan")
    business = db.relationship('Business', 
                               foreign_keys=[business_id], 
                               back_populates='surveys')

    def get_analytics_summary(self):
        """Get summary analytics for this survey"""
        # Use is_complete flag from Submission model
        completed_submissions = self.submissions.filter_by(is_complete=True).all()
        all_submissions_for_survey = self.submissions.all()
        total_started = len(all_submissions_for_survey)
        total_completed = len(completed_submissions)

        # Calculate completion rate
        durations = [sub.duration for sub in completed_submissions if sub.duration] # Use completed submissions for duration
        avg_duration = sum(durations) / len(durations) if durations else 0
        drop_off_rate = ((total_started - total_completed) / total_started * 100) if total_started > 0 else 0

        # Calculate response rate by question
        question_responses_counts = {}
        for question in self.questions.all():
            # Count submissions that have a non-empty response for this question
            response_count = Response.query.join(Submission).filter(
                Submission.survey_id == self.id,
                Response.question_id == question.id,
                Response.response_text != '', # Check for non-empty response
                Response.response_text != None # Also check for non-null
            ).count()
            question_responses_counts[question.id] = response_count

        return {
            "total_responses": total_completed, # Changed to completed
            "average_duration": round(avg_duration, 2),
            "question_responses": question_responses_counts,
            "completed_responses": total_completed,
            "total_started": total_started,
            "drop_off_rate": round(drop_off_rate, 2),
            "average_completion_time": round(avg_duration, 2) # Renamed for clarity
        }

    def to_dict(self, include_questions=False):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "business_id": self.business_id,
            "business_name": self.business.name if self.business else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "participant_limit": self.participant_limit,
            "published": self.published,
            "is_archived": self.is_archived,
            "is_quickpoll": self.is_quickpoll,
            "is_restricted": self.is_restricted,
            "branding": self.branding,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "question_count": self.questions.count(),
            "response_count": self.submissions.filter_by(is_complete=True).count(),
            "is_featured": self.is_featured,
        }
        if include_questions:
            sorted_questions = sorted(self.questions.all(), key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
            data["questions"] = [q.to_dict() for q in sorted_questions]
        return data

class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False)
    question_text = db.Column(db.String(1000), nullable=False)
    description = db.Column(db.Text, nullable=True)
    additional_text = db.Column(db.Text, nullable=True)
    question_type = db.Column(db.String(50), nullable=False) # e.g., 'single-choice', 'rating', 'nps', 'scale' etc.
    options = db.Column(db.JSON, nullable=True) # For choice types [{text, branch}, ...]
    branch = db.Column(db.JSON, nullable=True) # For option-based branching (legacy/alternative?)
    sequence_number = db.Column(db.Integer, nullable=True)
    original_sequence_number = db.Column(db.Integer, nullable=True)
    image_url = db.Column(db.String(255), nullable=True) # For question-level image
    required = db.Column(db.Boolean, nullable=False, default=False)
    question_text_html = db.Column(db.Text, nullable=True) # Stores Jodit HTML output
    # --- Fields for Rating / Slider / NPS / Star Rating ---
    rating_start = db.Column(db.Integer, nullable=True)
    rating_end = db.Column(db.Integer, nullable=True)
    rating_step = db.Column(db.Integer, nullable=True)
    rating_unit = db.Column(db.String(50), nullable=True) # e.g., 'stars' or unit name
    # NEW: Labels for Slider/Rating
    left_label = db.Column(db.String(100), nullable=True)
    center_label = db.Column(db.String(100), nullable=True)
    right_label = db.Column(db.String(100), nullable=True)
    # NEW: Labels for NPS
    nps_left_label = db.Column(db.String(100), nullable=True)
    nps_right_label = db.Column(db.String(100), nullable=True)
    # NEW: Label for Single Row Star Rating
    row_text = db.Column(db.String(255), nullable=True)

    # --- Fields for Numerical Input ---
    # NEW: Min/Max constraints
    min_value = db.Column(db.Float, nullable=True) # Use Float to allow decimals
    max_value = db.Column(db.Float, nullable=True)
    # NEW: Force positive constraint
    force_positive = db.Column(db.Boolean, default=False, nullable=False)

    # --- Fields for Grid questions ---
    grid_rows = db.Column(db.JSON, nullable=True) # Array of {text}
    grid_columns = db.Column(db.JSON, nullable=True) # Array of {text, isNotApplicable}

    # --- Fields for N/A and Other Options ---
    not_applicable = db.Column(db.Boolean, nullable=False, default=False) # Applies to choice/grid/scale/rating
    not_applicable_text = db.Column(db.String(100), nullable=True, default="Not Applicable")
    has_other_option = db.Column(db.Boolean, nullable=False, default=False) # Applies to choice types
    other_option_text = db.Column(db.String(255), nullable=True, default="Other (Please specify)")
    # NEW: Flag for showing N/A option (useful for slider/star/scale where N/A isn't just another option)
    show_na = db.Column(db.Boolean, default=False, nullable=False)

    # --- Fields for Multiple Choice/Checkbox selection rules ---
    min_selection = db.Column(db.Integer, nullable=True)
    max_selection = db.Column(db.Integer, nullable=True)

    # --- Fields for Image Select type ---
    image_options = db.Column(db.JSON, nullable=True) # Stores [{label, image_url, hidden_label, description}, ...]

    # --- Fields for Ranking type ---
    ranking_items = db.Column(db.JSON, nullable=True) # Stores [{text}, ...]

    # --- Fields for Document Upload Settings ---
    allowed_types = db.Column(db.String(255), nullable=True, default='pdf,doc,docx,xls,xlsx,txt,csv,jpg,jpeg,png,ppt,pptx')
    max_file_size = db.Column(db.Integer, nullable=True, default=5) # MB
    max_files = db.Column(db.Integer, nullable=True, default=1)

    # --- Fields for Signature type ---
    # NEW: Signature configuration options
    signature_options = db.Column(db.JSON, nullable=True) # e.g., {penColor, backgroundColor, clearable, showFullName}

    # --- Fields for Date Picker type ---
    # NEW: Min/Max date constraints
    min_date = db.Column(db.DateTime, nullable=True)
    max_date = db.Column(db.DateTime, nullable=True)

    # --- Fields for Email Input type ---
    # NEW: Email validation options
    verify_domain = db.Column(db.Boolean, default=False, nullable=False)
    allowed_domains = db.Column(db.String(500), nullable=True) # Store as comma-separated string or JSON array

    # --- Fields for Scale (Likert) type ---
    # NEW: Specific field for scale points/labels
    scale_points = db.Column(db.JSON, nullable=True) # Array of strings defining the scale points

    # --- Fields for Numerical/Date Branching ---
    numerical_branch_enabled = db.Column(db.Boolean, default=False, nullable=False)
    numerical_branch_rules = db.Column(db.JSON, nullable=True) # Stores [{ type: "value"|"date", condition: "...", value: X, branch: {...} }, ...]

    # --- Fields for Disqualification Logic ---
    disqualify_enabled = db.Column(db.Boolean, default=False, nullable=False)
    disqualify_message = db.Column(db.Text, nullable=True, default="Thank you for your time. Based on your answers, you do not qualify for this survey. We appreciate your interest!")
    disqualify_rules = db.Column(db.JSON, nullable=True) # Stores rules based on options, values, or dates

    # --- Fields for Conditional Logic (Show/Hide based on previous answers) ---
    conditional_logic_rules = db.Column(db.JSON, nullable=True) # Stores [{ condition: "equals", value: "Yes", action: "show", target_question_sequence: 2 }, ...]
    
    # --- UUID field for maintaining conditional logic relationships ---
    question_uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))

    # --- Fields for Metadata/Analytics ---
    completion_rate = db.Column(db.Float, nullable=True)
    average_time = db.Column(db.Float, nullable=True)
    report_sequence = db.Column(db.Integer, nullable=True) # For custom report ordering

    # --- Relationships ---
    # Relationship back to Survey (defined via backref in Survey model)
    # survey = db.relationship('Survey', backref='questions') # Example if not using backref

    # Relationship to Responses
    responses = db.relationship('Response', backref='question', lazy='dynamic', cascade="all, delete-orphan")

    # --- Methods ---
    def get_response_count(self):
        """Get count of responses for this question"""
        # Consider filtering based on submission completion status if needed
        return Response.query.filter_by(question_id=self.id).count()

    # get_response_distribution and get_numerical_stats methods remain the same
    # ... (methods from original file) ...
    def get_response_distribution(self):
        """Get distribution of responses for choice questions"""
        # Note: Might need adjustments for Scale type analysis
        if self.question_type not in ['multiple-choice', 'checkbox', 'dropdown', 'single-choice', 'multi-choice', 'multiple-image-select', 'scale']:
            return {}

        responses = Response.query.filter(Response.question_id == self.id, Response.is_not_applicable == False).all() # Exclude N/A
        distribution = {}

        for response in responses:
            try:
                # Handle JSON for multi-select
                answers = json.loads(response.response_text)
                if isinstance(answers, list):
                    for answer in answers:
                        distribution[answer] = distribution.get(answer, 0) + 1
                else: # Should be single string for single-select/scale
                    distribution[response.response_text] = distribution.get(response.response_text, 0) + 1
            except: # Fallback for non-JSON string
                distribution[response.response_text] = distribution.get(response.response_text, 0) + 1

        return distribution

    def get_numerical_stats(self):
        """Get statistical analysis for numerical questions (Rating, NPS, Numerical Input)"""
        # Note: Excludes Date Picker unless dates are converted to numerical values for analysis
        if self.question_type not in ['rating-scale', 'rating', 'nps', 'numerical-input']:
            return {}

        responses = Response.query.filter(Response.question_id == self.id, Response.is_not_applicable == False).all() # Exclude N/A
        values = []

        for response in responses:
            try:
                values.append(float(response.response_text))
            except:
                continue

        if not values:
            return {}

        import statistics
        stats_data = {
            "mean": sum(values) / len(values),
            "median": statistics.median(values) if values else None,
            "min": min(values) if values else None,
            "max": max(values) if values else None,
            "count": len(values)
        }
        try:
            stats_data["mode"] = statistics.mode(values) if values else None
        except statistics.StatisticsError: # Handle multimodal case
             stats_data["mode"] = None # Or return list of modes if needed
        try:
            stats_data["std_dev"] = statistics.stdev(values) if len(values) > 1 else 0
        except statistics.StatisticsError:
             stats_data["std_dev"] = 0

        return stats_data

    def to_dict(self):
        return {
            "id": self.id,
            "survey_id": self.survey_id,
            "question_uuid": self.question_uuid,
            "question_text": self.question_text,
            "question_text_html": self.question_text_html,
            "description": self.description,
            "additional_text": self.additional_text,
            "question_type": self.question_type,
            "options": self.options,
            "branch": self.branch,
            "sequence_number": self.sequence_number,
            "original_sequence_number": self.original_sequence_number,
            "image_url": self.image_url,
            "required": self.required,
            "rating_start": self.rating_start,
            "rating_end": self.rating_end,
            "rating_step": self.rating_step,
            "rating_unit": self.rating_unit,
            "left_label": self.left_label,
            "center_label": self.center_label,
            "right_label": self.right_label,
            "nps_left_label": self.nps_left_label,
            "nps_right_label": self.nps_right_label,
            "row_text": self.row_text,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "force_positive": self.force_positive,
            "grid_rows": self.grid_rows,
            "grid_columns": self.grid_columns,
            "not_applicable": self.not_applicable,
            "not_applicable_text": self.not_applicable_text,
            "has_other_option": self.has_other_option,
            "other_option_text": self.other_option_text,
            "show_na": self.show_na,
            "min_selection": self.min_selection,
            "max_selection": self.max_selection,
            "image_options": self.image_options,
            "ranking_items": self.ranking_items,
            "allowed_types": self.allowed_types,
            "max_file_size": self.max_file_size,
            "max_files": self.max_files,
            "signature_options": self.signature_options,
            "min_date": self.min_date.isoformat() if self.min_date else None,
            "max_date": self.max_date.isoformat() if self.max_date else None,
            "verify_domain": self.verify_domain,
            "allowed_domains": self.allowed_domains,
            "scale_points": self.scale_points,
            "numerical_branch_enabled": self.numerical_branch_enabled,
            "numerical_branch_rules": self.numerical_branch_rules,
            "disqualify_enabled": self.disqualify_enabled,
            "disqualify_message": self.disqualify_message,
            "disqualify_rules": self.disqualify_rules,
            "conditional_logic_rules": self.conditional_logic_rules,
            "report_sequence": self.report_sequence,
        }

class Response(db.Model):
    __tablename__ = 'responses'

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False)
    response_text = db.Column(db.Text, nullable=True) # Allow null for cases where only file_path matters? Or store indicator?
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    # Special fields for specific response types
    is_not_applicable = db.Column(db.Boolean, default=False)  # For NA responses
    is_other = db.Column(db.Boolean, default=False)  # For 'Other' option responses
    other_text = db.Column(db.Text, nullable=True)  # Text entered for 'Other' option
    # For file uploads
    file_path = db.Column(db.String(512), nullable=True)  # Path to uploaded file
    file_type = db.Column(db.String(100), nullable=True)  # Type of file uploaded
    # New fields for analytics
    response_time = db.Column(db.Integer, nullable=True)  # Time to answer in seconds
    sequence_in_submission = db.Column(db.Integer, nullable=True)  # Order in which answered

class Submission(db.Model):
    __tablename__ = 'submissions'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False)
    submitted_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    duration = db.Column(db.Integer, nullable=True)  # duration in seconds
    survey_link_id = db.Column(db.Integer, db.ForeignKey('survey_links.id'), nullable=True)
    # Additional fields for user demographics and analytics
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)  # Browser/device info
    ip_address = db.Column(db.String(45), nullable=True)  # For geo-tracking
    age_group = db.Column(db.String(50), nullable=True)
    gender = db.Column(db.String(50), nullable=True)
    location = db.Column(db.String(150), nullable=True)
    # Added fields that were missing
    education = db.Column(db.String(100), nullable=True)
    company = db.Column(db.String(150), nullable=True)
    cohort_tag = db.Column(db.String(100), nullable=True)
    device_type = db.Column(db.String(50), nullable=True)  # Mobile, Desktop, Tablet
    browser_info = db.Column(db.String(150), nullable=True)  # Chrome, Firefox, etc.
    is_complete = db.Column(db.Boolean, default=False, nullable=False)
    is_ai_generated = db.Column(db.Boolean, default=False, nullable=False) # ADDED: Flag for AI-generated responses

    responses = db.relationship('Response', backref='submission', lazy='dynamic', cascade="all, delete-orphan")

    def get_completion_percentage(self):
        """Calculate percentage of required questions answered"""
        survey = Survey.query.get(self.survey_id)
        if not survey:
            return 0

        required_questions = [q for q in survey.questions if q.required]
        if not required_questions:
            return 100  # No required questions, so 100% complete

        # Get responses for this submission only
        responses = Response.query.filter_by(submission_id=self.id).all()
        answered_question_ids = set(r.question_id for r in responses if r.response_text or r.file_path) # Consider response present if text or file

        required_question_ids = set(q.id for q in required_questions)
        answered_required = required_question_ids.intersection(answered_question_ids)

        return (len(answered_required) / len(required_question_ids)) * 100 if required_question_ids else 100


# --- Other models (QuestionBank, ChatThread, SurveyThread, AnalyticsThread, SurveyLink, User, Admin, ReportSetting) remain unchanged ---
class QuestionBank(db.Model):
    __tablename__ = 'question_bank'

    id = db.Column(db.Integer, primary_key=True)
    question_text = db.Column(db.String(1000), nullable=False)
    description = db.Column(db.Text, nullable=True)
    additional_text = db.Column(db.Text, nullable=True)
    question_type = db.Column(db.String(50), nullable=False)
    options = db.Column(db.JSON, nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    rating_start = db.Column(db.Integer, nullable=True)
    rating_end = db.Column(db.Integer, nullable=True)
    rating_step = db.Column(db.Integer, nullable=True)
    rating_unit = db.Column(db.String(50), nullable=True)
    grid_rows = db.Column(db.JSON, nullable=True)
    grid_columns = db.Column(db.JSON, nullable=True)
    category = db.Column(db.String(100), nullable=True)  # For organizing questions by category
    usage_count = db.Column(db.Integer, default=0)  # Track how often it's used
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class ChatThread(db.Model):
    __tablename__ = 'chat_threads'

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class SurveyThread(db.Model):
    __tablename__ = 'survey_threads'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False, unique=True)
    thread_id = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class AnalyticsThread(db.Model):
    __tablename__ = 'analytics_threads'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False, unique=True)
    thread_id = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class AIUsageLog(db.Model):
    """Comprehensive AI usage tracking for super admin analytics"""
    __tablename__ = 'ai_usage_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=True)  # Allow NULL for admin operations
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)  # For super admin operations
    
    # Operation details
    operation_type = db.Column(db.String(50), nullable=False)  # 'survey_generation', 'analytics_report', 'response_generation'
    operation_subtype = db.Column(db.String(50), nullable=True)  # 'quick', 'guided_short', 'guided_medium', 'guided_long', 'insights', 'auto_responses'
    
    # Survey tracking
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=True)
    survey_saved = db.Column(db.Boolean, default=False)  # Whether the generated survey was actually saved
    
    # Cost tracking
    points_cost = db.Column(db.Integer, nullable=False, default=0)
    estimated_tokens_used = db.Column(db.Integer, nullable=True)
    
    # OpenAI API cost tracking
    openai_cost_usd = db.Column(db.Numeric(10, 6), nullable=True)  # Actual cost in USD (up to $9999.999999)
    input_tokens = db.Column(db.Integer, nullable=True)  # Actual input tokens from OpenAI response
    output_tokens = db.Column(db.Integer, nullable=True)  # Actual output tokens from OpenAI response
    model_used = db.Column(db.String(50), nullable=True)  # e.g., 'gpt-4o', 'gpt-3.5-turbo'
    openai_request_id = db.Column(db.String(100), nullable=True)  # OpenAI request ID for tracking
    
    # Performance metrics
    processing_time_seconds = db.Column(db.Float, nullable=True)
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # Additional metadata
    additional_data = db.Column(db.JSON, nullable=True)  # Store additional context like prompt length, question count, etc.
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    business = db.relationship('Business', backref='ai_usage_logs')
    user = db.relationship('User', backref='ai_operations')
    admin = db.relationship('Admin', backref='ai_operations_admin')
    survey = db.relationship('Survey', backref='ai_generation_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'business_id': self.business_id,
            'user_id': self.user_id,
            'admin_id': self.admin_id,
            'operation_type': self.operation_type,
            'operation_subtype': self.operation_subtype,
            'survey_id': self.survey_id,
            'survey_saved': self.survey_saved,
            'points_cost': self.points_cost,
            'estimated_tokens_used': self.estimated_tokens_used,
            'openai_cost_usd': float(self.openai_cost_usd) if self.openai_cost_usd else None,
            'input_tokens': self.input_tokens,
            'output_tokens': self.output_tokens,
            'total_tokens': (self.input_tokens or 0) + (self.output_tokens or 0),
            'model_used': self.model_used,
            'openai_request_id': self.openai_request_id,
            'processing_time_seconds': self.processing_time_seconds,
            'success': self.success,
            'error_message': self.error_message,
            'additional_data': self.additional_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'business_name': self.business.name if self.business else None,
            'user_username': self.user.username if self.user else (self.admin.username if self.admin else None)
        }

class AISurveyGeneration(db.Model):
    """Detailed tracking of AI survey generation attempts"""
    __tablename__ = 'ai_survey_generations'
    
    id = db.Column(db.Integer, primary_key=True)
    usage_log_id = db.Column(db.Integer, db.ForeignKey('ai_usage_logs.id'), nullable=False)
    
    # Generation details
    generation_type = db.Column(db.String(30), nullable=False)  # 'quick', 'guided', 'regenerate', 'edit'
    prompt_text = db.Column(db.Text, nullable=True)
    
    # Guided generation specific
    industry = db.Column(db.String(100), nullable=True)
    goal = db.Column(db.String(100), nullable=True)
    tone_length = db.Column(db.String(50), nullable=True)
    
    # Output details
    questions_generated = db.Column(db.Integer, nullable=True)
    survey_title = db.Column(db.String(255), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    usage_log = db.relationship('AIUsageLog', backref='survey_generations')

    def to_dict(self):
        return {
            'id': self.id,
            'usage_log_id': self.usage_log_id,
            'generation_type': self.generation_type,
            'prompt_text': self.prompt_text,
            'industry': self.industry,
            'goal': self.goal,
            'tone_length': self.tone_length,
            'questions_generated': self.questions_generated,
            'survey_title': self.survey_title,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AIAnalyticsGeneration(db.Model):
    """Detailed tracking of AI analytics report generation"""
    __tablename__ = 'ai_analytics_generations'
    
    id = db.Column(db.Integer, primary_key=True)
    usage_log_id = db.Column(db.Integer, db.ForeignKey('ai_usage_logs.id'), nullable=False)
    
    # Analytics details
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False)
    questions_analyzed = db.Column(db.Integer, nullable=False, default=0)
    filters_applied = db.Column(db.JSON, nullable=True)
    comparison_mode = db.Column(db.Boolean, default=False)
    
    # Output metrics
    insights_generated = db.Column(db.Integer, nullable=True)
    charts_generated = db.Column(db.Integer, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    usage_log = db.relationship('AIUsageLog', backref='analytics_generations')
    survey = db.relationship('Survey', backref='ai_analytics_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'usage_log_id': self.usage_log_id,
            'survey_id': self.survey_id,
            'questions_analyzed': self.questions_analyzed,
            'filters_applied': self.filters_applied,
            'comparison_mode': self.comparison_mode,
            'insights_generated': self.insights_generated,
            'charts_generated': self.charts_generated,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SurveyLink(db.Model):
    __tablename__ = 'survey_links'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False)
    code = db.Column(db.String(32), unique=True, nullable=False, default=lambda: uuid.uuid4().hex[:16])
    label = db.Column(db.String(255), nullable=True)
    allowed_domain = db.Column(db.String(255), nullable=True)
    allowed_emails = db.Column(db.JSON, nullable=True)
    max_responses = db.Column(db.Integer, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    is_approved = db.Column(db.Boolean, default=True)
    merge_responses = db.Column(db.Boolean, default=False)
    # New analytics fields
    response_count = db.Column(db.Integer, default=0)  # Cache for response count
    last_response_at = db.Column(db.DateTime, nullable=True)  # Time of last response

    # Relationship to submissions
    submissions = db.relationship('Submission', backref='survey_link', lazy='dynamic')

    def to_dict(self):
        return {
            "id": self.id,
            "survey_id": self.survey_id,
            "code": self.code,
            "label": self.label,
            "allowed_domain": self.allowed_domain,
            "allowed_emails": self.allowed_emails or [],
            "max_responses": self.max_responses,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "is_approved": self.is_approved,
            "merge_responses": self.merge_responses,
            "response_count": self.response_count,
            "last_response_at": self.last_response_at.isoformat() if self.last_response_at else None
        }

    def get_response_count(self):
        """Get count of responses for this link"""
        count = Submission.query.filter_by(survey_link_id=self.id).count()
        # Update cached count if different
        if count != self.response_count:
            self.response_count = count
            db.session.commit()
        return count

    def get_latest_response(self):
        """Get the latest response for this link"""
        latest = Submission.query.filter_by(survey_link_id=self.id).order_by(Submission.submitted_at.desc()).first()
        if latest and (not self.last_response_at or latest.submitted_at > self.last_response_at):
            self.last_response_at = latest.submitted_at
            db.session.commit()
        return latest

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100), nullable=True)
    
    role = db.Column(db.String(50), nullable=False, default='user')

    # Fields for Business Admin role
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', name='fk_user_business_id'), nullable=True)
    business_admin_permissions = db.Column(db.JSON, nullable=True)
    discord_id = db.Column(db.String(100), nullable=True)
    
    # Discord role storage - stores all role IDs across all guilds the user is in
    discord_role_ids = db.Column(db.JSON, nullable=True)  # Store a list of role IDs

    # Existing demographic fields
    age = db.Column(db.Integer, nullable=True) # May be deprecated in favor of date_of_birth
    date_of_birth = db.Column(db.Date, nullable=True) # NEW: Date of Birth field
    company = db.Column(db.String(100), nullable=True)
    gender = db.Column(db.String(50), nullable=True)
    education = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(100), nullable=True) # This might be personal location vs business location
    occupation = db.Column(db.String(100), nullable=True)
    profile_image_url = db.Column(db.String(255), nullable=True)
    
    # NEW: XP and gamification fields
    xp_balance = db.Column(db.Integer, default=0, nullable=False)  # Current spendable XP
    total_xp_earned = db.Column(db.Integer, default=0, nullable=False)  # All-time XP for badges
    surveys_completed_count = db.Column(db.Integer, default=0, nullable=False) # Count of unique surveys completed
    
    # NEW: Activity tracking for Eclipseer quests
    quests_completed_count = db.Column(db.Integer, default=0, nullable=False)  # Total quests completed
    brand_pages_visited_count = db.Column(db.Integer, default=0, nullable=False)  # Total brand pages visited
    tags_selected_count = db.Column(db.Integer, default=0, nullable=False)  # Total tags selected
    has_profile_picture = db.Column(db.Boolean, default=False, nullable=False)  # Whether user has uploaded profile picture
    
    # NEW: Profile completion fields for XP rewards
    country = db.Column(db.String(100), nullable=True)
    region = db.Column(db.String(100), nullable=True)
    interests = db.Column(db.JSON, nullable=True)  # List of interest tags
    owned_devices = db.Column(db.JSON, nullable=True)  # List of device tags
    memberships = db.Column(db.JSON, nullable=True)  # List of membership tags
    xp_profile_completion = db.Column(db.JSON, nullable=True) # Tracks XP earned for profile sections
    
    is_active = db.Column(db.Boolean, default=True)

    # NEW: Email verification and multi-step registration fields
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    # REMOVED: email_verification_token = db.Column(db.String(100), nullable=True)
    # REMOVED: email_verification_token_expires_at = db.Column(db.DateTime, nullable=True)
    # REMOVED: temp_auth_token_after_email_verify = db.Column(db.String(100), nullable=True) # For linking registration steps
    # REMOVED: temp_auth_token_expires_at = db.Column(db.DateTime, nullable=True) # Expiry for the temp token

    # NEW: Social Account IDs (discord_id already exists)
    x_id = db.Column(db.String(100), nullable=True, unique=True)
    google_id = db.Column(db.String(100), nullable=True, unique=True)
    meta_id = db.Column(db.String(100), nullable=True, unique=True)

    # NEW: Advanced Security Options
    mfa_secret = db.Column(db.String(255), nullable=True)  # Encrypted
    mfa_enabled = db.Column(db.Boolean, default=False, nullable=False)
    security_questions = db.Column(db.JSON, nullable=True)  # Store hashed security Q&A
    passkeys = db.Column(db.JSON, nullable=True) # Stores array of hashed one-time passkeys

    # NEW: Password Reset Functionality
    # REMOVED: password_reset_token = db.Column(db.String(100), nullable=True, unique=True)
    # REMOVED: password_reset_token_expires_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationships
    submissions = db.relationship('Submission', backref='user', lazy='dynamic')
    
    managed_business = db.relationship('Business', foreign_keys=[business_id], backref=db.backref('managing_admins', lazy='dynamic'))
    
    # Relationship to LinkedAccount --- MODIFIED ---
    linked_accounts = db.relationship(
        'LinkedAccount',
        back_populates='user',  # Ensures this matches LinkedAccount.user relationship
        cascade="all, delete-orphan",
        lazy='dynamic'
    )

    # Relationships to token models
    password_reset_tokens = db.relationship('PasswordResetToken', backref='user', lazy='dynamic', cascade="all, delete-orphan")
    email_verification_tokens = db.relationship('EmailVerificationToken', backref='user', lazy='dynamic', cascade="all, delete-orphan")
    temp_auth_tokens = db.relationship('TempAuthToken', backref='user', lazy='dynamic', cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_discord_role(self, role_id):
        """Check if user has a specific Discord role ID"""
        if not self.discord_role_ids:
            return False
        return str(role_id) in [str(r) for r in self.discord_role_ids]
    
    def has_any_discord_role(self, role_ids):
        """Check if user has any of the specified Discord role IDs"""
        if not self.discord_role_ids or not role_ids:
            return False
        user_role_set = set(str(r) for r in self.discord_role_ids)
        required_role_set = set(str(r) for r in role_ids)
        return bool(user_role_set.intersection(required_role_set))

    def to_dict(self):
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "age": self.age, # Keep for now, or calculate from DOB
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None, # NEW
            "company": self.company,
            "gender": self.gender,
            "education": self.education,
            "location": self.location,
            "occupation": self.occupation,
            "profile_image_url": self.profile_image_url,
            "country": self.country,
            "region": self.region,
            "interests": self.interests or [],
            "owned_devices": self.owned_devices or [],
            "memberships": self.memberships or [],
            "xp_balance": self.xp_balance,
            "total_xp_earned": self.total_xp_earned,
            "surveys_completed_count": self.surveys_completed_count,
            "xp_profile_completion": self.xp_profile_completion or {},
            "is_active": self.is_active,
            "discord_id": self.discord_id,  # Include for all users
            "discord_role_ids": self.discord_role_ids or [],  # NEW: Include Discord role IDs
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "mfa_enabled": self.mfa_enabled,  # Include MFA status
        }
        if self.role == 'business_admin':
            data['business_id'] = self.business_id
            data['business_admin_permissions'] = self.business_admin_permissions if self.business_admin_permissions else {}
            if self.managed_business: 
                data['business_name'] = self.managed_business.name
        return data

class Admin(db.Model):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100), nullable=True)
    
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id', name='fk_admin_creator_id'), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    creator = db.relationship('Admin', remote_side=[id], backref='created_super_admins')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "name": self.name,
            "role": "super_admin",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class ReportSetting(db.Model):
    """Store user-specific report settings for surveys"""
    __tablename__ = 'report_settings'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    user_type = db.Column(db.String(50), nullable=False)
    settings = db.Column(db.JSON, nullable=True)
    view_name = db.Column(db.String(100), nullable=True, index=True)
    is_default_view = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('survey_id', 'user_id', 'user_type', 'view_name', name='uq_report_setting_view_name_resolved'),
    )

    # Relationships
    survey = db.relationship('Survey', backref=db.backref('report_settings_collection_resolved', lazy='dynamic'))

    # Relationship to User table
    user_profile = db.relationship(
        'User',
        primaryjoin="and_(ReportSetting.user_id == User.id, ReportSetting.user_type.in_(['user', 'business_admin']))",
        foreign_keys=[user_id], 
        backref=db.backref("report_settings_user_resolved", lazy='dynamic', overlaps="report_settings_admin_resolved,admin_profile"),
        uselist=False 
    )

    # Relationship to Admin table (for super_admins)
    admin_profile = db.relationship(
        'Admin',
        primaryjoin="and_(ReportSetting.user_id == Admin.id, ReportSetting.user_type == 'super_admin')", # Matched type to 'super_admin'
        foreign_keys=[user_id], 
        backref=db.backref("report_settings_admin_resolved", lazy='dynamic', overlaps="report_settings_user_resolved,user_profile"),
        uselist=False,
        overlaps="user_profile"
    )

# --- NEW: Business Table ---
class Business(db.Model):
    __tablename__ = 'businesses'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True)
    location = db.Column(db.String(255), nullable=True)
    tier = db.Column(db.String(50), nullable=False, default='normal') # Legacy - kept for backwards compatibility
    tier_id = db.Column(db.Integer, db.ForeignKey('business_tiers.id'), nullable=True)  # NEW: Reference to BusinessTier
    website = db.Column(db.String(255), nullable=True)
    discord_server = db.Column(db.String(255), nullable=True)
    
    # --- NEW: Tier-based and Purchased Limits ---
    # AI Credits - UPDATED to separate purchased and monthly points
    ai_points_purchased = db.Column(db.Integer, default=0, nullable=False)  # Pay-as-you-go purchased points
    ai_points_monthly = db.Column(db.Integer, default=0, nullable=False)    # Monthly quota points from tier
    
    # NEW: Extra responses purchased (pay-as-you-go quota that does not reset)
    responses_purchased = db.Column(db.Integer, default=0, nullable=False)
    
    # NEW: Billing cycle tracking for monthly points reset
    billing_cycle_start = db.Column(db.DateTime, nullable=True)  # When the current billing cycle started
    next_billing_date = db.Column(db.DateTime, nullable=True)    # When next billing/reset occurs
    
    # NEW: Monthly AI points configuration based on tier
    monthly_ai_points_quota = db.Column(db.Integer, default=0, nullable=False)  # Monthly quota based on tier
    
    # Legacy field for backward compatibility - will be deprecated
    ai_points = db.Column(db.Integer, default=0, nullable=False)  # DEPRECATED: Use ai_points_purchased + ai_points_monthly

    # Response Limits
    monthly_response_limit = db.Column(db.Integer, default=10000)
    monthly_responses_used = db.Column(db.Integer, default=0)
    
    # Quest Limits
    monthly_quest_limit = db.Column(db.Integer, default=5)
    monthly_quests_used = db.Column(db.Integer, default=0, nullable=False) # Renamed for clarity
    quest_credits_purchased = db.Column(db.Integer, default=0, nullable=False) # For pay-as-you-go quests
    quest_completion_limit = db.Column(db.Integer, default=5000) # Total completions across all active quests
    
    # Business Admin Seats
    admin_seat_limit = db.Column(db.Integer, default=1)
    admin_seats_purchased = db.Column(db.Integer, default=0, nullable=False)
    
    # --- NEW: Permissions JSON (Enhancement) ---
    # The existing `permissions` JSON will now store boolean flags for feature access.
    # e.g., {"CAN_USE_AI_BUILDER": true, "CAN_USE_AI_INSIGHTS": false, ...}
    permissions = db.Column(db.JSON, nullable=True) 

    cover_image_url = db.Column(db.String(255), nullable=True)
    logo_url = db.Column(db.String(255), nullable=True)
    
    # Color theme stored as JSON. Example:
    # {"primary_color": "#AA2EFF", "secondary_color": "#FFFFFF", "text_color": "#333333", 
    #  "feed_wall_bg": "#F0F0F0", "page_bg": "#EAEAEA", "feed_text_color": "#333333"}
    color_theme = db.Column(db.JSON, nullable=True)

    # ADDED: Audience control and feed defaults
    audience_type = db.Column(db.String(50), nullable=False, default='PUBLIC')  # 'PUBLIC' or 'RESTRICTED'
    default_public_on_wall = db.Column(db.Boolean, default=False)  # Default feed wall visibility for new activities

    is_active = db.Column(db.Boolean, default=True) # To activate/deactivate a business
    is_approved = db.Column(db.Boolean, default=False) # For approval workflow
    requested_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', name='fk_business_requester_user_id'), nullable=True) # If a user requests a business
    # Flag for featuring businesses/brands on user homepage
    is_featured = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # business_admins: Handled via User.managed_business backref
    surveys = db.relationship('Survey', 
                              foreign_keys='Survey.business_id',
                              back_populates='business', 
                              lazy='dynamic',
                              cascade="all, delete-orphan") # Surveys belonging to this business
    # quests = db.relationship('Quest', backref='business', lazy='dynamic') # If you add Quests
    # bug_reports = db.relationship('BugReport', backref='business', lazy='dynamic') # If you add BugReports
    
    # Relationship for business requests
    requester = db.relationship('User', foreign_keys=[requested_by_user_id], backref='requested_businesses')

    def get_total_ai_points(self):
        """Get total available AI points (monthly + purchased)"""
        return self.ai_points_monthly + self.ai_points_purchased

    # NEW: helper for total responses quota (subscription limit + purchased extra)
    def get_total_response_quota(self):
        """Get total available survey responses quota for the current billing cycle"""
        return (self.monthly_response_limit or 0) + (self.responses_purchased or 0)

    def days_until_reset(self):
        """Get number of days until next billing cycle/monthly points reset"""
        if not self.next_billing_date:
            return None
        from datetime import datetime
        delta = self.next_billing_date - datetime.utcnow()
        return max(0, delta.days)

    def is_billing_cycle_due(self):
        """Check if billing cycle reset is due"""
        if not self.next_billing_date:
            return False
        from datetime import datetime
        return datetime.utcnow() >= self.next_billing_date

    def get_monthly_points_for_tier(self):
        """Get monthly AI points quota based on tier"""
        tier_monthly_points = {
            'normal': 0,
            'advanced': 100,
            'super': 200
        }
        return tier_monthly_points.get(self.tier, 0)

    def reset_monthly_points(self):
        """Reset monthly points based on current tier and advance billing cycle"""
        from datetime import datetime, timedelta
        
        # Set new monthly points based on tier
        new_quota = self.get_monthly_points_for_tier()
        self.ai_points_monthly = new_quota
        self.monthly_ai_points_quota = new_quota
        
        # Advance billing cycle by 1 month
        if self.next_billing_date:
            # Add approximately 30 days for the next cycle
            self.billing_cycle_start = self.next_billing_date
            self.next_billing_date = self.next_billing_date + timedelta(days=30)
        else:
            # Initialize billing cycle if not set
            self.billing_cycle_start = datetime.utcnow()
            self.next_billing_date = datetime.utcnow() + timedelta(days=30)

    def upgrade_tier(self, new_tier):
        """Handle tier upgrade with points transition logic"""
        if new_tier == self.tier:
            return  # No change needed
        
        old_tier = self.tier
        old_monthly_quota = self.get_monthly_points_for_tier()
        
        # Update tier
        self.tier = new_tier
        new_monthly_quota = self.get_monthly_points_for_tier()
        
        # If upgrading, add remaining monthly points from old tier to new tier quota
        if new_monthly_quota > old_monthly_quota:
            remaining_old_points = self.ai_points_monthly
            self.ai_points_monthly = new_monthly_quota + remaining_old_points
            self.monthly_ai_points_quota = new_monthly_quota
        
        # If downgrading, keep current points until next billing cycle
        # (points will be reset to new tier quota on next billing cycle)
        elif new_monthly_quota < old_monthly_quota:
            # Keep current monthly points until billing cycle resets
            # Only update the quota for the next reset
            self.monthly_ai_points_quota = new_monthly_quota

    # NEW: Analytics counter fields
    active_survey_count = db.Column(db.Integer, default=0, nullable=False)
    total_submission_count = db.Column(db.Integer, default=0, nullable=False) # Total submissions for this business's surveys
    active_quest_count = db.Column(db.Integer, default=0, nullable=False) # Assuming future quest implementation
    completed_quest_submission_count = db.Column(db.Integer, default=0, nullable=False) # Assuming future quest implementation
    cumulative_earnable_points = db.Column(db.Integer, default=0, nullable=False) # (active_surveys + active_quests) * 40 (or other value)
    splash_page_visit_count = db.Column(db.Integer, default=0, nullable=False)

    # NEW: Splash page layout configuration
    # splash_template: integer 1-6 indicating which predefined layout to use
    # splash_blocks: ordered list of content identifiers assigned to slots
    # Allowed identifiers (frontend enforced):
    #   'SURVEYS', 'QUESTS', 'BUGS_LIST', 'FEATURES_LIST', 'REPORT_FORM', 'CO_CREATE'
    splash_template = db.Column(db.Integer, nullable=True)
    splash_blocks = db.Column(db.JSON, nullable=True)

    def to_dict(self):
        # Count published surveys for this business
        survey_count = self.surveys.filter_by(published=True, is_archived=False).count()
        
        # Log survey count for debugging
        # from flask import current_app # This won't work directly in db_setup.py context as easily
        # if current_app:
        #     current_app.logger.debug(f"[BUSINESS_TO_DICT] Business '{self.name}' (ID: {self.id}) has {survey_count} published surveys")
        
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "tier": self.tier,
            "tier_id": self.tier_id,
            "tier_info": self.tier_info.to_dict() if self.tier_info else None,
            "website": self.website,
            "discord_server": self.discord_server,
            "permissions": self.permissions,
            # NEW: AI Points and Limits
            "ai_points_purchased": self.ai_points_purchased,
            "ai_points_monthly": self.ai_points_monthly,
            "total_ai_points": self.get_total_ai_points(),
            "monthly_ai_points_quota": self.monthly_ai_points_quota,
            "billing_cycle_start": self.billing_cycle_start.isoformat() if self.billing_cycle_start else None,
            "next_billing_date": self.next_billing_date.isoformat() if self.next_billing_date else None,
            "days_until_reset": self.days_until_reset(),
            "monthly_response_limit": self.monthly_response_limit,
            "monthly_responses_used": self.monthly_responses_used,
            "responses_purchased": self.responses_purchased,
            "total_response_quota": self.get_total_response_quota(),
            "monthly_quest_limit": self.monthly_quest_limit,
            "monthly_quests_used": self.monthly_quests_used,
            "quest_credits_purchased": self.quest_credits_purchased,
            "quest_completion_limit": self.quest_completion_limit,
            "admin_seat_limit": self.admin_seat_limit,  # Legacy field
            "admin_seats_purchased": self.admin_seats_purchased,
            # Legacy support
            "ai_points": self.get_total_ai_points(),
            # Existing fields
            "cover_image_url": self.cover_image_url,
            "logo_url": self.logo_url,
            "color_theme": self.color_theme,
            "audience_type": self.audience_type,
            "default_public_on_wall": self.default_public_on_wall,
            "is_active": self.is_active,
            "is_approved": self.is_approved,
            "requested_by_user_id": self.requested_by_user_id,
            "survey_count": survey_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # NEW: Include analytics counter fields in to_dict if needed by other parts of the app
            "active_survey_count": self.active_survey_count,
            "total_submission_count": self.total_submission_count,
            "active_quest_count": self.active_quest_count,
            "completed_quest_submission_count": self.completed_quest_submission_count,
            "cumulative_earnable_points": self.cumulative_earnable_points,
            "splash_page_visit_count": self.splash_page_visit_count,
            "is_featured": self.is_featured,
            # Splash layout configuration
            "splash_template": self.splash_template,
            "splash_blocks": self.splash_blocks or [],
        }

# ===== NEW MODELS FOR AUDIENCE SELECTION =====

class BusinessAudience(db.Model):
    """Audience access control for business splash pages"""
    __tablename__ = 'business_audience'

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Email domain whitelist (e.g., ['edu.pk', 'company.com'])
    email_domain_whitelist = db.Column(db.JSON, nullable=True)
    
    # Specific email addresses (e.g., ['user1@example.com', 'user2@company.com'])
    specific_email_whitelist = db.Column(db.JSON, nullable=True)
    
    # Discord roles that can access (e.g., ['moderator', 'member'])
    discord_roles_allowed = db.Column(db.JSON, nullable=True)
    
    # NEW: Discord server member visibility - if True, only Discord server members can view
    discord_server_members_only = db.Column(db.Boolean, default=False, nullable=False)
    
    # QR code access token
    qr_code_token = db.Column(db.String(255), nullable=True, unique=True)
    qr_code_expires_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    business = db.relationship('Business', backref=db.backref('audience_settings', uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "email_domain_whitelist": self.email_domain_whitelist or [],
            "specific_email_whitelist": self.specific_email_whitelist or [],
            "discord_roles_allowed": self.discord_roles_allowed or [],
            "discord_server_members_only": self.discord_server_members_only,
            "qr_code_token": self.qr_code_token,
            "qr_code_expires_at": self.qr_code_expires_at.isoformat() if self.qr_code_expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class SurveyAudience(db.Model):
    """Survey-specific audience access control"""
    __tablename__ = 'survey_audience'

    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Access type: 'BUSINESS_AUDIENCE', 'PUBLIC_TO_BUSINESS_USERS', 'SPECIFIC_RULES'
    access_type = db.Column(db.String(50), nullable=False, default='BUSINESS_AUDIENCE')
    
    # Survey-specific rules (used when access_type is 'SPECIFIC_RULES')
    email_domain_whitelist = db.Column(db.JSON, nullable=True)
    specific_email_whitelist = db.Column(db.JSON, nullable=True)
    discord_roles_allowed = db.Column(db.JSON, nullable=True)
    qr_code_token = db.Column(db.String(255), nullable=True, unique=True)
    qr_code_expires_at = db.Column(db.DateTime, nullable=True)
    
    # NEW: Fields for tag-based audience restriction
    required_tags = db.Column(db.JSON, nullable=True)  # Array of ProfileTag.id or ProfileTag.name
    tag_matching_logic = db.Column(db.String(50), nullable=True, default='ANY')  # 'ANY' or 'ALL'
    
    # NEW: Direct access tokens for bypassing restrictions
    direct_access_tokens = db.Column(db.JSON, nullable=True)  # Array of tokens for direct access
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    survey = db.relationship('Survey', backref=db.backref('audience_settings', uselist=False, cascade="all, delete-orphan"))

    def add_direct_access_token(self, token=None):
        """Add a direct access token for bypassing audience restrictions"""
        import secrets
        if token is None:
            token = secrets.token_urlsafe(32)
        
        if self.direct_access_tokens is None:
            self.direct_access_tokens = []
        
        if token not in self.direct_access_tokens:
            self.direct_access_tokens.append(token)
        
        return token
    
    def is_valid_direct_access_token(self, token):
        """Check if provided token is valid for direct access"""
        if not self.direct_access_tokens:
            return False
        return token in self.direct_access_tokens

    def to_dict(self):
        return {
            'id': self.id,
            'survey_id': self.survey_id,
            'access_type': self.access_type,
            'email_domain_whitelist': self.email_domain_whitelist,
            'specific_email_whitelist': self.specific_email_whitelist,
            'discord_roles_allowed': self.discord_roles_allowed,
            'required_tags': self.required_tags,
            'tag_matching_logic': self.tag_matching_logic,
            'qr_code_token': self.qr_code_token,
            'qr_code_expires_at': self.qr_code_expires_at.isoformat() if self.qr_code_expires_at else None,
            'direct_access_tokens': self.direct_access_tokens,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# NEW: Discord role mapping table for efficient lookups
class SurveyDiscordRole(db.Model):
    """Mapping table for Discord roles that can access specific surveys"""
    __tablename__ = 'survey_discord_roles'
    
    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False)
    discord_role_id = db.Column(db.String(255), nullable=False)  # Discord role ID
    discord_role_name = db.Column(db.String(255), nullable=True)  # Role name for reference
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=False)  # For context
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    survey = db.relationship('Survey', backref='discord_role_mappings')
    business = db.relationship('Business', backref='survey_discord_mappings')
    
    # Unique constraint to prevent duplicate role-survey mappings
    __table_args__ = (db.UniqueConstraint('survey_id', 'discord_role_id', name='uq_survey_discord_role'),)

    def to_dict(self):
        return {
            'id': self.id,
            'survey_id': self.survey_id,
            'discord_role_id': self.discord_role_id,
            'discord_role_name': self.discord_role_name,
            'business_id': self.business_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# ===== NEW MODELS FOR FEATURES/BUGS WITH VOTING =====

class Item(db.Model):
    """Bug reports and feature requests with voting system"""
    __tablename__ = 'items'

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Who reported/requested
    
    item_type = db.Column(db.String(20), nullable=False)  # 'BUG', 'FEATURE', or 'CUSTOM POST'
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    
    status = db.Column(db.String(20), nullable=False, default='PENDING')  # 'PENDING', 'COMPLETED', 'REJECTED', 'UNDER_REVIEW', 'PLANNED'
    
    # NEW: Publishing and archiving controls
    is_published = db.Column(db.Boolean, default=False, nullable=False)  # Controls public visibility
    is_archived = db.Column(db.Boolean, default=False, nullable=False)  # For keeping items but hiding from active lists
    
    upvotes = db.Column(db.Integer, default=0)
    downvotes = db.Column(db.Integer, default=0)
    net_votes = db.Column(db.Integer, default=0)  # upvotes - downvotes (updated via trigger or calculation)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business = db.relationship('Business', backref=db.backref('items', lazy='dynamic'))
    user = db.relationship('User', backref='reported_items')
    votes = db.relationship('ItemVote', backref='item', cascade="all, delete-orphan")

    def update_vote_counts(self):
        """Update vote counts based on ItemVote records"""
        from sqlalchemy import func
        upvote_count = db.session.query(func.count(ItemVote.id)).filter(
            ItemVote.item_id == self.id, 
            ItemVote.vote_type == 1
        ).scalar() or 0
        
        downvote_count = db.session.query(func.count(ItemVote.id)).filter(
            ItemVote.item_id == self.id, 
            ItemVote.vote_type == -1
        ).scalar() or 0
        
        self.upvotes = upvote_count
        self.downvotes = downvote_count
        self.net_votes = upvote_count - downvote_count

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "user_id": self.user_id,
            "item_type": self.item_type,
            "title": self.title,
            "description": self.description,
            "image_url": self.image_url,
            "status": self.status,
            "is_published": self.is_published,
            "is_archived": self.is_archived,
            "upvotes": self.upvotes,
            "downvotes": self.downvotes,
            "net_votes": self.net_votes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_name": self.user.name if self.user else None,
            "business_name": self.business.name if self.business else None
        }


class ItemVote(db.Model):
    """Individual votes on bugs/features"""
    __tablename__ = 'item_votes'

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    vote_type = db.Column(db.Integer, nullable=False)  # 1 for upvote, -1 for downvote

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Ensure one vote per user per item
    __table_args__ = (db.UniqueConstraint('item_id', 'user_id', name='unique_user_item_vote'),)

    # Relationships
    user = db.relationship('User', backref='item_votes')

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "user_id": self.user_id,
            "vote_type": self.vote_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Idea(db.Model):
    """Community co-creation ideas scoped to a business"""
    __tablename__ = 'ideas'

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(255), nullable=True)  # Main/primary image for backward compatibility
    image_urls = db.Column(db.JSON, nullable=True)  # Array of all image URLs for multiple image support

    status = db.Column(db.String(20), nullable=False, default='UNDER_REVIEW')  # UNDER_REVIEW, PUBLISHED, REJECTED, ARCHIVED
    rejection_reason = db.Column(db.Text, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)

    support_ends_at = db.Column(db.DateTime, nullable=True)
    published_at = db.Column(db.DateTime, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)

    published_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    archived_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    last_moderated_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    likes_count = db.Column(db.Integer, nullable=False, default=0)
    comments_count = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = db.relationship('Business', backref=db.backref('ideas', lazy='dynamic'))
    author = db.relationship('User', foreign_keys=[author_id], backref='ideas_submitted')
    published_by = db.relationship('User', foreign_keys=[published_by_id], backref='ideas_published', uselist=False)
    archived_by = db.relationship('User', foreign_keys=[archived_by_id], backref='ideas_archived', uselist=False)
    last_moderated_by = db.relationship('User', foreign_keys=[last_moderated_by_id], backref='ideas_moderated', uselist=False)

    def to_dict(self, include_relations=False):
        data = {
            "id": self.id,
            "business_id": self.business_id,
            "author_id": self.author_id,
            "title": self.title,
            "description": self.description,
            "image_url": self.image_url,
            "image_urls": self.image_urls or [],  # Include multiple images
            "status": self.status,
            "rejection_reason": self.rejection_reason,
            "review_notes": self.review_notes,
            "support_ends_at": self.support_ends_at.isoformat() if self.support_ends_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "likes_count": self.likes_count,
            "comments_count": self.comments_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_relations:
            data["author_name"] = self.author.name if self.author else None
            data["published_by_name"] = self.published_by.name if self.published_by else None
            data["archived_by_name"] = self.archived_by.name if self.archived_by else None
        return data

    def is_open_for_support(self):
        if not self.support_ends_at:
            return True

        support_end = self.support_ends_at

        # Normalize timezone-aware datetimes to UTC naive for consistent comparison
        if getattr(support_end, "tzinfo", None) is not None:
            support_end = support_end.astimezone(timezone.utc).replace(tzinfo=None)

        now_utc = datetime.utcnow()
        if now_utc <= support_end:
            return True

        # Fallback: treat the support period as open for the remainder of the support_end calendar day
        return now_utc.date() <= support_end.date()


class IdeaLike(db.Model):
    """Single-like tracking for co-create ideas"""
    __tablename__ = 'idea_likes'

    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('idea_id', 'user_id', name='uq_idea_like_once_per_user'),)

    idea = db.relationship('Idea', backref=db.backref('likes', lazy='dynamic', cascade="all, delete-orphan"))
    user = db.relationship('User', backref='idea_likes')

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class IdeaComment(db.Model):
    """User comments on co-create ideas"""
    __tablename__ = 'idea_comments'

    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('idea_comments.id', ondelete='CASCADE'), nullable=True)

    body = db.Column(db.Text, nullable=False)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('comments', lazy='dynamic', cascade="all, delete-orphan"))
    user = db.relationship('User', backref='idea_comments')
    replies = db.relationship('IdeaComment', backref=db.backref('parent', remote_side=[id]), cascade="all, delete-orphan")

    def to_dict(self, include_replies=True):
        data = {
            "id": self.id,
            "idea_id": self.idea_id,
            "user_id": self.user_id,
            "parent_id": self.parent_id,
            "body": None if self.is_deleted else self.body,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_name": self.user.name if self.user else None,
        }
        if include_replies:
            data["replies"] = [reply.to_dict(include_replies=False) for reply in self.replies if not reply.is_deleted]
        return data


class IdeaMilestone(db.Model):
    """Like milestones attached during moderation"""
    __tablename__ = 'idea_milestones'

    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    likes_target = db.Column(db.Integer, nullable=False)
    achieved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('milestones', lazy='dynamic', cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "label": self.label,
            "likes_target": self.likes_target,
            "achieved_at": self.achieved_at.isoformat() if self.achieved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class IdeaModerationLog(db.Model):
    """Audit trail for idea moderation actions"""
    __tablename__ = 'idea_moderation_logs'

    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    action_metadata = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('moderation_logs', lazy='dynamic', cascade="all, delete-orphan"))
    admin = db.relationship('User', backref='idea_moderation_actions', foreign_keys=[admin_id])

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "admin_id": self.admin_id,
            "admin_name": self.admin.name if self.admin else None,
            "action": self.action,
            "reason": self.reason,
            "metadata": self.action_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ===== NEW MODELS FOR POINTS SYSTEM =====

class PointsLog(db.Model):
    """Track user points earned from various activities"""
    __tablename__ = 'points_log'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=True)  # Context for points
    
    # Optional references to specific items that earned points
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=True)
    quest_id = db.Column(db.Integer, db.ForeignKey('quests.id'), nullable=True)  # For quest completions
    item_id = db.Column(db.Integer, db.ForeignKey('items.id'), nullable=True)  # For bug/feature points
    
    activity_type = db.Column(db.String(50), nullable=False)  # 'SURVEY_COMPLETED', 'QUEST_COMPLETED', 'BUG_REPORTED', 'FEATURE_REQUESTED', 'FEATURE_VOTED'
    points_awarded = db.Column(db.Integer, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='points_earned')
    business = db.relationship('Business', backref='points_given')
    survey = db.relationship('Survey', backref='points_earned_from')
    quest = db.relationship('Quest', backref='points_earned_from')
    related_item = db.relationship('Item', backref='points_earned_from')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "business_id": self.business_id,
            "survey_id": self.survey_id,
            "item_id": self.item_id,
            "activity_type": self.activity_type,
            "points_awarded": self.points_awarded,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "business_name": self.business.name if self.business else None,
            "survey_title": self.survey.title if self.survey else None,
            "quest_title": self.quest.title if self.quest else None
        }


# ===== NEW MODEL FOR BUSINESS ACTIVITY FEED =====

class BusinessActivity(db.Model):
    """Activity feed for business splash pages"""
    __tablename__ = 'business_activities'

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Admin who created the activity, or null for system activities
    
    activity_type = db.Column(db.String(50), nullable=False)  # 'SURVEY_PUBLISHED', 'QUEST_CREATED', 'BUG_REPORTED', 'FEATURE_REQUESTED', 'CUSTOM_POST'
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Generic reference to related items (survey_id, quest_id, item_id)
    related_item_id = db.Column(db.Integer, nullable=True)  # UUID or Integer depending on your ID type
    related_item_url = db.Column(db.String(255), nullable=True)  # Direct link to the item
    
    is_public = db.Column(db.Boolean, default=False)  # Controls visibility on public feed
    is_pinned = db.Column(db.Boolean, default=False)  # Pin important posts to top
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business = db.relationship('Business', backref=db.backref('activities', lazy='dynamic'))
    user = db.relationship('User', backref='created_activities')

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "user_id": self.user_id,
            "activity_type": self.activity_type,
            "title": self.title,
            "description": self.description,
            "related_item_id": self.related_item_id,
            "related_item_url": self.related_item_url,
            "is_public": self.is_public,
            "is_pinned": self.is_pinned,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_name": self.user.name if self.user else "System",
            "business_name": self.business.name if self.business else None
        }

# ===== QUEST SYSTEM MODELS =====

class QuestType(Enum):
    """Enum for different quest types with their requirements"""
    # Social Media Quests
    FOLLOW_X_PAGE = "FOLLOW_X_PAGE"
    RETWEET_X_POST = "RETWEET_X_POST"
    LIKE_X_POST = "LIKE_X_POST"
    COMMENT_X_POST = "COMMENT_X_POST"
    FOLLOW_INSTAGRAM = "FOLLOW_INSTAGRAM"
    LIKE_INSTAGRAM_POST = "LIKE_INSTAGRAM_POST"
    REPOST_INSTAGRAM = "REPOST_INSTAGRAM"
    REPLY_INSTAGRAM = "REPLY_INSTAGRAM"
    FOLLOW_LINKEDIN_PAGE = "FOLLOW_LINKEDIN_PAGE"
    LIKE_LINKEDIN_POST = "LIKE_LINKEDIN_POST"
    COMMENT_LINKEDIN_POST = "COMMENT_LINKEDIN_POST"
    SHARE_LINKEDIN_POST = "SHARE_LINKEDIN_POST"
    REPOST_LINKEDIN = "REPOST_LINKEDIN"
    REACT_LINKEDIN_MESSAGE = "REACT_LINKEDIN_MESSAGE"
    
    # Video/Content Quests
    WATCH_YOUTUBE_VIDEO = "WATCH_YOUTUBE_VIDEO"
    SUBSCRIBE_YOUTUBE_CHANNEL = "SUBSCRIBE_YOUTUBE_CHANNEL"
    LIKE_YOUTUBE_VIDEO = "LIKE_YOUTUBE_VIDEO"
    COMMENT_YOUTUBE_VIDEO = "COMMENT_YOUTUBE_VIDEO"
    
    # Community Quests
    JOIN_DISCORD_SERVER = "JOIN_DISCORD_SERVER"
    JOIN_TELEGRAM = "JOIN_TELEGRAM"
    
    # Download Quests
    DOWNLOAD_APP = "DOWNLOAD_APP"
    DOWNLOAD_GAME = "DOWNLOAD_GAME"
    
    # Survey Quests (Internal)
    COMPLETE_SURVEY = "COMPLETE_SURVEY"
    COMPLETE_X_SURVEYS = "COMPLETE_X_SURVEYS"
    VISIT_LINK = "VISIT_LINK"
    
    # NEW: Eclipseer Quests (Internal Platform Activities)
    COMPLETE_X_SURVEYS_DAILY = "COMPLETE_X_SURVEYS_DAILY"
    COMPLETE_X_SURVEYS_TOTAL = "COMPLETE_X_SURVEYS_TOTAL"
    SELECT_X_TAGS = "SELECT_X_TAGS"
    COMPLETE_X_QUESTS = "COMPLETE_X_QUESTS"
    VISIT_X_BRAND_PAGES = "VISIT_X_BRAND_PAGES"
    UPLOAD_PROFILE_PICTURE = "UPLOAD_PROFILE_PICTURE"
    COMPLETE_PROFILE_SECTION = "COMPLETE_PROFILE_SECTION"

class Quest(db.Model):
    """Quest system for gamification"""
    __tablename__ = 'quests'
    
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=True)  # Null for super admin quests
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)  # Super admin who created
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)   # Business admin who created
    
    # Basic quest info
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    quest_type = db.Column(db.String(50), nullable=False)  # From QuestType enum
    
    # Media and visual
    image_url = db.Column(db.String(255), nullable=True)
    
    # Quest requirements and configuration
    target_url = db.Column(db.String(500), nullable=True)  # URL for external tasks (X, YouTube, etc.)
    target_data = db.Column(db.JSON, nullable=True)  # Additional config (survey_id, count requirements, etc.)
    verification_method = db.Column(db.String(50), nullable=False, default='CLICK_VERIFY')  # 'CLICK_VERIFY', 'AUTO_VERIFY', 'MANUAL_VERIFY'
    
    # Rewards
    xp_reward = db.Column(db.Integer, nullable=False, default=0)
    has_raffle_prize = db.Column(db.Boolean, default=False, nullable=False)
    raffle_prize_description = db.Column(db.String(500), nullable=True)
    raffle_end_date = db.Column(db.DateTime, nullable=True)
    raffle_winner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Completion tracking
    completion_count = db.Column(db.Integer, default=0, nullable=False)
    max_completions = db.Column(db.Integer, nullable=True)  # Null = unlimited
    
    # Status and visibility
    is_published = db.Column(db.Boolean, default=False, nullable=False)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    is_featured = db.Column(db.Boolean, default=False, nullable=False)  # Featured on business pages
    
    # NEW: Approval workflow for business admin created quests
    approval_status = db.Column(db.String(50), nullable=False, default='APPROVED')  # 'PENDING', 'APPROVED', 'REJECTED'
    reviewed_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)  # Super admin who reviewed
    admin_review_notes = db.Column(db.Text, nullable=True)  # Review comments from super admin
    reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Scheduling
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = db.relationship('Business', backref=db.backref('quests', lazy='dynamic'))
    created_by_admin = db.relationship('Admin', backref='created_quests', foreign_keys=[created_by_admin_id])
    created_by_user = db.relationship('User', backref='created_quests', foreign_keys=[created_by_user_id])
    raffle_winner = db.relationship('User', backref='won_quest_raffles', foreign_keys=[raffle_winner_user_id])
    reviewed_by = db.relationship('Admin', backref='reviewed_quests', foreign_keys=[reviewed_by_admin_id])
    completions = db.relationship('QuestCompletion', backref='quest', cascade="all, delete-orphan")
    
    def get_quest_type_display(self):
        """Get human-readable quest type"""
        type_mapping = {
            'FOLLOW_X_PAGE': 'Follow X Page',
            'RETWEET_X_POST': 'Retweet X Post',
            'LIKE_X_POST': 'Like X Post',
            'COMMENT_X_POST': 'Comment on X Post',
            'FOLLOW_INSTAGRAM': 'Follow on Instagram',
            'LIKE_INSTAGRAM_POST': 'Like Instagram Post',
            'REPOST_INSTAGRAM': 'Repost on Instagram',
            'REPLY_INSTAGRAM': 'Reply on Instagram',
            'FOLLOW_LINKEDIN_PAGE': 'Follow LinkedIn Page',
            'LIKE_LINKEDIN_POST': 'Like LinkedIn Post',
            'COMMENT_LINKEDIN_POST': 'Comment on LinkedIn Post',
            'SHARE_LINKEDIN_POST': 'Share LinkedIn Post',
            'REPOST_LINKEDIN': 'Repost on LinkedIn',
            'REACT_LINKEDIN_MESSAGE': 'React to LinkedIn Message',
            'WATCH_YOUTUBE_VIDEO': 'Watch YouTube Video',
            'SUBSCRIBE_YOUTUBE_CHANNEL': 'Subscribe to YouTube Channel',
            'LIKE_YOUTUBE_VIDEO': 'Like YouTube Video',
            'COMMENT_YOUTUBE_VIDEO': 'Comment on YouTube Video',
            'JOIN_DISCORD_SERVER': 'Join Discord Server',
            'JOIN_TELEGRAM': 'Join Telegram',
            'DOWNLOAD_APP': 'Download App',
            'DOWNLOAD_GAME': 'Download Game',
            'COMPLETE_SURVEY': 'Complete Survey',
            'COMPLETE_X_SURVEYS': 'Complete X Surveys',
            'VISIT_LINK': 'Visit Link'
        }
        return type_mapping.get(self.quest_type, self.quest_type)
    
    def is_active(self):
        """Check if quest is currently active"""
        now = datetime.utcnow()
        if not self.is_published or self.is_archived:
            return False
        
        if self.start_date and now < self.start_date:
            return False
            
        if self.end_date and now > self.end_date:
            return False
            
        if self.max_completions and self.completion_count >= self.max_completions:
            return False
            
        return True
    
    def can_user_complete(self, user_id):
        """Check if a user can complete this quest"""
        if not self.is_active():
            return False
            
        # Check if user already completed this quest
        existing_completion = QuestCompletion.query.filter_by(
            quest_id=self.id,
            user_id=user_id
        ).first()
        
        return existing_completion is None
    
    def to_dict(self, include_completions=False):
        result = {
            "id": self.id,
            "business_id": self.business_id,
            "business_name": self.business.name if self.business else None,
            "created_by_admin_id": self.created_by_admin_id,
            "created_by_user_id": self.created_by_user_id,
            "created_by_user": {
                "id": self.created_by_user.id,
                "username": self.created_by_user.username,
                "name": self.created_by_user.name
            } if self.created_by_user else None,
            "business": {
                "id": self.business.id,
                "name": self.business.name
            } if self.business else None,
            "title": self.title,
            "description": self.description,
            "quest_type": self.quest_type,
            "quest_type_display": self.get_quest_type_display(),
            "image_url": self.image_url,
            "target_url": self.target_url,
            "target_data": self.target_data,
            "verification_method": self.verification_method,
            "xp_reward": self.xp_reward,
            "has_raffle_prize": self.has_raffle_prize,
            "raffle_prize_description": self.raffle_prize_description,
            "raffle_end_date": self.raffle_end_date.isoformat() if self.raffle_end_date else None,
            "raffle_winner_user_id": self.raffle_winner_user_id,
            "completion_count": self.completion_count,
            "max_completions": self.max_completions,
            "is_published": self.is_published,
            "is_archived": self.is_archived,
            "is_featured": self.is_featured,
            "is_active": self.is_active(),
            "approval_status": self.approval_status,
            "reviewed_by_admin_id": self.reviewed_by_admin_id,
            "admin_review_notes": self.admin_review_notes,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_completions:
            result["completions"] = [completion.to_dict() for completion in self.completions]
            
        return result

class QuestCompletion(db.Model):
    """Track user quest completions"""
    __tablename__ = 'quest_completions'
    
    id = db.Column(db.Integer, primary_key=True)
    quest_id = db.Column(db.Integer, db.ForeignKey('quests.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Completion tracking
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    verification_status = db.Column(db.String(50), nullable=False, default='PENDING')  # 'PENDING', 'VERIFIED', 'REJECTED'
    verification_data = db.Column(db.JSON, nullable=True)  # Store verification details
    
    # NEW: Proof submission and manual verification
    proof_submitted = db.Column(db.Boolean, default=False, nullable=False)  # Whether user submitted proof
    proof_type = db.Column(db.String(50), nullable=True)  # 'IMAGE', 'SCREENSHOT', 'LINK_CLICK', 'TEXT'
    proof_data = db.Column(db.JSON, nullable=True)  # Store proof files/data
    proof_text = db.Column(db.Text, nullable=True)  # Text proof/description from user
    
    # Link click verification (for quests with target URLs)
    link_clicked = db.Column(db.Boolean, default=False, nullable=False)  # Whether user clicked the required link
    link_click_timestamp = db.Column(db.DateTime, nullable=True)  # When link was clicked
    
    # Business admin verification
    verified_by_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Business admin who verified
    admin_verification_notes = db.Column(db.Text, nullable=True)  # Notes from business admin
    verified_at = db.Column(db.DateTime, nullable=True)  # When verification was completed
    
    # XP reward tracking
    xp_awarded = db.Column(db.Integer, nullable=False, default=0)
    xp_status = db.Column(db.String(50), nullable=False, default='PENDING')  # 'PENDING', 'AWARDED', 'REJECTED'
    
    # Raffle tracking
    raffle_entry_created = db.Column(db.Boolean, default=False, nullable=False)
    
    # Relationships
    user = db.relationship('User', backref='quest_completions', foreign_keys=[user_id])
    verified_by = db.relationship('User', backref='verified_quest_completions', foreign_keys=[verified_by_admin_id])
    
    # Unique constraint - one completion per user per quest
    __table_args__ = (db.UniqueConstraint('quest_id', 'user_id', name='uq_quest_user_completion'),)
    
    def to_dict(self):
        return {
            "id": self.id,
            "quest_id": self.quest_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "verification_status": self.verification_status,
            "verification_data": self.verification_data,
            "xp_awarded": self.xp_awarded,
            "raffle_entry_created": self.raffle_entry_created,
            # Proof submission fields
            "proof_submitted": self.proof_submitted,
            "proof_type": self.proof_type,
            "proof_data": self.proof_data,
            "proof_text": self.proof_text,
            "link_clicked": self.link_clicked,
            "link_click_timestamp": self.link_click_timestamp.isoformat() if self.link_click_timestamp else None,
            "verified_by_admin_id": self.verified_by_admin_id,
            "admin_verification_notes": self.admin_verification_notes,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "xp_status": self.xp_status
        }

class QuestLinkClick(db.Model):
    """Track quest link clicks independently of quest completion"""
    __tablename__ = 'quest_link_clicks'
    
    id = db.Column(db.Integer, primary_key=True)
    quest_id = db.Column(db.Integer, db.ForeignKey('quests.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    clicked_at = db.Column(db.DateTime, default=datetime.utcnow)
    target_url = db.Column(db.String(500), nullable=True)  # Store the URL that was clicked
    user_agent = db.Column(db.String(255), nullable=True)  # Track browser/device info
    ip_address = db.Column(db.String(45), nullable=True)  # Track IP for analytics
    
    # Relationships
    quest = db.relationship('Quest', backref='link_clicks')
    user = db.relationship('User', backref='quest_link_clicks')
    
    # Unique constraint - one link click record per user per quest
    __table_args__ = (db.UniqueConstraint('quest_id', 'user_id', name='uq_quest_user_link_click'),)
    
    def to_dict(self):
        return {
            "id": self.id,
            "quest_id": self.quest_id,
            "user_id": self.user_id,
            "clicked_at": self.clicked_at.isoformat() if self.clicked_at else None,
            "target_url": self.target_url
        }

# ===== NEW MODELS FOR GAMIFICATION SYSTEM =====

class TagCategory(Enum):
    """Categories for profile tags"""
    INTEREST = "INTEREST"
    OWNED_DEVICE = "OWNED_DEVICE"
    MEMBERSHIP = "MEMBERSHIP"

class ProfileTag(db.Model):
    """Admin-managed tags for user profiles"""
    __tablename__ = 'profile_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    category = db.Column(db.String(50), nullable=False)  # Use TagCategory enum
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "category": self.category}

class RewardStatus(Enum):
    """Status enum for reward redemptions"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    UNCONFIRMED = "UNCONFIRMED" 
    REJECTED = "REJECTED"
    RAFFLE_LOST = "RAFFLE_LOST"

class MarketplaceItem(db.Model):
    """Items available for XP redemption"""
    __tablename__ = 'marketplace_items'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    xp_cost = db.Column(db.Integer, nullable=False)
    item_type = db.Column(db.String(50), nullable=False, default='DIRECT')  # 'DIRECT' or 'RAFFLE'
    stock = db.Column(db.Integer, nullable=True)  # Optional: for limited items
    redeem_limit_per_user = db.Column(db.Integer, nullable=True) # Max redemptions per user
    raffle_entries_per_user = db.Column(db.Integer, nullable=True, default=1)
    raffle_end_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Flag to feature marketplace items on user homepage
    is_featured = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "image_url": self.image_url,
            "xp_cost": self.xp_cost,
            "item_type": self.item_type,
            "stock": self.stock,
            "redeem_limit_per_user": self.redeem_limit_per_user,
            "raffle_entries_per_user": self.raffle_entries_per_user,
            "raffle_end_date": self.raffle_end_date.isoformat() if self.raffle_end_date else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "is_featured": self.is_featured,
        }

class UserRewardLog(db.Model):
    """Log of user reward redemptions and raffle entries"""
    __tablename__ = 'user_reward_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    marketplace_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=False)
    xp_spent = db.Column(db.Integer, nullable=False)
    reward_type = db.Column(db.String(50), nullable=False)  # 'DIRECT' or 'RAFFLE_ENTRY'
    status = db.Column(db.String(50), nullable=False, default=RewardStatus.PENDING.value)
    notes = db.Column(db.Text, nullable=True)
    redeemed_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='reward_logs')
    marketplace_item = db.relationship('MarketplaceItem', backref='redemptions')

    def to_dict(self):
        return {
            "id": self.id,
            "reward_title": self.marketplace_item.title if self.marketplace_item else "N/A",
            "reward_type": self.reward_type,
            "xp_spent": self.xp_spent,
            "date": self.redeemed_at.isoformat(),
            "status": self.status
        }

class Badge(db.Model):
    """Badge definitions for XP milestones"""
    __tablename__ = 'badges'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(255), nullable=False)
    xp_threshold = db.Column(db.Integer, nullable=False, unique=True)
    
    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "description": self.description,
            "image_url": self.image_url, "xp_threshold": self.xp_threshold
        }

class UserBadge(db.Model):
    """User-earned badges"""
    __tablename__ = 'user_badges'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='user_badges_association')
    badge = db.relationship('Badge')

    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='uq_user_badge'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'badge_id': self.badge_id,
            'badge_name': self.badge.name if self.badge else None,
            'badge_image_url': self.badge.image_url if self.badge else None,
            'earned_at': self.earned_at.isoformat() if self.earned_at else None
        }

# --- END OF FILE models.py --- (Marker from input, models continue below)

# NEW: LinkedAccount Model
class LinkedAccount(db.Model):
    __tablename__ = 'linked_accounts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', name='fk_linked_account_user_id'), nullable=False)
    provider = db.Column(db.String(50), nullable=False)  # e.g., 'discord', 'twitter', 'google', 'meta'
    provider_user_id = db.Column(db.String(255), nullable=False) # Unique ID from the provider
    email = db.Column(db.String(255), nullable=True) # Email from provider, if available
    name = db.Column(db.String(255), nullable=True) # Name/username from provider
    access_token = db.Column(db.Text, nullable=True) # Encrypted
    refresh_token = db.Column(db.Text, nullable=True) # Encrypted
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to User --- MODIFIED ---
    user = db.relationship(
        'User',
        back_populates='linked_accounts'  # Corresponds to the 'linked_accounts' attribute on User
    )

    __table_args__ = (
        db.UniqueConstraint('provider', 'provider_user_id', name='uq_linked_account_provider_user'),
        db.Index('idx_linked_account_user_provider', 'user_id', 'provider', unique=True) # A user can only have one account per provider
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'provider': self.provider,
            'provider_user_id': self.provider_user_id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Enum for Business Permissions
class BusinessPermissionKey(Enum):
    CREATE_SURVEY = "CREATE_SURVEY"
    EDIT_SURVEY = "EDIT_SURVEY"
    DELETE_SURVEY = "DELETE_SURVEY"
    VIEW_SURVEY_ANALYTICS = "VIEW_SURVEY_ANALYTICS"
    CREATE_QUEST = "CREATE_QUEST"
    EDIT_QUEST = "EDIT_QUEST"
    DELETE_QUEST = "DELETE_QUEST"
    CREATE_BUG_REPORT = "CREATE_BUG_REPORT"
    EDIT_BUG_REPORT = "EDIT_BUG_REPORT"
    CHANGE_BUG_STATUS = "CHANGE_BUG_STATUS"
    CREATE_FEATURE_REQUEST = "CREATE_FEATURE_REQUEST"
    EDIT_FEATURE_REQUEST = "EDIT_FEATURE_REQUEST"
    CHANGE_FEATURE_STATUS = "CHANGE_FEATURE_STATUS"
    VIEW_SPLASH = "VIEW_SPLASH"
    EDIT_SPLASH_PAGE = "EDIT_SPLASH_PAGE"
    CREATE_BUSINESS_ADMIN = "CREATE_BUSINESS_ADMIN"
    APPROVE_BUSINESS = "APPROVE_BUSINESS"
    REJECT_BUSINESS = "REJECT_BUSINESS"
    MANAGE_OWN_ADMINS = "MANAGE_OWN_ADMINS"
    # Co-Create / Ideas permissions
    CREATE_IDEA = "CREATE_IDEA"
    REVIEW_IDEAS = "REVIEW_IDEAS"
    MODERATE_IDEAS = "MODERATE_IDEAS"
    ARCHIVE_IDEAS = "ARCHIVE_IDEAS"
    VIEW_CO_CREATE = "VIEW_CO_CREATE"

# --- START: New Token Models ---

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(128), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

    # user = db.relationship('User', backref=db.backref('password_reset_tokens', lazy='dynamic', cascade="all, delete-orphan"))

    def __repr__(self):
        return f'<PasswordResetToken {self.token}>'

    @staticmethod
    def generate(user_id, expires_in_seconds=3600):
        import secrets
        token_value = secrets.token_urlsafe(32)
        new_token = PasswordResetToken(
            user_id=user_id,
            token=token_value,
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in_seconds)
        )
        db.session.add(new_token)
        # db.session.commit() # Commit should be handled by the calling function
        return new_token
    
    def is_valid(self):
        return not self.is_used and self.expires_at > datetime.utcnow()

class EmailVerificationToken(db.Model):
    __tablename__ = 'email_verification_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(128), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

    # user = db.relationship('User', backref=db.backref('email_verification_tokens', lazy='dynamic', cascade="all, delete-orphan"))

    def __repr__(self):
        return f'<EmailVerificationToken {self.token}>'

    @staticmethod
    def generate(user_id, expires_in_seconds=86400): # 24 hours
        import secrets
        token_value = secrets.token_urlsafe(32)
        new_token = EmailVerificationToken(
            user_id=user_id,
            token=token_value,
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in_seconds)
        )
        db.session.add(new_token)
        return new_token

    def is_valid(self):
        return not self.is_used and self.expires_at > datetime.utcnow()

class TempAuthToken(db.Model):
    __tablename__ = 'temp_auth_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(128), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    purpose = db.Column(db.String(100), nullable=True) # e.g., "REGISTRATION_MULTI_STEP"

    # user = db.relationship('User', backref=db.backref('temp_auth_tokens', lazy='dynamic', cascade="all, delete-orphan"))

    def __repr__(self):
        return f'<TempAuthToken {self.token} for user {self.user_id}>'

    @staticmethod
    def generate(user_id, purpose="GENERAL", expires_in_seconds=7200): # 2 hours
        import secrets
        token_value = secrets.token_urlsafe(32)
        new_token = TempAuthToken(
            user_id=user_id,
            token=token_value,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in_seconds)
        )
        db.session.add(new_token)
        return new_token

    def is_valid(self):
        return not self.is_used and self.expires_at > datetime.utcnow()

class AIPointsUsageLog(db.Model):
    """Log AI points usage for businesses"""
    __tablename__ = 'ai_points_usage_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # The admin who triggered the action
    action = db.Column(db.String(100), nullable=False) # e.g., 'CREATE_SURVEY_MEDIUM', 'GENERATE_15_RESPONSES'
    points_deducted = db.Column(db.Integer, nullable=False)
    
    # NEW: Track which type of points were used/added
    monthly_points_used = db.Column(db.Integer, default=0, nullable=False)  # Points used from monthly quota
    purchased_points_used = db.Column(db.Integer, default=0, nullable=False)  # Points used from purchased balance
    
    # NEW: Track balances after transaction for both types
    monthly_points_before = db.Column(db.Integer, default=0, nullable=False)
    monthly_points_after = db.Column(db.Integer, default=0, nullable=False)
    purchased_points_before = db.Column(db.Integer, default=0, nullable=False)
    purchased_points_after = db.Column(db.Integer, default=0, nullable=False)
    
    # Legacy fields for backward compatibility
    points_before = db.Column(db.Integer, nullable=False)
    points_after = db.Column(db.Integer, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    business = db.relationship('Business', backref='ai_points_usage_logs')
    user = db.relationship('User', backref='triggered_ai_actions')

    def to_dict(self):
        return {
            'id': self.id,
            'business_id': self.business_id,
            'user_id': self.user_id,
            'action': self.action,
            'points_deducted': self.points_deducted,
            'monthly_points_used': self.monthly_points_used,
            'purchased_points_used': self.purchased_points_used,
            'monthly_points_before': self.monthly_points_before,
            'monthly_points_after': self.monthly_points_after,
            'purchased_points_before': self.purchased_points_before,
            'purchased_points_after': self.purchased_points_after,
            'points_before': self.points_before,
            'points_after': self.points_after,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_name': self.user.name if self.user else None,
            'business_name': self.business.name if self.business else None
        }

class StripeTransaction(db.Model):
    """Log Stripe payment transactions for AI points and response quota purchases"""
    __tablename__ = 'stripe_transactions'

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Who made the purchase
    stripe_charge_id = db.Column(db.String(255), nullable=False, unique=True)
    amount_paid = db.Column(db.Integer, nullable=False) # In cents
    points_purchased = db.Column(db.Integer, nullable=False, default=0)
    # NEW: responses purchased via pay-as-you-go
    responses_purchased = db.Column(db.Integer, nullable=False, default=0)
    # NEW: quest credits purchased via packages
    quest_credits_purchased = db.Column(db.Integer, nullable=False, default=0)
    # NEW: admin seats purchased via packages
    admin_seats_purchased = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(50), nullable=False) # 'succeeded', 'failed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    business = db.relationship('Business', backref='stripe_transactions')
    user = db.relationship('User', backref='stripe_purchases')

    def to_dict(self):
        return {
            'id': self.id,
            'business_id': self.business_id,
            'user_id': self.user_id,
            'stripe_charge_id': self.stripe_charge_id,
            'amount_paid': self.amount_paid,
            'points_purchased': self.points_purchased,
            'responses_purchased': self.responses_purchased,
            'quest_credits_purchased': self.quest_credits_purchased,
            'admin_seats_purchased': self.admin_seats_purchased,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_name': self.user.name if self.user else None,
            'business_name': self.business.name if self.business else None
        }

class DiscordServerMembership(db.Model):
    """Cache Discord server membership and role information for performance optimization"""
    __tablename__ = 'discord_server_memberships'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    discord_server_id = db.Column(db.String(255), nullable=False)  # Discord server ID
    is_member = db.Column(db.Boolean, nullable=False, default=False)  # Whether user is a member
    user_roles = db.Column(db.JSON, nullable=True)  # Array of role IDs the user has
    last_checked = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)  # When this was last verified
    expires_at = db.Column(db.DateTime, nullable=False)  # When this cache expires (24 hours default)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('discord_memberships', lazy='dynamic', cascade="all, delete-orphan"))

    # Unique constraint to prevent duplicate entries
    __table_args__ = (
        db.UniqueConstraint('user_id', 'discord_server_id', name='uq_user_discord_server'),
        db.Index('idx_discord_membership_expiry', 'expires_at'),
    )

    def __repr__(self):
        return f'<DiscordServerMembership user_id={self.user_id} server_id={self.discord_server_id} is_member={self.is_member}>'

    @staticmethod
    def create_or_update(user_id, discord_server_id, is_member, user_roles=None, cache_hours=24):
        """Create or update Discord server membership cache"""
        from datetime import timedelta
        
        # Find existing record
        existing = DiscordServerMembership.query.filter_by(
            user_id=user_id,
            discord_server_id=discord_server_id
        ).first()
        
        if existing:
            # Update existing record
            existing.is_member = is_member
            existing.user_roles = user_roles or []
            existing.last_checked = datetime.utcnow()
            existing.expires_at = datetime.utcnow() + timedelta(hours=cache_hours)
            return existing
        else:
            # Create new record
            new_membership = DiscordServerMembership(
                user_id=user_id,
                discord_server_id=discord_server_id,
                is_member=is_member,
                user_roles=user_roles or [],
                last_checked=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(hours=cache_hours)
            )
            db.session.add(new_membership)
            return new_membership

    def is_expired(self):
        """Check if this cache entry has expired"""
        return datetime.utcnow() > self.expires_at

    def has_role(self, role_id):
        """Check if user has a specific role in this server"""
        if not self.is_member or not self.user_roles:
            return False
        return str(role_id) in [str(role) for role in self.user_roles]

    def has_any_role(self, role_ids):
        """Check if user has any of the specified roles"""
        if not self.is_member or not self.user_roles:
            return False
        user_role_strings = [str(role) for role in self.user_roles]
        required_role_strings = [str(role) for role in role_ids]
        return any(role in user_role_strings for role in required_role_strings)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'discord_server_id': self.discord_server_id,
            'is_member': self.is_member,
            'user_roles': self.user_roles,
            'last_checked': self.last_checked.isoformat() if self.last_checked else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_expired': self.is_expired()
        }

class OneTimePIN(db.Model):
    __tablename__ = 'one_time_pins'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    pin = db.Column(db.String(6), nullable=False, index=True)  # store as string, always 6 digits
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

    # relationship back to User (optional, but convenient)
    user = db.relationship('User', backref=db.backref('one_time_pins', lazy='dynamic', cascade="all, delete-orphan"))

    def __repr__(self):
        return f'<OneTimePIN user={self.user_id} pin={self.pin} expires={self.expires_at}>'

    @staticmethod
    def generate(user_id, validity_seconds=300):
        """
        Create (but do not commit) a new OneTimePIN row for this user,
        with a random 6-digit PIN and expiry in `validity_seconds` (default 5 minutes).
        """
        import random
        from datetime import datetime, timedelta
        # Generate a random 6-digit string (leading zeros allowed).
        pin_value = f"{random.randint(0, 999999):06d}"
        now = datetime.utcnow()
        otp = OneTimePIN(
            user_id=user_id,
            pin=pin_value,
            created_at=now,
            expires_at=now + timedelta(seconds=validity_seconds),
            is_used=False
        )
        db.session.add(otp)
        return otp

    def is_valid(self):
        """
        Returns True if this PIN has not been used AND not expired.
        """
        return (not self.is_used) and (self.expires_at > datetime.utcnow())

# NEW: User Daily Activity Tracking Models

class UserDailyActivity(db.Model):
    """Track user daily activities for Eclipseer quests with 24-hour rolling window"""
    __tablename__ = 'user_daily_activities'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    activity_type = db.Column(db.String(50), nullable=False)  # 'SURVEY_COMPLETED', 'QUEST_COMPLETED', 'BRAND_PAGE_VISITED', 'TAG_SELECTED'
    activity_date = db.Column(db.Date, nullable=False)  # Date of activity
    activity_timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)  # Precise timestamp for 24-hour window
    count = db.Column(db.Integer, default=1, nullable=False)  # Count of activities on this date
    
    # Optional reference to specific items
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=True)
    quest_id = db.Column(db.Integer, db.ForeignKey('quests.id'), nullable=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=True)  # For brand page visits
    
    # Relationships
    user = db.relationship('User', backref=db.backref('daily_activities', lazy='dynamic', cascade="all, delete-orphan"))
    survey = db.relationship('Survey', backref='daily_activity_logs')
    quest = db.relationship('Quest', backref='daily_activity_logs')
    business = db.relationship('Business', backref='daily_activity_logs')
    
    # Unique constraint to prevent duplicate daily entries
    __table_args__ = (
        db.UniqueConstraint('user_id', 'activity_type', 'activity_date', 'survey_id', 'quest_id', 'business_id', 
                          name='uq_user_daily_activity'),
        db.Index('idx_user_activity_timestamp', 'user_id', 'activity_type', 'activity_timestamp')
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'activity_type': self.activity_type,
            'activity_date': self.activity_date.isoformat() if self.activity_date else None,
            'activity_timestamp': self.activity_timestamp.isoformat() if self.activity_timestamp else None,
            'count': self.count,
            'survey_id': self.survey_id,
            'quest_id': self.quest_id,
            'business_id': self.business_id
        }
    
    @staticmethod
    def get_rolling_24h_count(user_id, activity_type, reference_time=None):
        """Get count of activities in the last 24 hours from reference_time"""
        if reference_time is None:
            reference_time = datetime.utcnow()
        
        cutoff_time = reference_time - timedelta(hours=24)
        
        return UserDailyActivity.query.filter(
            UserDailyActivity.user_id == user_id,
            UserDailyActivity.activity_type == activity_type,
            UserDailyActivity.activity_timestamp >= cutoff_time,
            UserDailyActivity.activity_timestamp <= reference_time
        ).with_entities(db.func.sum(UserDailyActivity.count)).scalar() or 0
    
    @staticmethod
    def record_activity(user_id, activity_type, survey_id=None, quest_id=None, business_id=None):
        """Record a new activity or increment existing daily count"""
        from sqlalchemy import func
        
        now = datetime.utcnow()
        today = now.date()
        
        # Try to find existing activity for today
        existing = UserDailyActivity.query.filter(
            UserDailyActivity.user_id == user_id,
            UserDailyActivity.activity_type == activity_type,
            UserDailyActivity.activity_date == today,
            UserDailyActivity.survey_id == survey_id,
            UserDailyActivity.quest_id == quest_id,
            UserDailyActivity.business_id == business_id
        ).first()
        
        if existing:
            # Update existing record
            existing.count += 1
            existing.activity_timestamp = now  # Update to latest timestamp
        else:
            # Create new record
            new_activity = UserDailyActivity(
                user_id=user_id,
                activity_type=activity_type,
                activity_date=today,
                activity_timestamp=now,
                count=1,
                survey_id=survey_id,
                quest_id=quest_id,
                business_id=business_id
            )
            db.session.add(new_activity)
        
        return existing or new_activity

class UserQuestProgress(db.Model):
    """Track user progress on multi-step Eclipseer quests"""
    __tablename__ = 'user_quest_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    quest_id = db.Column(db.Integer, db.ForeignKey('quests.id', ondelete='CASCADE'), nullable=False)
    current_progress = db.Column(db.Integer, default=0, nullable=False)  # Current count
    target_count = db.Column(db.Integer, nullable=False)  # Target count to complete
    progress_type = db.Column(db.String(50), nullable=False)  # 'DAILY' or 'TOTAL'
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('quest_progress', lazy='dynamic', cascade="all, delete-orphan"))
    quest = db.relationship('Quest', backref='user_progress')
    
    # Unique constraint - one progress record per user per quest
    __table_args__ = (db.UniqueConstraint('user_id', 'quest_id', name='uq_user_quest_progress'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'quest_id': self.quest_id,
            'current_progress': self.current_progress,
            'target_count': self.target_count,
            'progress_type': self.progress_type,
            'completion_percentage': (self.current_progress / self.target_count * 100) if self.target_count > 0 else 0,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def update_progress(self, new_count):
        """Update progress and timestamp"""
        self.current_progress = new_count
        self.last_updated = datetime.utcnow()
        
    def is_completed(self):
        """Check if quest is completed"""
        return self.current_progress >= self.target_count

# --- END: New Token Models ---

# Add this new model at the end of your models.py file, before any Enums or helper classes.

class DiscordServerRoleCache(db.Model):
    """Caches the list of roles for a business's Discord server."""
    __tablename__ = 'discord_server_role_cache'

    id = db.Column(db.Integer, primary_key=True)
    # Use a One-to-One relationship with Business
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False, unique=True)
    roles_data = db.Column(db.JSON, nullable=True) # Stores the list of role objects [{id, name, color, position}]
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to Business
    business = db.relationship('Business', backref=db.backref('discord_role_cache', uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "business_id": self.business_id,
            "roles": self.roles_data or [],
            "last_updated": self.last_updated.isoformat() if self.last_updated else None
        }

# Add after the AIPointsPackage class (around line 147)

class QuestPackage(db.Model):
    """Super admin managed quest points pricing packages"""
    __tablename__ = 'quest_packages'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., 'Quest Starter', 'Quest Pro'
    description = db.Column(db.Text, nullable=True)
    quest_credits = db.Column(db.Integer, nullable=False)  # Number of quest creation credits
    price = db.Column(db.Integer, nullable=False)  # Price in cents
    
    # Optional features
    bonus_credits = db.Column(db.Integer, nullable=False, default=0)  # Bonus credits (e.g., buy 10 get 2 free)
    is_popular = db.Column(db.Boolean, default=False, nullable=False)  # Mark as popular package
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)  # For ordering packages
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_total_credits(self):
        """Get total credits including bonus"""
        return self.quest_credits + self.bonus_credits
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "quest_credits": self.quest_credits,
            "bonus_credits": self.bonus_credits,
            "total_credits": self.get_total_credits(),
            "price": self.price,
            "is_popular": self.is_popular,
            "is_active": self.is_active,
            "display_order": self.display_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class AdminSeatPackage(db.Model):
    """Super admin managed admin seat pricing packages"""
    __tablename__ = 'admin_seat_packages'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., 'Additional Seat', 'Team Pack'
    description = db.Column(db.Text, nullable=True)
    seat_count = db.Column(db.Integer, nullable=False)  # Number of admin seats
    price = db.Column(db.Integer, nullable=False)  # Price in cents
    
    # Optional features
    bonus_seats = db.Column(db.Integer, nullable=False, default=0)  # Bonus seats (e.g., buy 5 get 1 free)
    is_popular = db.Column(db.Boolean, default=False, nullable=False)  # Mark as popular package
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)  # For ordering packages
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_total_seats(self):
        """Get total seats including bonus"""
        return self.seat_count + self.bonus_seats
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "seat_count": self.seat_count,
            "bonus_seats": self.bonus_seats,
            "total_seats": self.get_total_seats(),
            "price": self.price,
            "is_popular": self.is_popular,
            "is_active": self.is_active,
            "display_order": self.display_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# NEW: Notification System Models

class NotificationType(Enum):
    """Types of notifications that can be sent to users"""
    RAFFLE_WINNER = "RAFFLE_WINNER"
    ORDER_SHIPPED = "ORDER_SHIPPED" 
    ORDER_DELIVERED = "ORDER_DELIVERED"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    GENERAL_ANNOUNCEMENT = "GENERAL_ANNOUNCEMENT"
    CUSTOM_MESSAGE = "CUSTOM_MESSAGE"

class NotificationStatus(Enum):
    """Status of notifications"""
    UNREAD = "UNREAD"
    READ = "READ" 
    DISMISSED = "DISMISSED"

class Notification(db.Model):
    """User notifications for marketplace and system events"""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    notification_type = db.Column(db.String(50), nullable=False, default=NotificationType.CUSTOM_MESSAGE.value)
    status = db.Column(db.String(50), nullable=False, default=NotificationStatus.UNREAD.value)
    
    # Optional references to related items  
    marketplace_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=True)
    purchase_id = db.Column(db.Integer, nullable=True)  # Will add FK after Purchase model is created
    
    # Admin who sent the notification (for custom messages)
    sent_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='notifications')
    marketplace_item = db.relationship('MarketplaceItem', backref='notifications')
    sent_by = db.relationship('Admin', backref='sent_notifications')
    # purchase relationship will be added manually in queries since FK is not enforced
    
    def mark_as_read(self):
        """Mark notification as read"""
        if self.status == NotificationStatus.UNREAD.value:
            self.status = NotificationStatus.READ.value
            self.read_at = datetime.utcnow()
            db.session.commit()
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "notification_type": self.notification_type,
            "status": self.status,
            "marketplace_item_id": self.marketplace_item_id,
            "purchase_id": self.purchase_id,
            "sent_by_admin_id": self.sent_by_admin_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None
        }

# NEW: Purchase and Delivery System Models

class PurchaseStatus(Enum):
    """Status of marketplace purchases"""
    PENDING_DELIVERY_INFO = "PENDING_DELIVERY_INFO"
    PENDING_FULFILLMENT = "PENDING_FULFILLMENT"
    PROCESSING = "PROCESSING" 
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"

class PaymentMethod(Enum):
    """Payment methods for marketplace purchases"""
    WALLET = "WALLET"  # XP wallet payment
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"

class Purchase(db.Model):
    """Track marketplace purchases and delivery"""
    __tablename__ = 'purchases'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    marketplace_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=False)
    user_reward_log_id = db.Column(db.Integer, db.ForeignKey('user_reward_logs.id'), nullable=True)  # Link to XP transaction
    
    # Purchase details
    purchase_type = db.Column(db.String(50), nullable=False)  # 'DIRECT' or 'RAFFLE_WIN'
    xp_spent = db.Column(db.Integer, nullable=False, default=0)
    purchase_status = db.Column(db.String(50), nullable=False, default=PurchaseStatus.PENDING_DELIVERY_INFO.value)
    
    # Raffle specific fields
    is_raffle_win = db.Column(db.Boolean, default=False, nullable=False)
    raffle_selected_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='purchases')
    marketplace_item = db.relationship('MarketplaceItem', backref='purchases')
    user_reward_log = db.relationship('UserRewardLog', backref='purchase')
    delivery_info = db.relationship('DeliveryInfo', backref='purchase', uselist=False, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "marketplace_item_id": self.marketplace_item_id,
            "user_reward_log_id": self.user_reward_log_id,
            "purchase_type": self.purchase_type,
            "xp_spent": self.xp_spent,
            "purchase_status": self.purchase_status,
            "is_raffle_win": self.is_raffle_win,
            "raffle_selected_at": self.raffle_selected_at.isoformat() if self.raffle_selected_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "item_title": self.marketplace_item.title if self.marketplace_item else None,
            "has_delivery_info": self.delivery_info is not None
        }

class DeliveryInfo(db.Model):
    """Delivery information for marketplace purchases"""
    __tablename__ = 'delivery_info'
    
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Personal information
    full_name = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    
    # Delivery address
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state_province = db.Column(db.String(100), nullable=False)
    postal_code = db.Column(db.String(20), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    
    # Billing address (optional - if different from delivery)
    billing_same_as_delivery = db.Column(db.Boolean, default=True, nullable=False)
    billing_address = db.Column(db.Text, nullable=True)
    billing_city = db.Column(db.String(100), nullable=True)
    billing_state_province = db.Column(db.String(100), nullable=True)
    billing_postal_code = db.Column(db.String(20), nullable=True)
    billing_country = db.Column(db.String(100), nullable=True)
    
    # Payment and delivery preferences
    payment_method = db.Column(db.String(50), nullable=False, default=PaymentMethod.WALLET.value)
    delivery_notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "purchase_id": self.purchase_id,
            "full_name": self.full_name,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "city": self.city,
            "state_province": self.state_province,
            "postal_code": self.postal_code,
            "country": self.country,
            "billing_same_as_delivery": self.billing_same_as_delivery,
            "billing_address": self.billing_address,
            "billing_city": self.billing_city,
            "billing_state_province": self.billing_state_province,
            "billing_postal_code": self.billing_postal_code,
            "billing_country": self.billing_country,
            "payment_method": self.payment_method,
            "delivery_notes": self.delivery_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class RaffleEntry(db.Model):
    """Track raffle entries for marketplace items"""
    __tablename__ = 'raffle_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    marketplace_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id', ondelete='CASCADE'), nullable=False)
    user_reward_log_id = db.Column(db.Integer, db.ForeignKey('user_reward_logs.id'), nullable=True)  # Link to XP transaction
    
    # Entry tracking
    entry_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_winner = db.Column(db.Boolean, default=False, nullable=False)
    selected_at = db.Column(db.DateTime, nullable=True)
    selected_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='raffle_entries')
    marketplace_item = db.relationship('MarketplaceItem', backref='raffle_entries')
    user_reward_log = db.relationship('UserRewardLog', backref='raffle_entry')
    selected_by = db.relationship('Admin', backref='selected_raffle_winners')
    
    # Unique constraint - prevent duplicate entries (although allowed by business logic, this is for data integrity)
    __table_args__ = (db.Index('idx_raffle_entry_user_item', 'user_id', 'marketplace_item_id'),)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "marketplace_item_id": self.marketplace_item_id,
            "user_reward_log_id": self.user_reward_log_id,
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "is_winner": self.is_winner,
            "selected_at": self.selected_at.isoformat() if self.selected_at else None,
            "selected_by_admin_id": self.selected_by_admin_id,
            "user_name": self.user.name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "item_title": self.marketplace_item.title if self.marketplace_item else None
        }
