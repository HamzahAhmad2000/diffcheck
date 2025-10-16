"""
Season Pass API Routes
Handles all Season Pass related endpoints for users and admins
"""

from flask import Blueprint, request, jsonify, g, current_app
from ..controllers.season_pass_controller import SeasonPassController, SeasonPassAdminController
from ..controllers.season_pass_payment_controller import SeasonPassPaymentController
from ..controllers.auth_controller import token_required, admin_required, business_admin_required
from ..models import db
import logging

# Create blueprints
season_pass_bp = Blueprint('season_pass', __name__, url_prefix='/api/season-pass')
admin_season_pass_bp = Blueprint('admin_season_pass', __name__, url_prefix='/api/admin/season-pass')

logger = logging.getLogger(__name__)

# ============================================================================
# USER ENDPOINTS
# ============================================================================

@season_pass_bp.route('/state', methods=['GET'])
@token_required
def get_season_state():
    """
    Get complete season pass state for the current user
    
    Returns:
    - Season information
    - User progress
    - User pass (if purchased)
    - All levels and rewards with claim status
    - Countdown timer if applicable
    """
    try:
        current_user = g.current_user
        state = SeasonPassController.get_user_season_state(current_user.id)
        
        if "error" in state:
            return jsonify({"error": state["error"]}), 404
        
        return jsonify({
            "success": True,
            "data": state
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting season state: {str(e)}")
        return jsonify({"error": "Failed to retrieve season state"}), 500

@season_pass_bp.route('/redeem-marketplace-item', methods=['POST'])
@token_required
def redeem_marketplace_item():
    """
    Redeem a marketplace item received as a season pass reward

    Expected JSON body:
    {
        "marketplace_item_id": 123
    }
    """
    try:
        current_user = g.current_user
        data = request.get_json()

        if not data or 'marketplace_item_id' not in data:
            return jsonify({"error": "Missing marketplace_item_id"}), 400

        marketplace_item_id = data['marketplace_item_id']

        # Check if user has this item from season pass rewards
        from ..models import UserRewardLog, RewardStatus, MarketplaceItem

        reward_log = UserRewardLog.query.filter_by(
            user_id=current_user.id,
            marketplace_item_id=marketplace_item_id,
            reward_type='SEASON_PASS_ITEM',
            status=RewardStatus.DELIVERED.value
        ).first()

        if not reward_log:
            return jsonify({"error": "Item not available for redemption"}), 404

        # Check if item has already been redeemed
        if hasattr(reward_log, 'redeemed_at') and reward_log.redeemed_at:
            return jsonify({"error": "Item has already been redeemed"}), 400

        # Get the marketplace item
        item = MarketplaceItem.query.get(marketplace_item_id)
        if not item or not item.is_active:
            return jsonify({"error": "Item not available"}), 404

        # Check stock
        if item.stock is not None and item.stock <= 0:
            return jsonify({"error": "Item is out of stock"}), 400

        # Mark the reward as redeemed
        from datetime import datetime
        reward_log.status = 'REDEEMED'
        reward_log.redeemed_at = datetime.utcnow()
        reward_log.notes += f" - Redeemed on {datetime.utcnow().isoformat()}"

        # Update stock if applicable
        if item.stock is not None:
            item.stock -= 1

        from ..extensions import db
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Successfully redeemed {item.title}!",
            "item": item.to_dict()
        }), 200

    except Exception as e:
        logger.error(f"Error redeeming marketplace item: {str(e)}")
        return jsonify({"error": "Failed to redeem item"}), 500

@season_pass_bp.route('/claim-reward', methods=['POST'])
@token_required
def claim_reward():
    """
    Claim a specific season reward
    
    Expected JSON body:
    {
        "season_reward_id": 123
    }
    """
    try:
        current_user = g.current_user
        data = request.get_json()

        logger.info(
            "[SEASON_PASS] Stripe payment intent request user_id=%s payload=%s",
            getattr(current_user, 'id', None),
            data
        )
        
        if not data or 'season_reward_id' not in data:
            return jsonify({"error": "Missing season_reward_id"}), 400
        
        season_reward_id = data['season_reward_id']
        
        result = SeasonPassController.claim_reward(current_user.id, season_reward_id)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"],
            "data": {
                "reward": result["reward"],
                "reward_result": result["reward_result"]
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error claiming reward: {str(e)}")
        return jsonify({"error": "Failed to claim reward"}), 500

@season_pass_bp.route('/payment/methods', methods=['GET'])
def get_payment_methods():
    """
    Get available payment methods for season pass purchases
    """
    try:
        result = SeasonPassPaymentController.get_payment_methods()
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting payment methods: {str(e)}")
        return jsonify({"error": "Failed to get payment methods"}), 500

@season_pass_bp.route('/payment/stripe/create-intent', methods=['POST'])
@token_required
def create_stripe_payment_intent():
    """
    Create a Stripe Payment Intent for season pass purchase
    
    Expected JSON body:
    {
        "tier_type": "LUNAR" or "TOTALITY"
    }
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if not data or 'tier_type' not in data:
            return jsonify({"error": "Missing tier_type"}), 400
        
        tier_type = data['tier_type']
        
        # Validate tier type
        if tier_type not in ['LUNAR', 'TOTALITY']:
            return jsonify({"error": "Invalid tier_type. Must be 'LUNAR' or 'TOTALITY'"}), 400
        
        result = SeasonPassPaymentController.create_payment_intent(current_user.id, tier_type)
        
        if "error" in result:
            logger.warning(
                "[SEASON_PASS] Failed to create Stripe payment intent for user_id=%s tier=%s error=%s",
                getattr(current_user, 'id', None),
                tier_type,
                result.get("error")
            )
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        return jsonify({"error": "Failed to create payment intent"}), 500

@season_pass_bp.route('/payment/stripe/confirm', methods=['POST'])
@token_required
def confirm_stripe_payment():
    """
    Confirm a Stripe payment and create the season pass
    
    Expected JSON body:
    {
        "payment_intent_id": "pi_1234567890"
    }
    """
    try:
        data = request.get_json()
        current_user = g.current_user

        logger.info(
            "[SEASON_PASS] Stripe payment confirmation request user_id=%s payload=%s",
            getattr(current_user, 'id', None),
            data
        )
        
        if not data or 'payment_intent_id' not in data:
            return jsonify({"error": "Missing payment_intent_id"}), 400
        
        payment_intent_id = data['payment_intent_id']
        
        result = SeasonPassPaymentController.confirm_stripe_payment(payment_intent_id)
        
        if "error" in result:
            logger.warning(
                "[SEASON_PASS] Stripe payment confirmation failed payment_intent_id=%s error=%s",
                payment_intent_id,
                result.get("error")
            )
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"],
            "data": {
                "pass": result["pass"],
                "payment_info": result["payment_info"]
            }
        }), 200
        
    except Exception as e:
        logger.exception("[SEASON_PASS] Unexpected error confirming Stripe payment")
        return jsonify({"error": "Failed to confirm payment"}), 500

@season_pass_bp.route('/payment/crypto/create-session', methods=['POST'])
@token_required
def create_crypto_payment_session():
    """
    Create a crypto payment session for season pass purchase
    
    Expected JSON body:
    {
        "tier_type": "LUNAR" or "TOTALITY"
    }
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if not data or 'tier_type' not in data:
            return jsonify({"error": "Missing tier_type"}), 400
        
        tier_type = data['tier_type']
        
        # Validate tier type
        if tier_type not in ['LUNAR', 'TOTALITY']:
            return jsonify({"error": "Invalid tier_type. Must be 'LUNAR' or 'TOTALITY'"}), 400
        
        result = SeasonPassPaymentController.create_crypto_payment_session(current_user.id, tier_type)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error creating crypto payment session: {str(e)}")
        return jsonify({"error": "Failed to create crypto payment session"}), 500

@season_pass_bp.route('/purchase', methods=['POST'])
@token_required
def purchase_season_pass():
    """
    Direct purchase a season pass (for testing or manual payment processing)
    
    Expected JSON body:
    {
        "tier_type": "LUNAR" or "TOTALITY",
        "payment_method": "STRIPE", // Optional
        "payment_reference": "stripe_charge_id" // Optional
    }
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if not data or 'tier_type' not in data:
            return jsonify({"error": "Missing tier_type"}), 400
        
        tier_type = data['tier_type']
        payment_method = data.get('payment_method')
        payment_reference = data.get('payment_reference')
        
        # Validate tier type
        if tier_type not in ['LUNAR', 'TOTALITY']:
            return jsonify({"error": "Invalid tier_type. Must be 'LUNAR' or 'TOTALITY'"}), 400
        
        result = SeasonPassController.purchase_season_pass(
            user_id=current_user.id,
            tier_type=tier_type,
            payment_method=payment_method,
            payment_reference=payment_reference
        )
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"],
            "data": result["pass"]
        }), 201
        
    except Exception as e:
        logger.error(f"Error purchasing season pass: {str(e)}")
        return jsonify({"error": "Failed to purchase season pass"}), 500

@season_pass_bp.route('/preview', methods=['GET'])
def get_season_preview():
    """
    Get season preview information (no authentication required)
    Shows basic season info and pass pricing for marketing purposes
    """
    try:
        active_season = SeasonPassController.get_active_season()
        if not active_season:
            return jsonify({"error": "No active season found"}), 404
        
        # Return limited public information
        preview_data = {
            "season_info": {
                "id": active_season.id,
                "name": active_season.name,
                "description": active_season.description,
                "end_date": active_season.end_date.isoformat() if active_season.end_date else None,
                "countdown": active_season.get_countdown_time(),
                "banner_image_url": active_season.banner_image_url,
                "thumbnail_image_url": active_season.thumbnail_image_url,
                "lunar_pass_price": active_season.lunar_pass_price,
                "totality_pass_price": active_season.totality_pass_price,
                "lunar_xp_multiplier": active_season.lunar_xp_multiplier,
                "totality_xp_multiplier": active_season.totality_xp_multiplier
            }
        }
        
        return jsonify({
            "success": True,
            "data": preview_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting season preview: {str(e)}")
        return jsonify({"error": "Failed to retrieve season preview"}), 500

@season_pass_bp.route('/leaderboard', methods=['GET'])
@token_required
def get_season_leaderboard():
    """
    Get season pass leaderboard
    Query parameters:
    - limit: Number of users to return (default: 50, max: 100)
    - offset: Offset for pagination (default: 0)
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        
        active_season = SeasonPassController.get_active_season()
        if not active_season:
            return jsonify({"error": "No active season found"}), 404
        
        # Get top users by XP in current season
        from ..models.season_pass_models import UserSeasonProgress
        from ..models import User
        
        leaderboard_query = db.session.query(
            UserSeasonProgress, User
        ).join(
            User, UserSeasonProgress.user_id == User.id
        ).filter(
            UserSeasonProgress.season_id == active_season.id
        ).order_by(
            UserSeasonProgress.current_xp_in_season.desc()
        ).limit(limit).offset(offset)
        
        leaderboard_data = []
        for progress, user in leaderboard_query:
            leaderboard_data.append({
                "rank": offset + len(leaderboard_data) + 1,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "profile_picture_url": getattr(user, 'profile_picture_url', None)
                },
                "progress": {
                    "current_level": progress.current_level,
                    "current_xp": progress.current_xp_in_season,
                    "xp_to_next_level": progress.get_xp_to_next_level()
                }
            })
        
        return jsonify({
            "success": True,
            "data": {
                "leaderboard": leaderboard_data,
                "season": {
                    "id": active_season.id,
                    "name": active_season.name
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting season leaderboard: {str(e)}")
        return jsonify({"error": "Failed to retrieve season leaderboard"}), 500

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@admin_season_pass_bp.route('/seasons', methods=['GET'])
@token_required
@admin_required
def list_seasons():
    """
    List all seasons with pagination
    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        from ..models.season_pass_models import Season
        
        seasons = Season.query.order_by(Season.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            "success": True,
            "data": {
                "seasons": [season.to_dict() for season in seasons.items],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": seasons.total,
                    "total_pages": seasons.pages,
                    "has_next": seasons.has_next,
                    "has_prev": seasons.has_prev
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing seasons: {str(e)}")
        return jsonify({"error": "Failed to list seasons"}), 500

@admin_season_pass_bp.route('/seasons', methods=['POST'])
@token_required
@admin_required
def create_season():
    """
    Create a new season
    
    Expected JSON body:
    {
        "name": "Season 1: Lunar & Totality",
        "description": "The first season of Eclipseer",
        "start_date": "2024-03-01T00:00:00Z", // Optional
        "end_date": "2024-05-31T23:59:59Z", // Optional
        "lunar_pass_price": 1999, // In cents
        "totality_pass_price": 3499, // In cents
        "lunar_xp_multiplier": 1.25,
        "totality_xp_multiplier": 2.0,
        "banner_image_url": "https://...",
        "thumbnail_image_url": "https://...",
        "levels": [ // Optional - default levels will be created if not provided
            {
                "level_number": 1,
                "xp_required_for_level": 250
            }
        ]
    }
    """
    try:
        admin = g.current_admin
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result = SeasonPassAdminController.create_season(admin.id, data)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": "Season created successfully",
            "data": result["season"]
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating season: {str(e)}")
        return jsonify({"error": "Failed to create season"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/activate', methods=['POST'])
@token_required
@admin_required
def activate_season(season_id):
    """
    Activate a specific season (deactivates current active season)
    """
    try:
        result = SeasonPassAdminController.activate_season(season_id)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"]
        }), 200
        
    except Exception as e:
        logger.error(f"Error activating season: {str(e)}")
        return jsonify({"error": "Failed to activate season"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/set-next', methods=['POST'])
@token_required
@admin_required
def set_next_season(season_id):
    """
    Set a season as the next season
    """
    try:
        result = SeasonPassAdminController.set_next_season(season_id)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"]
        }), 200
        
    except Exception as e:
        logger.error(f"Error setting next season: {str(e)}")
        return jsonify({"error": "Failed to set next season"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/xp-requirements', methods=['PUT'])
@token_required
@admin_required
def update_xp_requirements(season_id):
    """
    Update XP requirements for levels in a season
    
    Expected JSON body:
    {
        "level_xp_map": {
            "1": 250,
            "2": 250,
            "3": 300,
            "10": 500
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'level_xp_map' not in data:
            return jsonify({"error": "Missing level_xp_map"}), 400
        
        # Convert string keys to integers
        level_xp_map = {int(k): v for k, v in data['level_xp_map'].items()}
        
        result = SeasonPassAdminController.update_xp_requirements(season_id, level_xp_map)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "message": result["message"]
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating XP requirements: {str(e)}")
        return jsonify({"error": "Failed to update XP requirements"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/analytics', methods=['GET'])
@token_required
@admin_required
def get_season_analytics(season_id):
    """
    Get detailed analytics for a specific season
    """
    try:
        result = SeasonPassAdminController.get_season_analytics(season_id)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 404
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting season analytics: {str(e)}")
        return jsonify({"error": "Failed to get season analytics"}), 500

@admin_season_pass_bp.route('/analytics/subscriptions', methods=['GET'])
@token_required
@admin_required
def get_subscription_analytics():
    """
    Get comprehensive subscription analytics including retention, churn, and growth metrics
    Query parameters:
    - season_id: Optional specific season ID to analyze (if not provided, analyzes all seasons)
    """
    try:
        season_id = request.args.get('season_id', type=int)
        
        result = SeasonPassAdminController.get_subscription_analytics(season_id)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 404
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting subscription analytics: {str(e)}")
        return jsonify({"error": "Failed to get subscription analytics"}), 500

@admin_season_pass_bp.route('/analytics/retention', methods=['GET'])
@token_required
@admin_required
def get_retention_analytics():
    """
    Get detailed retention analysis across all seasons
    """
    try:
        from ..models.season_pass_models import Season
        all_seasons = Season.query.order_by(Season.start_date.desc()).all()
        
        if len(all_seasons) < 2:
            return jsonify({
                "error": "Need at least 2 seasons for retention analysis"
            }), 400
        
        result = SeasonPassAdminController._calculate_retention_metrics(all_seasons)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting retention analytics: {str(e)}")
        return jsonify({"error": "Failed to get retention analytics"}), 500

@admin_season_pass_bp.route('/analytics/churn', methods=['GET'])
@token_required
@admin_required
def get_churn_analytics():
    """
    Get detailed churn analysis across all seasons
    """
    try:
        from ..models.season_pass_models import Season
        all_seasons = Season.query.order_by(Season.start_date.desc()).all()
        
        if len(all_seasons) < 2:
            return jsonify({
                "error": "Need at least 2 seasons for churn analysis"
            }), 400
        
        result = SeasonPassAdminController._calculate_churn_metrics(all_seasons)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting churn analytics: {str(e)}")
        return jsonify({"error": "Failed to get churn analytics"}), 500

@admin_season_pass_bp.route('/analytics/growth', methods=['GET'])
@token_required
@admin_required
def get_growth_analytics():
    """
    Get detailed growth metrics across all seasons
    """
    try:
        from ..models.season_pass_models import Season
        all_seasons = Season.query.order_by(Season.start_date.desc()).all()
        
        if len(all_seasons) < 1:
            return jsonify({
                "error": "Need at least 1 season for growth analysis"
            }), 400
        
        result = SeasonPassAdminController._calculate_growth_metrics(all_seasons)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting growth analytics: {str(e)}")
        return jsonify({"error": "Failed to get growth analytics"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/levels', methods=['POST'])
@token_required
@admin_required
def create_season_level(season_id):
    """
    Create a new level for a season
    
    Expected JSON body:
    {
        "level_number": 16,
        "xp_required_for_level": 300
    }
    """
    try:
        from ..models.season_pass_models import Season, SeasonLevel
        
        data = request.get_json()
        
        if not data or 'level_number' not in data:
            return jsonify({"error": "Missing level_number"}), 400
        
        season = Season.query.get(season_id)
        if not season:
            return jsonify({"error": "Season not found"}), 404
        
        # Check if level already exists
        existing_level = SeasonLevel.query.filter_by(
            season_id=season_id,
            level_number=data['level_number']
        ).first()
        
        if existing_level:
            return jsonify({"error": "Level already exists"}), 400
        
        level = SeasonLevel(
            season_id=season_id,
            level_number=data['level_number'],
            xp_required_for_level=data.get('xp_required_for_level', 250)
        )
        
        from ..extensions import db
        db.session.add(level)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Level created successfully",
            "data": level.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating season level: {str(e)}")
        return jsonify({"error": "Failed to create season level"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/levels/<int:level_id>/rewards', methods=['POST'])
@token_required
@admin_required
def create_season_reward(season_id, level_id):
    """
    Create a reward for a specific level
    
    Expected JSON body:
    {
        "tier_type": "LUNAR" or "TOTALITY",
        "reward_type": "XP", "BADGE", "RAFFLE_ENTRY", "MARKETPLACE_ITEM", or "CUSTOM",
        "xp_amount": 100, // For XP rewards
        "badge_id": 123, // For BADGE rewards
        "marketplace_item_id": 456, // For RAFFLE_ENTRY or MARKETPLACE_ITEM rewards
        "custom_data": {...}, // For CUSTOM rewards
        "display_name": "100 XP Bonus",
        "description": "Bonus XP for reaching this level",
        "image_url": "https://..."
    }
    """
    try:
        from ..models.season_pass_models import SeasonLevel, SeasonReward
        
        data = request.get_json()
        
        if not data or 'tier_type' not in data or 'reward_type' not in data:
            return jsonify({"error": "Missing tier_type or reward_type"}), 400
        
        level = SeasonLevel.query.filter_by(id=level_id, season_id=season_id).first()
        if not level:
            return jsonify({"error": "Level not found"}), 404
        
        # Check if reward already exists for this tier
        existing_reward = SeasonReward.query.filter_by(
            season_level_id=level_id,
            tier_type=data['tier_type']
        ).first()
        
        if existing_reward:
            return jsonify({"error": "Reward already exists for this tier"}), 400
        
        reward = SeasonReward(
            season_level_id=level_id,
            tier_type=data['tier_type'],
            reward_type=data['reward_type'],
            xp_amount=data.get('xp_amount'),
            badge_id=data.get('badge_id'),
            marketplace_item_id=data.get('marketplace_item_id'),
            custom_data=data.get('custom_data'),
            display_name=data.get('display_name'),
            description=data.get('description'),
            image_url=data.get('image_url')
        )
        
        from ..extensions import db
        db.session.add(reward)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Reward created successfully",
            "data": reward.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating season reward: {str(e)}")
        return jsonify({"error": "Failed to create season reward"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/levels/<int:level_id>/rewards/<int:reward_id>', methods=['PUT'])
@token_required
@admin_required
def update_season_reward(season_id, level_id, reward_id):
    """
    Update a reward for a specific level
    """
    try:
        from ..models.season_pass_models import SeasonReward
        
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        reward = SeasonReward.query.filter_by(
            id=reward_id, 
            season_level_id=level_id
        ).first()
        
        if not reward:
            return jsonify({"error": "Reward not found"}), 404
        
        # Update fields if provided
        if 'reward_type' in data:
            reward.reward_type = data['reward_type']
        if 'xp_amount' in data:
            reward.xp_amount = data['xp_amount']
        if 'badge_id' in data:
            reward.badge_id = data['badge_id']
        if 'marketplace_item_id' in data:
            reward.marketplace_item_id = data['marketplace_item_id']
        if 'custom_data' in data:
            reward.custom_data = data['custom_data']
        if 'display_name' in data:
            reward.display_name = data['display_name']
        if 'description' in data:
            reward.description = data['description']
        if 'image_url' in data:
            reward.image_url = data['image_url']
        
        from ..extensions import db
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Reward updated successfully",
            "data": reward.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating season reward: {str(e)}")
        return jsonify({"error": "Failed to update season reward"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/levels/<int:level_id>/rewards/<int:reward_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_season_reward(season_id, level_id, reward_id):
    """
    Delete a reward for a specific level
    """
    try:
        from ..models.season_pass_models import SeasonReward
        
        reward = SeasonReward.query.filter_by(
            id=reward_id, 
            season_level_id=level_id
        ).first()
        
        if not reward:
            return jsonify({"error": "Reward not found"}), 404
        
        from ..extensions import db
        db.session.delete(reward)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Reward deleted successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting season reward: {str(e)}")
        return jsonify({"error": "Failed to delete season reward"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/levels/<int:level_id>/rewards', methods=['GET'])
@token_required
@admin_required
def get_level_rewards(season_id, level_id):
    """
    Get all rewards for a specific level
    """
    try:
        from ..models.season_pass_models import SeasonLevel, SeasonReward
        
        level = SeasonLevel.query.filter_by(id=level_id, season_id=season_id).first()
        if not level:
            return jsonify({"error": "Level not found"}), 404
        
        rewards = SeasonReward.query.filter_by(season_level_id=level_id).all()
        
        return jsonify({
            "success": True,
            "data": {
                "level": level.to_dict(),
                "rewards": [reward.to_dict() for reward in rewards]
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting level rewards: {str(e)}")
        return jsonify({"error": "Failed to get level rewards"}), 500

@admin_season_pass_bp.route('/seasons/<int:season_id>/full-overview', methods=['GET'])
@token_required
@admin_required
def get_season_full_overview(season_id):
    """
    Get complete season overview including all levels and rewards
    """
    try:
        from ..models.season_pass_models import Season, SeasonLevel, SeasonReward
        
        season = Season.query.get(season_id)
        if not season:
            return jsonify({"error": "Season not found"}), 404
        
        levels = SeasonLevel.query.filter_by(season_id=season_id).order_by(SeasonLevel.level_number).all()
        
        levels_data = []
        for level in levels:
            rewards = SeasonReward.query.filter_by(season_level_id=level.id).all()
            level_data = level.to_dict()
            level_data['rewards'] = [reward.to_dict() for reward in rewards]
            levels_data.append(level_data)
        
        return jsonify({
            "success": True,
            "data": {
                "season": season.to_dict(),
                "levels": levels_data
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting season overview: {str(e)}")
        return jsonify({"error": "Failed to get season overview"}), 500

# Error handlers
@season_pass_bp.errorhandler(404)
@admin_season_pass_bp.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@season_pass_bp.errorhandler(500)
@admin_season_pass_bp.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500
