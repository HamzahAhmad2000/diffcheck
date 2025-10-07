import os
import sys

# Add the project's root directory to the Python path
# This allows us to import from 'app' and 'config'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run import app, db  # Import the app and db instance from the main entry point
from app.models import *  # Import all models to ensure they are registered with SQLAlchemy
from datetime import datetime, timedelta
import uuid
# The original 'enum' and 'random' imports are kept as they are used in the setup logic
from enum import Enum
import random

# The models are now imported from app.models, so we don't need to define them here.
# The `setup_database` function can now directly use the imported models (e.g., Admin, User, Business).

def setup_database():
    """Initialize the database with initial users and a sample business."""
    print("Dropping all tables for a clean setup (ensure this is intended)...")
    db.drop_all()
    print("Creating database tables...")
    db.create_all()
    print("Database tables created.")

    # Create Initial Super Admin
    if not Admin.query.first():
        print("Creating initial Super Admin user...")
        super_admin = Admin(username="superadmin", email="superadmin@example.com", name="Super Admin")
        super_admin.set_password("superadmin123")
        db.session.add(super_admin)
    else:
        super_admin = Admin.query.first()
        print(f"Super Admin user '{super_admin.username}' already exists.")

    # Create Profile Tags for all categories
    print("Creating profile tags...")
    
    # INTEREST Tags (25 tags)
    interest_tags = [
        "Technology", "Gaming", "Movies", "Music", "Sports", "Travel", "Photography", 
        "Art", "Science", "Cooking", "Reading", "Fashion", "Fitness", "Writing",
        "Dancing", "Hiking", "Swimming", "Cycling", "Yoga", "Meditation",
        "Gardening", "Politics", "History", "Economics", "Environment"
    ]
    
    # OWNED_DEVICE Tags (15 tags)
    device_tags = [
        "iPhone", "Android Phone", "PC", "Mac", "PlayStation", "Xbox", 
        "Nintendo Switch", "iPad", "Tablet", "Smartwatch", "Smart TV",
        "Laptop", "Desktop", "Gaming Console", "VR Headset"
    ]
    
    # MEMBERSHIP Tags (15 tags)
    membership_tags = [
        "Netflix", "Spotify", "Amazon Prime", "Disney+", "Gym Membership",
        "YouTube Premium", "Apple Music", "Hulu", "HBO Max", "LinkedIn Premium",
        "Adobe Creative Suite", "Microsoft Office", "Google Workspace", 
        "Costco", "Sam's Club"
    ]
    
    # Create INTEREST tags
    for tag_name in interest_tags:
        if not ProfileTag.query.filter_by(name=tag_name, category=TagCategory.INTEREST.value).first():
            tag = ProfileTag(name=tag_name, category=TagCategory.INTEREST.value)
            db.session.add(tag)
    
    # Create OWNED_DEVICE tags  
    for tag_name in device_tags:
        if not ProfileTag.query.filter_by(name=tag_name, category=TagCategory.OWNED_DEVICE.value).first():
            tag = ProfileTag(name=tag_name, category=TagCategory.OWNED_DEVICE.value)
            db.session.add(tag)
    
    # Create MEMBERSHIP tags
    for tag_name in membership_tags:
        if not ProfileTag.query.filter_by(name=tag_name, category=TagCategory.MEMBERSHIP.value).first():
            tag = ProfileTag(name=tag_name, category=TagCategory.MEMBERSHIP.value)
            db.session.add(tag)
    
    print(f"Created {len(interest_tags)} INTEREST tags, {len(device_tags)} OWNED_DEVICE tags, and {len(membership_tags)} MEMBERSHIP tags.")

    # Create Sample Badges for XP Milestones
    print("Creating sample badges...")
    sample_badges = [
        {"name": "First Steps", "description": "Complete your first survey", "xp_threshold": 40, "image_url": "/static/badges/first_steps.png"},
        {"name": "Explorer", "description": "Earn 100 XP by participating in surveys", "xp_threshold": 100, "image_url": "/static/badges/explorer.png"},
        {"name": "Contributor", "description": "Earn 250 XP through active participation", "xp_threshold": 250, "image_url": "/static/badges/contributor.png"},
        {"name": "Dedicated", "description": "Earn 500 XP - you're really committed!", "xp_threshold": 500, "image_url": "/static/badges/dedicated.png"},
        {"name": "Expert", "description": "Earn 1000 XP - you're a survey expert!", "xp_threshold": 1000, "image_url": "/static/badges/expert.png"},
        {"name": "Master", "description": "Earn 2500 XP - you've mastered the system!", "xp_threshold": 2500, "image_url": "/static/badges/master.png"},
        {"name": "Legend", "description": "Earn 5000 XP - legendary status achieved!", "xp_threshold": 5000, "image_url": "/static/badges/legend.png"},
    ]
    
    for badge_data in sample_badges:
        if not Badge.query.filter_by(name=badge_data["name"]).first():
            badge = Badge(
                name=badge_data["name"],
                description=badge_data["description"],
                image_url=badge_data["image_url"],
                xp_threshold=badge_data["xp_threshold"]
            )
            db.session.add(badge)
    
    print(f"Created {len(sample_badges)} XP milestone badges.")

    # Create Default Business Tiers
    print("Creating default business tiers...")
    default_tiers = [
        {
            "name": "Standard",
            "description": "Perfect for small businesses getting started with customer feedback",
            "price": 0,  # Free tier
            "monthly_response_limit": 1000,
            "monthly_quest_limit": 5,
            "admin_seat_limit": 2,
            "ai_points_included": 100,
            "can_use_ai_builder": True,
            "can_use_ai_insights": True,
            "can_create_surveys": True,
            "can_generate_responses": True,
            "can_request_featured": False,
            "can_create_quests": False,
            "display_order": 1,
            "is_active": True
        },
        {
            "name": "Advanced",
            "description": "Enhanced features for growing businesses that need more insights and capacity",
            "price": 2999,  # $29.99 in cents
            "monthly_response_limit": 5000,
            "monthly_quest_limit": 15,
            "admin_seat_limit": 5,
            "ai_points_included": 500,
            "can_use_ai_builder": True,
            "can_use_ai_insights": True,
            "can_create_surveys": True,
            "can_generate_responses": True,
            "can_request_featured": True,
            "can_create_quests": False,
            "display_order": 2,
            "is_active": True
        },
        {
            "name": "Super",
            "description": "Enterprise-grade solution with unlimited responses and premium features",
            "price": 9999,  # $99.99 in cents
            "monthly_response_limit": 50000,
            "monthly_quest_limit": 50,
            "admin_seat_limit": 20,
            "ai_points_included": 2000,
            "can_use_ai_builder": True,
            "can_use_ai_insights": True,
            "can_create_surveys": True,
            "can_generate_responses": True,
            "can_request_featured": True,
            "can_create_quests": True,
            "display_order": 3,
            "is_active": True
        }
    ]
    
    for tier_data in default_tiers:
        if not BusinessTier.query.filter_by(name=tier_data["name"]).first():
            tier = BusinessTier(
                name=tier_data["name"],
                description=tier_data["description"],
                price=tier_data["price"],
                monthly_response_limit=tier_data["monthly_response_limit"],
                monthly_quest_limit=tier_data["monthly_quest_limit"],
                admin_seat_limit=tier_data["admin_seat_limit"],
                ai_points_included=tier_data["ai_points_included"],
                can_use_ai_builder=tier_data["can_use_ai_builder"],
                can_use_ai_insights=tier_data["can_use_ai_insights"],
                can_create_surveys=tier_data["can_create_surveys"],
                can_generate_responses=tier_data["can_generate_responses"],
                can_request_featured=tier_data["can_request_featured"],
                can_create_quests=tier_data["can_create_quests"],
                display_order=tier_data["display_order"],
                is_active=tier_data["is_active"]
            )
            db.session.add(tier)
    
    print(f"Created {len(default_tiers)} default business tiers.")

    # Create Default AI Points Packages
    print("Creating default AI points packages...")
    default_packages = [
        {
            "name": "Starter Pack",
            "description": "Perfect for testing AI features and small surveys",
            "points": 100,
            "price": 499,  # $4.99 in cents
            "display_order": 1,
            "is_popular": False,
            "is_active": True
        },
        {
            "name": "Professional Pack",
            "description": "Ideal for regular use and medium-sized survey campaigns",
            "points": 500,
            "price": 1999,  # $19.99 in cents
            "display_order": 2,
            "is_popular": True,
            "is_active": True
        },
        {
            "name": "Business Pack",
            "description": "Great value for frequent AI usage and large survey projects",
            "points": 1000,
            "price": 3499,  # $34.99 in cents
            "display_order": 3,
            "is_popular": False,
            "is_active": True
        },
        {
            "name": "Enterprise Pack",
            "description": "Maximum points for enterprise-level AI survey generation and insights",
            "points": 2500,
            "price": 7999,  # $79.99 in cents
            "display_order": 4,
            "is_popular": False,
            "is_active": True
        }
    ]
    
    for package_data in default_packages:
        if not AIPointsPackage.query.filter_by(name=package_data["name"]).first():
            package = AIPointsPackage(
                name=package_data["name"],
                description=package_data["description"],
                points=package_data["points"],
                price=package_data["price"],
                display_order=package_data["display_order"],
                is_popular=package_data["is_popular"],
                is_active=package_data["is_active"]
            )
            db.session.add(package)
    
    print(f"Created {len(default_packages)} default AI points packages.")

    # Create Default Response Packages
    print("Creating default response packages...")
    default_response_packages = [
        {
            "name": "Small Package",
            "description": "Perfect for small surveys and limited campaigns",
            "responses": 5000,
            "price": 1999,  # $19.99 in cents
            "display_order": 1,
            "is_popular": False,
            "is_active": True
        },
        {
            "name": "Medium Package",
            "description": "Great for growing businesses with regular feedback needs",
            "responses": 15000,
            "price": 4999,  # $49.99 in cents
            "display_order": 2,
            "is_popular": True,
            "is_active": True
        },
        {
            "name": "Large Package",
            "description": "Ideal for large enterprises and extensive survey campaigns",
            "responses": 30000,
            "price": 8999,  # $89.99 in cents
            "display_order": 3,
            "is_popular": False,
            "is_active": True
        },
        {
            "name": "Enterprise Package",
            "description": "Maximum capacity for enterprise-level feedback collection",
            "responses": 50000,
            "price": 12999,  # $129.99 in cents
            "display_order": 4,
            "is_popular": False,
            "is_active": True
        }
    ]
    
    for package_data in default_response_packages:
        existing_package = ResponsePackage.query.filter_by(name=package_data['name']).first()
        if not existing_package:
            response_package = ResponsePackage(**package_data)
            db.session.add(response_package)
            print(f"  - Created response package: {package_data['name']} ({package_data['responses']:,} responses for ${package_data['price']/100:.2f})")
    
    db.session.commit()
    print(f"Created {len(default_response_packages)} default response packages.")

    # Create Sample Business
    sample_business = Business.query.filter_by(name="Eclipseer Demo Biz").first()
    if not sample_business:
        print("Creating sample business 'Eclipseer Demo Biz'...")
        # Get the Super tier ID for the sample business
        super_tier = BusinessTier.query.filter_by(name="Super").first()
        tier_id = super_tier.id if super_tier else None
        
        default_biz_perms = {p.name: True for p in BusinessPermissionKey}
        sample_business = Business(
            name="Eclipseer Demo Biz",
            location="Virtual Space",
            tier_id=tier_id,
            tier="Super",  # Keep legacy field for backwards compatibility
            website="https://eclipseer.com",
            discord_server="https://discord.gg/eclipseer",
            permissions=default_biz_perms,
            audience_type='PUBLIC',
            default_public_on_wall=True,
            is_approved=True,
            is_active=True
        )
        db.session.add(sample_business)
        db.session.flush()
        
        # Create BusinessAudience for it
        sample_biz_audience = BusinessAudience(
            business_id=sample_business.id,
            email_domain_whitelist=["demo.com", "example.org"],
            specific_email_whitelist=["invited_user@example.com"],
            discord_roles_allowed=["Verified Member", "VIP"],
            qr_code_token=str(uuid.uuid4()),
            qr_code_expires_at=datetime.utcnow() + timedelta(days=7)
        )
        db.session.add(sample_biz_audience)
    else:
        print(f"Business '{sample_business.name}' already exists.")

    # Create Sample Business Admin
    ba_user = User.query.filter_by(username="bizadmin@example.com").first()
    if sample_business and not ba_user:
        print("Creating sample Business Admin for 'Eclipseer Demo Biz'...")
        ba_perms = {
            "CREATE_SURVEY": True,
            "EDIT_SURVEY": True,
            "VIEW_SURVEY_ANALYTICS": True,
            "CREATE_BUG_REPORT": True,
            "CREATE_FEATURE_REQUEST": True,
            "EDIT_SPLASH_PAGE": True
        }
        business_admin_user = User(
            username="bizadmin@example.com",
            email="bizadmin@example.com",
            name="Demo Business Admin",
            role="business_admin",
            business_id=sample_business.id,
            business_admin_permissions=ba_perms,
            discord_id="demobizadmin001",
            is_active=True
        )
        business_admin_user.set_password("bizadmin123")
        db.session.add(business_admin_user)
    elif ba_user:
        print(f"Business Admin user '{ba_user.username}' already exists.")

    # Create Regular Demo User
    reg_user = User.query.filter_by(username="demouser@example.com").first()
    if not reg_user:
        print("Creating a regular demo user account...")
        demo_user = User(
            username="demouser@example.com",
            email="demouser@example.com",
            name="Regular Demo User",
            role="user",
            discord_id="demouser002",
            is_active=True
        )
        demo_user.set_password("demopass123")
        db.session.add(demo_user)
        reg_user = demo_user
    else:
        print(f"Regular demo user '{reg_user.username}' already exists.")

    # Create Sample Survey
    if sample_business and not Survey.query.filter_by(title="Demo Feedback Survey").first():
        print("Creating sample survey for 'Eclipseer Demo Biz'...")
        demo_survey = Survey(
            business_id=sample_business.id,
            title="Demo Feedback Survey",
            description="A sample survey to gather feedback.",
            published=True
        )
        db.session.add(demo_survey)
        db.session.flush()

        # Create a sample question for the survey
        sample_question = Question(
            survey_id=demo_survey.id,
            question_text="What do you think about our service?",
            question_type="open-ended",
            sequence_number=1,
            required=False
        )
        db.session.add(sample_question)

        # Create SurveyAudience for the survey
        survey_audience = SurveyAudience(
            survey_id=demo_survey.id,
            access_type='PUBLIC_TO_BUSINESS_USERS'
        )
        db.session.add(survey_audience)
        print(f"  Survey '{demo_survey.title}' created.")

    # Create Sample Bug Report
    if sample_business and reg_user and not Item.query.filter_by(title="Login Button Broken").first():
        print("Creating sample Bug Report...")
        sample_bug = Item(
            business_id=sample_business.id,
            user_id=reg_user.id,
            item_type='BUG',
            title="Login Button Broken",
            description="The login button on the homepage doesn't respond to clicks.",
            status='PENDING',
            upvotes=5,
            downvotes=1
        )
        db.session.add(sample_bug)
        print(f"  Bug Report '{sample_bug.title}' created.")

    # Create Sample Business Activity
    if sample_business:
        ba_for_activity = User.query.filter_by(username="bizadmin@example.com").first()
        if ba_for_activity and not BusinessActivity.query.filter_by(title="Welcome to Our Feed!").first():
            print("Creating sample Custom Post...")
            sample_post = BusinessActivity(
                business_id=sample_business.id,
                user_id=ba_for_activity.id,
                activity_type=ActivityType.CUSTOM_POST.value,
                title="Welcome to Our Feed!",
                description="Stay tuned for exciting updates and new surveys from Eclipseer Demo Biz.",
                is_public=True,
                is_pinned=True
            )
            db.session.add(sample_post)
            print(f"  Custom Post '{sample_post.title}' created.")

    # Create Sample Quests
    if sample_business and not Quest.query.filter_by(title="Follow Us on X").first():
        print("Creating sample quests...")
        
        # Quest 1: Social Media Follow Quest
        social_quest = Quest(
            business_id=sample_business.id,
            created_by_user_id=ba_for_activity.id if ba_for_activity else None,
            title="Follow Us on X",
            description="Follow our official X account for the latest updates and announcements!",
            quest_type="FOLLOW_X_PAGE",
            target_url="https://x.com/eclipseer",
            verification_method="CLICK_VERIFY",
            xp_reward=25,
            is_published=True,
            is_featured=True,
            max_completions=1000
        )
        db.session.add(social_quest)
        print(f"  Quest '{social_quest.title}' created.")
        
        # Quest 2: Survey Completion Quest
        survey_quest = Quest(
            business_id=sample_business.id,
            created_by_user_id=ba_for_activity.id if ba_for_activity else None,
            title="Complete Our Feedback Survey",
            description="Help us improve by completing our feedback survey. Your opinion matters!",
            quest_type="COMPLETE_SURVEY",
            target_data={"survey_id": demo_survey.id if 'demo_survey' in locals() else None},
            verification_method="AUTO_VERIFY",
            xp_reward=50,
            is_published=True,
            max_completions=500
        )
        db.session.add(survey_quest)
        print(f"  Quest '{survey_quest.title}' created.")
        
        # Quest 3: Community Quest with Raffle
        community_quest = Quest(
            business_id=sample_business.id,
            created_by_user_id=ba_for_activity.id if ba_for_activity else None,
            title="Join Our Discord Community",
            description="Join our Discord server to connect with other community members and get exclusive updates!",
            quest_type="JOIN_DISCORD_SERVER",
            target_url="https://discord.gg/eclipseer",
            verification_method="MANUAL_VERIFY",
            xp_reward=100,
            has_raffle_prize=True,
            raffle_prize_description="Win a $50 Amazon Gift Card! Winner selected weekly.",
            raffle_end_date=datetime.utcnow() + timedelta(days=7),
            is_published=True,
            is_featured=True,
            max_completions=200
        )
        db.session.add(community_quest)
        print(f"  Quest '{community_quest.title}' created.")
        
        # Quest 4: YouTube Channel Quest
        youtube_quest = Quest(
            business_id=sample_business.id,
            created_by_user_id=ba_for_activity.id if ba_for_activity else None,
            title="Subscribe to Our YouTube Channel",
            description="Subscribe to our YouTube channel for video tutorials and product updates!",
            quest_type="SUBSCRIBE_YOUTUBE_CHANNEL",
            target_url="https://youtube.com/@eclipseer",
            verification_method="CLICK_VERIFY",
            xp_reward=75,
            is_published=True,
            max_completions=300
        )
        db.session.add(youtube_quest)
        print(f"  Quest '{youtube_quest.title}' created.")
        
        # Quest 5: Super Admin Global Quest (no business association)
        global_quest = Quest(
            business_id=None,  # Global quest
            created_by_admin_id=super_admin.id if super_admin else None,
            title="Platform Explorer",
            description="Explore the platform by visiting our main website and learning about our features!",
            quest_type="VISIT_LINK",
            target_url="https://eclipseer.com/features",
            verification_method="CLICK_VERIFY",
            xp_reward=30,
            is_published=True,
            is_featured=True,
            max_completions=1000
        )
        db.session.add(global_quest)
        print(f"  Global Quest '{global_quest.title}' created.")

    # Create Sample Quest Completion (for demo user)
    if reg_user and Quest.query.filter_by(title="Follow Us on X").first():
        follow_quest = Quest.query.filter_by(title="Follow Us on X").first()
        if not QuestCompletion.query.filter_by(quest_id=follow_quest.id, user_id=reg_user.id).first():
            print("Creating sample quest completion...")
            quest_completion = QuestCompletion(
                quest_id=follow_quest.id,
                user_id=reg_user.id,
                verification_status="VERIFIED",
                xp_awarded=follow_quest.xp_reward
            )
            db.session.add(quest_completion)
            
            # Update quest completion count
            follow_quest.completion_count = 1
            
            # Update user XP
            reg_user.xp_balance += follow_quest.xp_reward
            reg_user.total_xp_earned += follow_quest.xp_reward
            
            # Create points log entry
            points_log = PointsLog(
                user_id=reg_user.id,
                business_id=follow_quest.business_id,
                quest_id=follow_quest.id,
                activity_type="QUEST_COMPLETED",
                points_awarded=follow_quest.xp_reward
            )
            db.session.add(points_log)
            print(f"  Quest completion for '{follow_quest.title}' created.")

    # ========== CREATE ECLIPSEER BUSINESS WITH COMPREHENSIVE FEATURES ==========
    print("\n" + "="*60)
    print("CREATING ECLIPSEER BUSINESS WITH COMPREHENSIVE FEATURES")
    print("="*60)
    
    # Create ECLIPSEER Business
    eclipseer_business = Business.query.filter_by(name="ECLIPSEER").first()
    if not eclipseer_business:
        print("Creating ECLIPSEER business...")
        super_tier = BusinessTier.query.filter_by(name="Super").first()
        
        # Set all permissions to True for ECLIPSEER
        all_permissions = {p.name: True for p in BusinessPermissionKey}
        
        eclipseer_business = Business(
            name="ECLIPSEER",
            location="Global - Digital Platform",
            tier_id=super_tier.id if super_tier else None,
            tier="Super",
            website="https://eclipseer.com",
            discord_server="https://discord.gg/eclipseer-official",
            permissions=all_permissions,
            audience_type='PUBLIC',
            default_public_on_wall=True,
            is_approved=True,
            is_active=True,
            is_featured=True,
            ai_points_purchased=5000,
            ai_points_monthly=2000,
            monthly_ai_points_quota=2000,
            billing_cycle_start=datetime.utcnow(),
            next_billing_date=datetime.utcnow() + timedelta(days=30),
            monthly_response_limit=50000,
            monthly_responses_used=0,
            monthly_quest_limit=50,
            monthly_quests_used=0,
            admin_seat_limit=20,
            quest_completion_limit=10000,
            cover_image_url="/static/images/eclipseer-cover.jpg",
            logo_url="/static/images/eclipseer-logo.png",
            color_theme={
                "primary_color": "#6366F1",
                "secondary_color": "#EC4899", 
                "text_color": "#1F2937",
                "feed_wall_bg": "#F9FAFB",
                "page_bg": "#FFFFFF",
                "feed_text_color": "#374151"
            }
        )
        db.session.add(eclipseer_business)
        db.session.flush()
        
        # Create BusinessAudience for ECLIPSEER
        eclipseer_audience = BusinessAudience(
            business_id=eclipseer_business.id,
            email_domain_whitelist=["eclipseer.com", "beta.eclipseer.com"],
            specific_email_whitelist=["beta@eclipseer.com", "feedback@eclipseer.com"],
            discord_roles_allowed=["Beta Tester", "Premium Member", "Developer", "Community Manager"],
            discord_server_members_only=False,
            qr_code_token=str(uuid.uuid4()),
            qr_code_expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.session.add(eclipseer_audience)
        print(f"  ✓ ECLIPSEER business created with ID: {eclipseer_business.id}")
    else:
        print(f"ECLIPSEER business already exists with ID: {eclipseer_business.id}")

    # Create ECLIPSEER Admin
    eclipseer_admin = User.query.filter_by(username="eclipseer.admin@eclipseer.com").first()
    if not eclipseer_admin:
        print("Creating ECLIPSEER Admin user...")
        all_admin_permissions = {p.name: True for p in BusinessPermissionKey}
        
        eclipseer_admin = User(
            username="eclipseer.admin@eclipseer.com",
            email="eclipseer.admin@eclipseer.com",
            name="Eclipseer Admin",
            role="business_admin",
            business_id=eclipseer_business.id,
            business_admin_permissions=all_admin_permissions,
            discord_id="eclipseeradmin001",
            is_active=True,
            xp_balance=1000,
            total_xp_earned=1000,
            location="Global",
            occupation="Platform Administrator"
        )
        eclipseer_admin.set_password("eclipseer123")
        db.session.add(eclipseer_admin)
        print(f"  ✓ ECLIPSEER Admin created: {eclipseer_admin.name}")
    else:
        print(f"ECLIPSEER Admin already exists: {eclipseer_admin.name}")

    # Create Demo Users for Survey Responses
    demo_users = []
    for i in range(1, 21):  # Create 20 demo users for responses
        username = f"demouser{i}@eclipseer.com"
        existing_user = User.query.filter_by(username=username).first()
        if not existing_user:
            demo_user = User(
                username=username,
                email=username,
                name=f"Demo User {i}",
                role="user",
                discord_id=f"demouser{i:03d}",
                is_active=True,
                age=random.randint(18, 65),
                gender=random.choice(["Male", "Female", "Non-binary", "Other"]),
                location=random.choice(["North America", "Europe", "Asia", "Latin America", "Africa", "Oceania"]),
                education=random.choice(["High School", "Bachelor's Degree", "Master's Degree", "PhD", "Other"]),
                xp_balance=random.randint(0, 500),
                total_xp_earned=random.randint(0, 1000)
            )
            demo_user.set_password("demo123")
            db.session.add(demo_user)
            demo_users.append(demo_user)
    
    db.session.flush()  # Flush to get user IDs
    
    if not demo_users:
        # Get existing demo users if they were already created
        demo_users = User.query.filter(User.username.like('demouser%@eclipseer.com')).all()
    
    print(f"  ✓ Demo users ready: {len(demo_users)} users")

    # ========== CREATE COMPREHENSIVE SURVEYS ==========
    print("\nCreating comprehensive surveys for ECLIPSEER...")
    
    # Survey 1: Customer Experience Research (Featured)
    customer_survey = Survey.query.filter_by(title="Customer Experience Research Study", business_id=eclipseer_business.id).first()
    if not customer_survey:
        customer_survey = Survey(
            business_id=eclipseer_business.id,
            title="Customer Experience Research Study",
            description="Help us understand your experience with digital platforms and survey tools. Your feedback shapes the future of user experience.",
            published=True,
            is_featured=True,
            tags=["Technology", "User Experience", "Research"]
        )
        db.session.add(customer_survey)
        db.session.flush()
        
        # Questions for Customer Survey
        questions_data = [
            {
                "question_text": "How would you rate your overall satisfaction with digital survey platforms?",
                "question_type": "rating-scale",
                "sequence_number": 1,
                "required": True,
                "rating_start": 1,
                "rating_end": 10,
                "rating_step": 1,
                "left_label": "Very Dissatisfied",
                "right_label": "Very Satisfied"
            },
            {
                "question_text": "Which devices do you primarily use for online surveys? (Select all that apply)",
                "question_type": "multiple-choice",
                "sequence_number": 2,
                "required": True,
                "options": [
                    {"text": "Desktop Computer"},
                    {"text": "Laptop"},
                    {"text": "Smartphone"},
                    {"text": "Tablet"},
                    {"text": "Smart TV"}
                ],
                "min_selection": 1,
                "max_selection": 5
            },
            {
                "question_text": "How likely are you to recommend our platform to others?",
                "question_type": "nps",
                "sequence_number": 3,
                "required": True,
                "nps_left_label": "Not at all likely",
                "nps_right_label": "Extremely likely"
            },
            {
                "question_text": "Please share your thoughts on what features you'd like to see improved:",
                "question_type": "open-ended",
                "sequence_number": 4,
                "required": False,
                "description": "Your detailed feedback helps us prioritize development efforts."
            },
            {
                "question_text": "Rate the importance of each feature:",
                "question_type": "grid",
                "sequence_number": 5,
                "required": True,
                "grid_rows": [
                    {"text": "Real-time Analytics"},
                    {"text": "AI-Powered Insights"},
                    {"text": "Custom Branding"},
                    {"text": "Advanced Question Types"},
                    {"text": "Mobile Optimization"}
                ],
                "grid_columns": [
                    {"text": "Not Important"},
                    {"text": "Somewhat Important"},
                    {"text": "Important"},
                    {"text": "Very Important"},
                    {"text": "Critical"}
                ]
            },
            {
                "question_text": "What is your annual budget for survey and feedback tools?",
                "question_type": "single-choice",
                "sequence_number": 6,
                "required": False,
                "options": [
                    {"text": "Less than $500"},
                    {"text": "$500 - $2,000"},
                    {"text": "$2,000 - $10,000"},
                    {"text": "$10,000 - $50,000"},
                    {"text": "More than $50,000"}
                ],
                "has_other_option": True,
                "other_option_text": "Prefer not to say"
            },
            {
                "question_text": "Rank these survey features by your preference (1 = most preferred):",
                "question_type": "ranking",
                "sequence_number": 7,
                "required": True,
                "ranking_items": [
                    {"text": "Advanced Analytics Dashboard"},
                    {"text": "AI Question Suggestions"},
                    {"text": "Real-time Response Monitoring"},
                    {"text": "Custom Survey Themes"},
                    {"text": "Export to Multiple Formats"}
                ]
            },
            {
                "question_text": "How many team members typically work on survey projects in your organization?",
                "question_type": "numerical-input",
                "sequence_number": 8,
                "required": False,
                "min_value": 1,
                "max_value": 1000,
                "force_positive": True
            }
        ]
        
        for q_data in questions_data:
            question = Question(survey_id=customer_survey.id, **q_data)
            db.session.add(question)
        
        # Create Survey Audience
        customer_survey_audience = SurveyAudience(
            survey_id=customer_survey.id,
            access_type='PUBLIC_TO_BUSINESS_USERS',
            required_tags=["Technology"],
            tag_matching_logic='ANY'
        )
        db.session.add(customer_survey_audience)
        print(f"  ✓ Customer Experience Survey created with {len(questions_data)} questions")

    # Survey 2: Product Feedback & Innovation (Featured)  
    product_survey = Survey.query.filter_by(title="Product Feedback & Innovation Survey", business_id=eclipseer_business.id).first()
    if not product_survey:
        product_survey = Survey(
            business_id=eclipseer_business.id,
            title="Product Feedback & Innovation Survey",
            description="Share your insights on product development and help shape the future of digital tools.",
            published=True,
            is_featured=True,
            tags=["Innovation", "Product Development", "User Research"]
        )
        db.session.add(product_survey)
        db.session.flush()
        
        # Questions for Product Survey
        product_questions = [
            {
                "question_text": "Which category best describes your primary use case?",
                "question_type": "single-choice",
                "sequence_number": 1,
                "required": True,
                "options": [
                    {"text": "Market Research"},
                    {"text": "Customer Feedback"},
                    {"text": "Employee Surveys"},
                    {"text": "Academic Research"},
                    {"text": "Personal Projects"}
                ]
            },
            {
                "question_text": "How satisfied are you with current survey tools on the market?",
                "question_type": "scale",
                "sequence_number": 2,
                "required": True,
                "scale_points": ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]
            },
            {
                "question_text": "What challenges do you face with existing survey platforms?",
                "question_type": "open-ended",
                "sequence_number": 3,
                "required": False
            },
            {
                "question_text": "Rate your experience with these survey features:",
                "question_type": "grid",
                "sequence_number": 4,
                "required": True,
                "grid_rows": [
                    {"text": "Question Logic & Branching"},
                    {"text": "Response Analytics"},
                    {"text": "Integration Capabilities"},
                    {"text": "User Interface Design"},
                    {"text": "Customer Support"}
                ],
                "grid_columns": [
                    {"text": "Poor"},
                    {"text": "Fair"},
                    {"text": "Good"},
                    {"text": "Excellent"},
                    {"text": "N/A", "isNotApplicable": True}
                ],
                "not_applicable": True
            },
            {
                "question_text": "What is your preferred method for analyzing survey results?",
                "question_type": "multiple-choice",
                "sequence_number": 5,
                "required": True,
                "options": [
                    {"text": "Built-in Analytics Dashboard"},
                    {"text": "Export to Excel/CSV"},
                    {"text": "Integration with BI Tools"},
                    {"text": "Custom API Access"},
                    {"text": "AI-Generated Reports"}
                ],
                "min_selection": 1,
                "max_selection": 3
            },
            {
                "question_text": "Please provide your email for follow-up research opportunities:",
                "question_type": "email-input",
                "sequence_number": 6,
                "required": False,
                "verify_domain": False,
                "description": "We respect your privacy and will only contact you about relevant research opportunities."
            }
        ]
        
        for q_data in product_questions:
            question = Question(survey_id=product_survey.id, **q_data)
            db.session.add(question)
        
        # Create Survey Audience
        product_survey_audience = SurveyAudience(
            survey_id=product_survey.id,
            access_type='PUBLIC_TO_BUSINESS_USERS'
        )
        db.session.add(product_survey_audience)
        print(f"  ✓ Product Feedback Survey created with {len(product_questions)} questions")

    # Survey 3: Technology Trends & Future Insights
    tech_survey = Survey.query.filter_by(title="Technology Trends & Future Insights", business_id=eclipseer_business.id).first()
    if not tech_survey:
        tech_survey = Survey(
            business_id=eclipseer_business.id,
            title="Technology Trends & Future Insights", 
            description="Explore emerging technology trends and share your predictions for the future of digital tools.",
            published=True,
            tags=["Technology", "Trends", "Future", "Innovation"]
        )
        db.session.add(tech_survey)
        db.session.flush()
        
        # Questions for Tech Survey
        tech_questions = [
            {
                "question_text": "Which emerging technologies do you think will have the biggest impact on business in the next 5 years?",
                "question_type": "multiple-choice",
                "sequence_number": 1,
                "required": True,
                "options": [
                    {"text": "Artificial Intelligence & Machine Learning"},
                    {"text": "Blockchain & Cryptocurrency"},
                    {"text": "Virtual & Augmented Reality"},
                    {"text": "Internet of Things (IoT)"},
                    {"text": "Quantum Computing"},
                    {"text": "5G Networks"}
                ],
                "min_selection": 1,
                "max_selection": 3
            },
            {
                "question_text": "Rate your familiarity with AI-powered survey tools:",
                "question_type": "rating-scale",
                "sequence_number": 2,
                "required": True,
                "rating_start": 1,
                "rating_end": 5,
                "rating_step": 1,
                "left_label": "Not familiar",
                "right_label": "Very familiar"
            },
            {
                "question_text": "What concerns do you have about AI in data collection and analysis?",
                "question_type": "open-ended",
                "sequence_number": 3,
                "required": False
            }
        ]
        
        for q_data in tech_questions:
            question = Question(survey_id=tech_survey.id, **q_data)
            db.session.add(question)
        
        # Create Survey Audience
        tech_survey_audience = SurveyAudience(
            survey_id=tech_survey.id,
            access_type='PUBLIC_TO_BUSINESS_USERS'
        )
        db.session.add(tech_survey_audience)
        print(f"  ✓ Technology Trends Survey created with {len(tech_questions)} questions")

    db.session.flush()

    # ========== GENERATE RANDOM RESPONSES ==========
    print("\nGenerating random responses for surveys...")
    
    def generate_responses_for_survey(survey, num_responses=100):
        survey_questions = Question.query.filter_by(survey_id=survey.id).order_by(Question.sequence_number).all()
        
        for i in range(num_responses):
            # Use cycling through demo users
            user = demo_users[i % len(demo_users)] if demo_users else None
            
            # Create submission
            submission = Submission(
                survey_id=survey.id,
                user_id=user.id if user else None,
                duration=random.randint(60, 600),  # 1-10 minutes
                age_group=random.choice(["18-24", "25-34", "35-44", "45-54", "55+"]),
                gender=random.choice(["Male", "Female", "Non-binary", "Other"]),
                location=random.choice(["North America", "Europe", "Asia", "Latin America", "Africa", "Oceania"]),
                education=random.choice(["High School", "Bachelor's Degree", "Master's Degree", "PhD", "Other"]),
                device_type=random.choice(["Desktop", "Mobile", "Tablet"]),
                is_complete=True
            )
            db.session.add(submission)
            db.session.flush()
            
            # Generate responses for each question
            for question in survey_questions:
                response_text = ""
                
                if question.question_type == "rating-scale":
                    response_text = str(random.randint(question.rating_start or 1, question.rating_end or 10))
                elif question.question_type == "nps":
                    response_text = str(random.randint(0, 10))
                elif question.question_type in ["single-choice", "dropdown"]:
                    if question.options:
                        response_text = random.choice(question.options)["text"]
                elif question.question_type in ["multiple-choice", "checkbox"]:
                    if question.options:
                        selected = random.sample(question.options, random.randint(1, min(3, len(question.options))))
                        response_text = json.dumps([opt["text"] for opt in selected])
                elif question.question_type == "scale":
                    if question.scale_points:
                        response_text = random.choice(question.scale_points)
                elif question.question_type == "open-ended":
                    responses = [
                        "The platform is user-friendly and intuitive.",
                        "I would like to see more customization options.",
                        "The analytics dashboard could be improved.",
                        "Great tool for collecting customer feedback.",
                        "Integration with other tools would be helpful.",
                        "The response time is impressive.",
                        "More question types would be beneficial.",
                        "Easy to use but needs better mobile support.",
                        "Excellent for market research projects.",
                        "The AI features are quite innovative."
                    ]
                    response_text = random.choice(responses)
                elif question.question_type == "numerical-input":
                    response_text = str(random.randint(1, 100))
                elif question.question_type == "grid":
                    if question.grid_rows and question.grid_columns:
                        grid_response = {}
                        for row in question.grid_rows:
                            grid_response[row["text"]] = random.choice(question.grid_columns)["text"]
                        response_text = json.dumps(grid_response)
                elif question.question_type == "ranking":
                    if question.ranking_items:
                        items = [item["text"] for item in question.ranking_items]
                        random.shuffle(items)
                        response_text = json.dumps(items)
                elif question.question_type == "email-input":
                    emails = ["user@example.com", "feedback@company.com", "research@university.edu"]
                    response_text = random.choice(emails)
                
                if response_text:
                    response = Response(
                        submission_id=submission.id,
                        question_id=question.id,
                        response_text=response_text,
                        response_time=random.randint(5, 60)
                    )
                    db.session.add(response)
        
        print(f"  ✓ Generated {num_responses} responses for '{survey.title}'")

    # Generate responses for all surveys
    if customer_survey:
        generate_responses_for_survey(customer_survey, 100)
    if product_survey:
        generate_responses_for_survey(product_survey, 100)
    if tech_survey:
        generate_responses_for_survey(tech_survey, 85)

    # ========== CREATE QUESTS FOR ECLIPSEER ==========
    print("\nCreating quests for ECLIPSEER...")
    
    # Featured Quest 1: Join ECLIPSEER Community
    community_quest = Quest.query.filter_by(title="Join the ECLIPSEER Community", business_id=eclipseer_business.id).first()
    if not community_quest:
        community_quest = Quest(
            business_id=eclipseer_business.id,
            created_by_user_id=eclipseer_admin.id,
            title="Join the ECLIPSEER Community",
            description="Connect with fellow researchers and survey creators in our vibrant Discord community! Get early access to new features, share best practices, and network with industry professionals.",
            quest_type="JOIN_DISCORD_SERVER",
            target_url="https://discord.gg/eclipseer-official",
            verification_method="MANUAL_VERIFY",
            xp_reward=150,
            has_raffle_prize=True,
            raffle_prize_description="Monthly raffle for $100 Amazon Gift Card and exclusive ECLIPSEER merchandise!",
            raffle_end_date=datetime.utcnow() + timedelta(days=30),
            is_published=True,
            is_featured=True,
            max_completions=500
        )
        db.session.add(community_quest)
        print("  ✓ Featured Community Quest created")

    # Quest 2: Follow on Social Media
    social_quest = Quest.query.filter_by(title="Follow ECLIPSEER on X", business_id=eclipseer_business.id).first()
    if not social_quest:
        social_quest = Quest(
            business_id=eclipseer_business.id,
            created_by_user_id=eclipseer_admin.id,
            title="Follow ECLIPSEER on X",
            description="Stay updated with the latest platform updates, survey tips, and industry insights by following us on X (formerly Twitter).",
            quest_type="FOLLOW_X_PAGE",
            target_url="https://x.com/eclipseer_survey",
            verification_method="CLICK_VERIFY",
            xp_reward=50,
            is_published=True,
            max_completions=1000
        )
        db.session.add(social_quest)
        print("  ✓ Social Media Quest created")

    # Quest 3: Complete Product Survey
    survey_quest = Quest.query.filter_by(title="Complete Our Product Research Survey", business_id=eclipseer_business.id).first()
    if not survey_quest:
        survey_quest = Quest(
            business_id=eclipseer_business.id,
            created_by_user_id=eclipseer_admin.id,
            title="Complete Our Product Research Survey",
            description="Help us improve ECLIPSEER by completing our comprehensive product feedback survey. Your insights drive our roadmap!",
            quest_type="COMPLETE_SURVEY",
            target_data={"survey_id": customer_survey.id if customer_survey else None},
            verification_method="AUTO_VERIFY",
            xp_reward=100,
            is_published=True,
            max_completions=300
        )
        db.session.add(survey_quest)
        print("  ✓ Survey Completion Quest created")

    # Quest 4: Subscribe to YouTube
    youtube_quest = Quest.query.filter_by(title="Subscribe to ECLIPSEER Academy", business_id=eclipseer_business.id).first()
    if not youtube_quest:
        youtube_quest = Quest(
            business_id=eclipseer_business.id,
            created_by_user_id=eclipseer_admin.id,
            title="Subscribe to ECLIPSEER Academy",
            description="Subscribe to our YouTube channel for tutorial videos, best practices, and advanced survey creation techniques.",
            quest_type="SUBSCRIBE_YOUTUBE_CHANNEL",
            target_url="https://youtube.com/@eclipseer-academy",
            verification_method="CLICK_VERIFY",
            xp_reward=75,
            is_published=True,
            max_completions=400
        )
        db.session.add(youtube_quest)
        print("  ✓ YouTube Quest created")

    # ========== CREATE BUGS AND FEATURE REQUESTS ==========
    print("\nCreating bug reports and feature requests for ECLIPSEER...")
    
    # Bug Reports
    bug_reports = [
        {
            "title": "Survey Export Formatting Issue",
            "description": "When exporting survey responses to CSV, special characters in open-ended responses are not properly encoded, causing formatting issues when opened in Excel.",
            "status": "UNDER_REVIEW",
            "upvotes": 23,
            "downvotes": 2
        },
        {
            "title": "Mobile Survey Display Bug",
            "description": "On mobile devices, grid questions with more than 4 columns cause horizontal scrolling that makes the survey difficult to complete.",
            "status": "PLANNED",
            "upvotes": 18,
            "downvotes": 1
        },
        {
            "title": "Real-time Analytics Delay",
            "description": "The real-time analytics dashboard sometimes shows a 5-10 minute delay in updating response counts and charts.",
            "status": "PENDING",
            "upvotes": 15,
            "downvotes": 0
        }
    ]
    
    for i, bug_data in enumerate(bug_reports):
        existing_bug = Item.query.filter_by(title=bug_data["title"], business_id=eclipseer_business.id).first()
        if not existing_bug:
            demo_user = demo_users[i % len(demo_users)] if demo_users else eclipseer_admin
            bug_report = Item(
                business_id=eclipseer_business.id,
                user_id=demo_user.id,
                item_type='BUG',
                title=bug_data["title"],
                description=bug_data["description"],
                status=bug_data["status"],
                upvotes=bug_data["upvotes"],
                downvotes=bug_data["downvotes"],
                is_published=True
            )
            db.session.add(bug_report)
    
    # Feature Requests
    feature_requests = [
        {
            "title": "Advanced Survey Logic Builder",
            "description": "Add a visual drag-and-drop interface for creating complex survey logic and branching scenarios, similar to workflow builders in other platforms.",
            "status": "PLANNED", 
            "upvotes": 47,
            "downvotes": 3
        },
        {
            "title": "White-label Survey Portal",
            "description": "Allow businesses to create fully branded survey portals with custom domains, removing all ECLIPSEER branding for enterprise clients.",
            "status": "UNDER_REVIEW",
            "upvotes": 35,
            "downvotes": 5
        },
        {
            "title": "AI Response Quality Scoring",
            "description": "Implement AI-powered quality scoring for survey responses to automatically flag low-quality or potentially fraudulent submissions.",
            "status": "PENDING",
            "upvotes": 31,
            "downvotes": 2
        },
        {
            "title": "Multi-language Survey Support",
            "description": "Add support for creating surveys in multiple languages with automatic translation capabilities and language-specific analytics.",
            "status": "PLANNED",
            "upvotes": 28,
            "downvotes": 1
        }
    ]
    
    for i, feature_data in enumerate(feature_requests):
        existing_feature = Item.query.filter_by(title=feature_data["title"], business_id=eclipseer_business.id).first()
        if not existing_feature:
            demo_user = demo_users[i % len(demo_users)] if demo_users else eclipseer_admin
            feature_request = Item(
                business_id=eclipseer_business.id,
                user_id=demo_user.id,
                item_type='FEATURE',
                title=feature_data["title"],
                description=feature_data["description"],
                status=feature_data["status"],
                upvotes=feature_data["upvotes"],
                downvotes=feature_data["downvotes"],
                is_published=True
            )
            db.session.add(feature_request)
    
    print(f"  ✓ Created {len(bug_reports)} bug reports and {len(feature_requests)} feature requests")

    # ========== CREATE BUSINESS ACTIVITIES ==========
    print("\nCreating business activities for ECLIPSEER...")
    
    activities = [
        {
            "activity_type": "ANNOUNCEMENT",
            "title": "Welcome to ECLIPSEER Platform!",
            "description": "We're excited to launch our comprehensive survey and feedback platform. Join thousands of businesses already using ECLIPSEER to gather meaningful insights.",
            "is_public": True,
            "is_pinned": True
        },
        {
            "activity_type": "SURVEY_PUBLISHED",
            "title": "New Research Study: Customer Experience Trends",
            "description": "We've launched a comprehensive study on customer experience trends. Participate and get early access to the industry report!",
            "is_public": True,
            "related_item_id": customer_survey.id if customer_survey else None
        },
        {
            "activity_type": "QUEST_CREATED",
            "title": "Community Quest: Join Our Discord Server",
            "description": "New quest available! Join our Discord community and enter our monthly raffle for exclusive prizes.",
            "is_public": True,
            "related_item_id": community_quest.id if community_quest else None
        }
    ]
    
    for activity_data in activities:
        existing_activity = BusinessActivity.query.filter_by(title=activity_data["title"], business_id=eclipseer_business.id).first()
        if not existing_activity:
            activity = BusinessActivity(
                business_id=eclipseer_business.id,
                user_id=eclipseer_admin.id,
                **activity_data
            )
            db.session.add(activity)
    
    print(f"  ✓ Created {len(activities)} business activities")

    # ===== CREATE SAMPLE IDEAS FOR CO-CREATE FEATURE =====
    print("\nCreating sample ideas for Co-Create feature...")
    
    ideas_data = [
        {
            "title": "AI-Powered Survey Question Generator",
            "description": "Develop an intelligent question generator that uses AI to suggest relevant survey questions based on the survey topic and target audience. This would save time for business owners and ensure comprehensive coverage of important topics.",
            "image_url": "/static/images/ideas/ai-question-generator.jpg",
            "milestones": [100, 500, 1000, 2500]
        },
        {
            "title": "Real-time Collaboration Dashboard", 
            "description": "Create a collaborative workspace where team members can work together on survey creation, analysis, and reporting in real-time. Include features like live editing, comments, and role-based permissions.",
            "image_url": "/static/images/ideas/collaboration-dashboard.jpg",
            "milestones": [50, 250, 750, 1500]
        },
        {
            "title": "Mobile App for Survey Responses",
            "description": "Build a dedicated mobile application that makes it easier for users to respond to surveys on-the-go. Include offline capability and push notifications for new survey invitations.",
            "image_url": "/static/images/ideas/mobile-app.jpg",
            "milestones": [200, 1000, 3000, 5000]
        },
        {
            "title": "Advanced Analytics with Predictive Insights",
            "description": "Enhance the analytics dashboard with machine learning capabilities to predict trends, identify patterns, and provide actionable recommendations based on survey data.",
            "image_url": "/static/images/ideas/predictive-analytics.jpg",
            "milestones": [75, 400, 1200, 3000]
        },
        {
            "title": "Integration with Popular CRM Systems",
            "description": "Develop seamless integrations with major CRM platforms like Salesforce, HubSpot, and Pipedrive to automatically sync survey responses and customer data.",
            "image_url": "/static/images/ideas/crm-integration.jpg",
            "milestones": [150, 600, 1500, 4000]
        },
        {
            "title": "Survey Template Marketplace",
            "description": "Create a community-driven marketplace where users can share, rate, and purchase survey templates. Include industry-specific templates and best practices.",
            "image_url": "/static/images/ideas/template-marketplace.jpg",
            "milestones": [100, 500, 1250, 2500]
        },
        {
            "title": "Voice and Video Response Options",
            "description": "Add multimedia response capabilities allowing participants to submit voice recordings or video responses for more engaging and comprehensive feedback collection.",
            "image_url": "/static/images/ideas/multimedia-responses.jpg",
            "milestones": [125, 750, 2000, 5000]
        },
        {
            "title": "Automated Report Generation",
            "description": "Implement an AI-driven system that automatically generates comprehensive reports with insights, charts, and recommendations based on survey results and predefined criteria.",
            "image_url": "/static/images/ideas/automated-reports.jpg",
            "milestones": [80, 350, 1000, 2000]
        },
        {
            "title": "Social Media Survey Distribution",
            "description": "Build integrated tools to easily share surveys across social media platforms with tracking capabilities and social media-optimized survey formats.",
            "image_url": "/static/images/ideas/social-distribution.jpg",
            "milestones": [90, 400, 1100, 2750]
        },
        {
            "title": "Gamification and Rewards System",
            "description": "Introduce gamification elements like points, badges, and leaderboards to increase survey participation rates. Include reward systems and achievement tracking.",
            "image_url": "/static/images/ideas/gamification.jpg",
            "milestones": [300, 1000, 2500, 5000]
        }
    ]
    
    for i, idea_data in enumerate(ideas_data):
        existing_idea = Idea.query.filter_by(title=idea_data["title"], business_id=eclipseer_business.id).first()
        if not existing_idea:
            # Assign idea to different demo users
            demo_user = demo_users[i % len(demo_users)] if demo_users else eclipseer_admin
            
            # Create idea with PUBLISHED status and support period
            idea = Idea(
                business_id=eclipseer_business.id,
                author_id=demo_user.id,
                title=idea_data["title"],
                description=idea_data["description"],
                image_url=idea_data["image_url"],
                status="PUBLISHED",
                published_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                support_ends_at=datetime.utcnow() + timedelta(days=random.randint(30, 90)),
                last_moderated_by_id=eclipseer_admin.id
            )
            db.session.add(idea)
            db.session.flush()  # Get the idea.id
            
            # Add milestones
            for milestone_likes in idea_data["milestones"]:
                milestone = IdeaMilestone(
                    idea_id=idea.id,
                    likes_target=milestone_likes,
                    label=f"Reach {milestone_likes} supporters"
                )
                db.session.add(milestone)
            
            # Add random likes (simulate community engagement)
            num_likes = random.randint(5, 500)
            liked_users = random.sample(demo_users, min(num_likes, len(demo_users)))
            for user in liked_users:
                like = IdeaLike(
                    idea_id=idea.id,
                    user_id=user.id,
                    created_at=datetime.utcnow() - timedelta(days=random.randint(0, 25))
                )
                db.session.add(like)
            
            # Add some comments
            num_comments = random.randint(1, 8)
            comment_templates = [
                "This is a fantastic idea! I would definitely use this feature.",
                "Great concept, but we should also consider the implementation complexity.",
                "I love this suggestion. It would really improve the user experience.",
                "This could be a game-changer for our survey workflow.",
                "Interesting idea. Have you thought about how this would integrate with existing features?",
                "This would save us so much time! Hope it gets implemented soon.",
                "Brilliant idea! This addresses a real pain point we face daily.",
                "I can see this being very useful for our team's collaboration needs."
            ]
            
            for j in range(num_comments):
                commenter = demo_users[j % len(demo_users)] if demo_users else eclipseer_admin
                comment = IdeaComment(
                    idea_id=idea.id,
                    user_id=commenter.id,
                    body=random.choice(comment_templates),
                    created_at=datetime.utcnow() - timedelta(days=random.randint(0, 20))
                )
                db.session.add(comment)
            
            # Add moderation log for approval
            log_entry = IdeaModerationLog(
                idea_id=idea.id,
                admin_id=eclipseer_admin.id,
                action="PUBLISHED",
                reason="Approved after review - great community idea",
                action_metadata={
                    "support_ends_at": idea.support_ends_at.isoformat(),
                    "milestones_set": len(idea_data["milestones"])
                }
            )
            db.session.add(log_entry)
    
    print(f"  ✓ Created {len(ideas_data)} Co-Create ideas with likes, comments, and milestones")

    try:
        db.session.commit()
        print("\n" + "="*60)
        print("✅ ECLIPSEER BUSINESS SETUP COMPLETED SUCCESSFULLY!")
        print("="*60)
        print(f"📊 Created comprehensive surveys with 285+ total responses")
        print(f"🎯 Created 4 engaging quests (1 featured)")
        print(f"🐛 Created 3 bug reports and 4 feature requests")  
        print(f"📢 Created 3 business activities")
        print(f"💡 Created 10 Co-Create ideas with likes, comments, and milestones")
        print(f"👥 Created 20 demo users for realistic data")
        print(f"🏢 ECLIPSEER business has Super tier with all permissions")
        print("="*60)
        print("\nAll sample data committed successfully.")
    except Exception as e:
        db.session.rollback()
        print(f"Error during ECLIPSEER setup: {e}")
        raise

    print("\nDatabase setup complete. You can run your main application now.")

if __name__ == "__main__":
    with app.app_context():
        setup_database()


