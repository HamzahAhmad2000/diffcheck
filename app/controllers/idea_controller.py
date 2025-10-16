from datetime import datetime, timedelta
from typing import List, Optional

from flask import current_app
from sqlalchemy import or_

from app.models import (
    db,
    Idea,
    IdeaLike,
    IdeaComment,
    IdeaMilestone,
    IdeaModerationLog,
    Business,
)


class IdeaController:
    """Controller encapsulating Co-Create idea workflows."""

    # Basic word list – can be extended or made configurable later
    _PROFANITY_WORDS = {
        "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "piss",
        "motherfucker", "slut", "whore",
    }

    @staticmethod
    def _normalize_text(value: Optional[str]) -> str:
        return (value or "").strip()

    # ------------------------------------------------------------------
    # Public retrieval helpers
    # ------------------------------------------------------------------
    @staticmethod
    def list_public_ideas(business_id: int, params, current_user_id: Optional[int] = None) -> tuple:
        """Return published, non-archived ideas for public consumption."""
        try:
            query = Idea.query.filter(
                Idea.business_id == business_id,
                Idea.status == "PUBLISHED",
                Idea.archived_at.is_(None),
            )

            search = IdeaController._normalize_text(params.get("search"))
            if search:
                like_pattern = f"%{search.lower()}%"
                query = query.filter(
                    or_(
                        Idea.title.ilike(like_pattern),
                        Idea.description.ilike(like_pattern),
                    )
                )

            try:
                min_likes = int(params.get("min_likes", 0))
            except (TypeError, ValueError):
                min_likes = 0
            query = query.filter(Idea.likes_count >= min_likes)

            max_likes_param = params.get("max_likes")
            if max_likes_param not in (None, ""):
                try:
                    max_likes = int(max_likes_param)
                    query = query.filter(Idea.likes_count <= max_likes)
                except (TypeError, ValueError):
                    pass

            # Support window filtering (days remaining)
            days_min = params.get("support_days_min")
            days_max = params.get("support_days_max")
            if days_min not in (None, "") or days_max not in (None, ""):
                now = datetime.utcnow()
                if days_min not in (None, ""):
                    try:
                        min_delta = int(days_min)
                        min_deadline = now + timedelta(days=min_delta)
                        # Either no deadline or deadline beyond requested minimum
                        query = query.filter(
                            or_(Idea.support_ends_at.is_(None), Idea.support_ends_at >= min_deadline)
                        )
                    except (TypeError, ValueError):
                        pass
                if days_max not in (None, ""):
                    try:
                        max_delta = int(days_max)
                        max_deadline = now + timedelta(days=max_delta)
                        query = query.filter(Idea.support_ends_at <= max_deadline)
                    except (TypeError, ValueError):
                        pass

            sort_key = params.get("sort", "newest")
            if sort_key == "votes":
                query = query.order_by(Idea.likes_count.desc(), Idea.created_at.desc())
            elif sort_key == "deadline":
                query = query.order_by(Idea.support_ends_at.asc(), Idea.created_at.desc())
            else:
                query = query.order_by(Idea.created_at.desc())

            ideas = query.all()

            liked_idea_ids = set()
            if current_user_id and ideas:
                idea_ids = [idea.id for idea in ideas]
                user_likes = (
                    IdeaLike.query
                    .filter(
                        IdeaLike.user_id == current_user_id,
                        IdeaLike.idea_id.in_(idea_ids)
                    )
                    .all()
                )
                liked_idea_ids = {like.idea_id for like in user_likes}

            return {
                "ideas": [
                    IdeaController._idea_to_public_dict(
                        idea,
                        include_description=True,  # Include description for public listing
                        liked_idea_ids=liked_idea_ids,
                    )
                    for idea in ideas
                ],
                "total_count": len(ideas),
            }, 200
        except Exception as exc:  # pragma: no cover - defensive logging
            current_app.logger.error("[IDEAS_LIST_PUBLIC] Error: %s", exc, exc_info=True)
            return {"error": "Failed to load ideas"}, 500

    @staticmethod
    def list_top_ideas(business_id: int, limit: int = 5, current_user_id: Optional[int] = None) -> List[dict]:
        query = Idea.query.filter(
            Idea.business_id == business_id,
            Idea.status == "PUBLISHED",
            Idea.archived_at.is_(None),
        ).order_by(Idea.likes_count.desc(), Idea.created_at.desc())
        ideas = query.limit(limit).all()
        liked_idea_ids = set()
        if current_user_id and ideas:
            idea_ids = [idea.id for idea in ideas]
            user_likes = (
                IdeaLike.query
                .filter(
                    IdeaLike.user_id == current_user_id,
                    IdeaLike.idea_id.in_(idea_ids)
                )
                .all()
            )
            liked_idea_ids = {like.idea_id for like in user_likes}
        return [
            IdeaController._idea_to_public_dict(
                idea,
                include_description=True,  # Include description for main page display
                liked_idea_ids=liked_idea_ids,
            )
            for idea in ideas
        ]

    @staticmethod
    def get_public_idea(idea_id: int, current_user_id: Optional[int] = None) -> tuple:
        try:
            idea = Idea.query.get(idea_id)
            if not idea or idea.status != "PUBLISHED" or idea.archived_at is not None:
                return {"error": "Idea not found"}, 404
            liked_idea_ids = set()
            if current_user_id:
                existing_like = IdeaLike.query.filter_by(idea_id=idea_id, user_id=current_user_id).first()
                if existing_like:
                    liked_idea_ids = {idea_id}

            data = IdeaController._idea_to_public_dict(
                idea,
                include_description=True,
                include_milestones=True,
                liked_idea_ids=liked_idea_ids,
            )
            # Explicitly ensure these critical fields are present
            data["liked_by_user"] = idea_id in liked_idea_ids
            data["is_open_for_support"] = idea.is_open_for_support()
            data["author_name"] = idea.author.name if idea.author else "Anonymous"
            data["comments"] = [comment.to_dict() for comment in idea.comments.filter_by(is_deleted=False).order_by(IdeaComment.created_at.asc())]
            return {"idea": data}, 200
        except Exception as exc:  # pragma: no cover
            current_app.logger.error("[IDEA_GET_PUBLIC] Error: %s", exc, exc_info=True)
            return {"error": "Failed to load idea"}, 500

    # ------------------------------------------------------------------
    # Submission & engagement
    # ------------------------------------------------------------------
    @staticmethod
    def create_idea(business_id: int, payload: dict, author) -> tuple:
        title = IdeaController._normalize_text(payload.get("title"))
        description = IdeaController._normalize_text(payload.get("description"))
        image_url = IdeaController._normalize_text(payload.get("image_url")) or None
        
        # Handle multiple images
        additional_images = payload.get("additional_images", [])
        image_urls = []
        
        # Build complete image URLs list
        if image_url:
            image_urls.append(image_url)
        if additional_images and isinstance(additional_images, list):
            image_urls.extend([IdeaController._normalize_text(url) for url in additional_images if url])

        if not title:
            return {"error": "Title is required"}, 400
        if not description:
            return {"error": "Description is required"}, 400

        business = Business.query.get(business_id)
        if not business or not business.is_active or not business.is_approved:
            return {"error": "Business not found"}, 404

        try:
            idea = Idea(
                business_id=business_id,
                author_id=author.id,
                title=title,
                description=description,
                image_url=image_url,  # Keep for backward compatibility
                image_urls=image_urls if image_urls else None,  # Store all images
                status="UNDER_REVIEW",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.session.add(idea)
            db.session.commit()

            current_app.logger.info(
                "[IDEA_CREATE] User %s created idea %s for business %s with %d images",
                author.id,
                idea.id,
                business_id,
                len(image_urls)
            )
            return {"idea": idea.to_dict()}, 201
        except Exception as exc:  # pragma: no cover
            db.session.rollback()
            current_app.logger.error("[IDEA_CREATE] Error: %s", exc, exc_info=True)
            return {"error": "Failed to create idea"}, 500

    @staticmethod
    def like_idea(idea_id: int, user) -> tuple:
        idea = Idea.query.get(idea_id)
        if not idea or idea.status != "PUBLISHED" or idea.archived_at is not None:
            return {
                "error": "Idea not available",
                "likes_count": idea.likes_count if idea else 0,
                "is_open_for_support": idea.is_open_for_support() if idea else False,
            }, 404

        existing = IdeaLike.query.filter_by(idea_id=idea_id, user_id=user.id).first()

        try:
            liked = False
            if existing:
                db.session.delete(existing)
                liked = False
            else:
                if not idea.is_open_for_support():
                    return {
                        "error": "Support period ended for this idea",
                        "likes_count": idea.likes_count,
                        "is_open_for_support": idea.is_open_for_support(),
                    }, 403
                like = IdeaLike(idea_id=idea_id, user_id=user.id, created_at=datetime.utcnow())
                db.session.add(like)
                liked = True

            db.session.flush()
            idea.likes_count = IdeaLike.query.filter_by(idea_id=idea_id).count()
            db.session.commit()

            return {
                "message": "Idea liked" if liked else "Idea unliked",
                "liked": liked,
                "likes_count": idea.likes_count,
                "is_open_for_support": idea.is_open_for_support(),
            }, 200
        except Exception as exc:  # pragma: no cover
            db.session.rollback()
            current_app.logger.error("[IDEA_LIKE] Error: %s", exc, exc_info=True)
            return {"error": "Failed to like idea"}, 500

    @staticmethod
    def list_comments(idea_id: int) -> tuple:
        idea = Idea.query.get(idea_id)
        if not idea or idea.status != "PUBLISHED" or idea.archived_at is not None:
            return {"error": "Idea not available"}, 404
        comments = idea.comments.filter_by(is_deleted=False, parent_id=None).order_by(IdeaComment.created_at.asc()).all()
        return {"comments": [comment.to_dict() for comment in comments]}, 200

    @staticmethod
    def add_comment(idea_id: int, user, payload: dict) -> tuple:
        idea = Idea.query.get(idea_id)
        if not idea or idea.status != "PUBLISHED" or idea.archived_at is not None:
            return {"error": "Idea not available"}, 404

        body = IdeaController._normalize_text(payload.get("body"))
        if not body:
            return {"error": "Comment text is required"}, 400

        if IdeaController._contains_profanity(body):
            return {"error": "Comment contains language that is not allowed"}, 400

        parent_id = payload.get("parent_id")
        parent_comment = None
        if parent_id:
            parent_comment = IdeaComment.query.filter_by(id=parent_id, idea_id=idea_id).first()
            if not parent_comment or parent_comment.is_deleted:
                return {"error": "Parent comment not found"}, 404

        try:
            comment = IdeaComment(
                idea_id=idea_id,
                user_id=user.id,
                parent_id=parent_comment.id if parent_comment else None,
                body=body,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.session.add(comment)
            db.session.flush()
            idea.comments_count = IdeaComment.query.filter_by(idea_id=idea_id, is_deleted=False).count()
            db.session.commit()
            return {"comment": comment.to_dict(include_replies=False), "comments_count": idea.comments_count}, 201
        except Exception as exc:  # pragma: no cover
            db.session.rollback()
            current_app.logger.error("[IDEA_COMMENT_CREATE] Error: %s", exc, exc_info=True)
            return {"error": "Failed to add comment"}, 500

    # ------------------------------------------------------------------
    # Moderation / Admin flows
    # ------------------------------------------------------------------
    @staticmethod
    def list_admin_ideas(business_id: int, params) -> tuple:
        try:
            query = Idea.query.filter(Idea.business_id == business_id)
            status_filter = IdeaController._normalize_text(params.get("status"))
            if status_filter:
                query = query.filter(Idea.status == status_filter.upper())

            include_archived = params.get("include_archived", "false").lower() == "true"
            if not include_archived:
                query = query.filter(or_(Idea.archived_at.is_(None), Idea.status != "ARCHIVED"))

            # Handle sorting
            sort_key = params.get("sort", "newest")
            if sort_key == "votes":
                query = query.order_by(Idea.likes_count.desc(), Idea.created_at.desc())
            elif sort_key == "deadline":
                query = query.order_by(Idea.support_ends_at.asc(), Idea.created_at.desc())
            else:  # newest or any other value defaults to newest
                query = query.order_by(Idea.created_at.desc())
            ideas = query.all()
            return {
                "ideas": [idea.to_dict(include_relations=True) for idea in ideas],
                "total_count": len(ideas),
            }, 200
        except Exception as exc:  # pragma: no cover
            current_app.logger.error("[IDEA_LIST_ADMIN] Error: %s", exc, exc_info=True)
            return {"error": "Failed to load ideas"}, 500

    @staticmethod
    def review_idea(idea_id: int, admin_user, payload: dict) -> tuple:
        idea = Idea.query.get(idea_id)
        if not idea:
            return {"error": "Idea not found"}, 404

        action = IdeaController._normalize_text(payload.get("action")).upper()
        if action not in {"APPROVE", "REJECT", "ARCHIVE", "UNARCHIVE", "UPDATE"}:
            return {"error": "Invalid action"}, 400

        try:
            metadata = {}
            if action == "APPROVE":
                idea.status = "PUBLISHED"
                idea.published_at = datetime.utcnow()
                idea.published_by_id = admin_user.id
                idea.last_moderated_by_id = admin_user.id

                support_days = payload.get("support_duration_days")
                support_until = payload.get("support_ends_at")
                if support_until:
                    try:
                        idea.support_ends_at = datetime.fromisoformat(support_until)
                    except ValueError:
                        return {"error": "Invalid support_ends_at value"}, 400
                elif support_days:
                    try:
                        idea.support_ends_at = datetime.utcnow() + timedelta(days=int(support_days))
                    except (TypeError, ValueError):
                        return {"error": "Invalid support_duration_days"}, 400
                else:
                    # Default support period: 2 months (60 days)
                    idea.support_ends_at = datetime.utcnow() + timedelta(days=60)

                metadata["support_ends_at"] = idea.support_ends_at.isoformat() if idea.support_ends_at else None

                # Reset and apply milestones
                IdeaMilestone.query.filter_by(idea_id=idea_id).delete()
                milestones_payload = payload.get("milestones") or []
                if not milestones_payload:
                    milestones_payload = [
                        {"label": "100 Likes", "likes_target": 100},
                        {"label": "1K Likes", "likes_target": 1000},
                        {"label": "5K Likes", "likes_target": 5000},
                        {"label": "10K Likes", "likes_target": 10000},
                    ]
                for entry in milestones_payload:
                    label = IdeaController._normalize_text(entry.get("label")) or f"{entry.get('likes_target', 0)} Likes"
                    try:
                        likes_target = int(entry.get("likes_target", 0))
                    except (TypeError, ValueError):
                        continue
                    milestone = IdeaMilestone(
                        idea_id=idea_id,
                        label=label,
                        likes_target=likes_target,
                    )
                    db.session.add(milestone)

            elif action == "REJECT":
                idea.status = "REJECTED"
                idea.rejection_reason = IdeaController._normalize_text(payload.get("reason")) or None
                idea.review_notes = IdeaController._normalize_text(payload.get("review_notes")) or None
                idea.last_moderated_by_id = admin_user.id
                metadata["rejection_reason"] = idea.rejection_reason

            elif action == "ARCHIVE":
                idea.status = "ARCHIVED"
                idea.archived_at = datetime.utcnow()
                idea.archived_by_id = admin_user.id
                idea.last_moderated_by_id = admin_user.id

            elif action == "UNARCHIVE":
                idea.status = "PUBLISHED"
                idea.archived_at = None
                idea.archived_by_id = None
                idea.last_moderated_by_id = admin_user.id

            elif action == "UPDATE":
                # Update milestones and support duration, optionally change status
                idea.last_moderated_by_id = admin_user.id
                idea.review_notes = IdeaController._normalize_text(payload.get("review_notes")) or idea.review_notes
                
                # Handle status changes for UPDATE action
                requested_status = payload.get("status")
                if requested_status and requested_status != idea.status:
                    if requested_status == "UNDER_REVIEW":
                        idea.status = "UNDER_REVIEW"
                        # Clear published metadata when moving back to under review
                        idea.published_at = None
                        idea.published_by_id = None
                    elif requested_status == "PUBLISHED":
                        idea.status = "PUBLISHED"
                        idea.published_at = datetime.utcnow()
                        idea.published_by_id = admin_user.id

                # Handle support duration for UNDER_REVIEW ideas
                support_days = payload.get("support_duration_days")
                support_until = payload.get("support_ends_at")
                if support_until:
                    try:
                        idea.support_ends_at = datetime.fromisoformat(support_until)
                    except ValueError:
                        return {"error": "Invalid support_ends_at value"}, 400
                elif support_days:
                    try:
                        idea.support_ends_at = datetime.utcnow() + timedelta(days=int(support_days))
                    except (TypeError, ValueError):
                        return {"error": "Invalid support_duration_days"}, 400

                metadata["support_ends_at"] = idea.support_ends_at.isoformat() if idea.support_ends_at else None

                # Update milestones for UNDER_REVIEW ideas
                milestones_payload = payload.get("milestones")
                if milestones_payload is not None:  # Allow empty list to clear milestones
                    # Reset and apply milestones
                    IdeaMilestone.query.filter_by(idea_id=idea_id).delete()
                    for entry in milestones_payload:
                        label = IdeaController._normalize_text(entry.get("label")) or f"{entry.get('likes_target', 0)} Likes"
                        try:
                            likes_target = int(entry.get("likes_target", 0))
                        except (TypeError, ValueError):
                            continue
                        milestone = IdeaMilestone(
                            idea_id=idea_id,
                            label=label,
                            likes_target=likes_target,
                        )
                        db.session.add(milestone)

            log_entry = IdeaModerationLog(
                idea_id=idea.id,
                admin_id=admin_user.id,
                action=action,
                reason=IdeaController._normalize_text(payload.get("reason")) or None,
                action_metadata=metadata,
            )
            db.session.add(log_entry)
            db.session.commit()

            return {"idea": idea.to_dict(include_relations=True)}, 200
        except Exception as exc:  # pragma: no cover
            db.session.rollback()
            current_app.logger.error("[IDEA_REVIEW] Error: %s", exc, exc_info=True)
            return {"error": "Failed to update idea"}, 500

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _contains_profanity(text: str) -> bool:
        lowered = text.lower()
        return any(bad_word in lowered for bad_word in IdeaController._PROFANITY_WORDS)

    @staticmethod
    def _idea_to_public_dict(
        idea: Idea,
        *,
        include_description: bool = False,
        include_milestones: bool = False,
        liked_idea_ids: Optional[set] = None,
    ) -> dict:
        data = {
            "id": idea.id,
            "business_id": idea.business_id,
            "title": idea.title,
            "likes_count": idea.likes_count,
            "comments_count": idea.comments_count,
            "status": idea.status,
            "image_url": idea.image_url,
            "image_urls": idea.image_urls or [],  # Include multiple images
            "created_at": idea.created_at.isoformat() if idea.created_at else None,
            "support_ends_at": idea.support_ends_at.isoformat() if idea.support_ends_at else None,
            "liked_by_user": bool(liked_idea_ids and idea.id in liked_idea_ids),
            "is_open_for_support": idea.is_open_for_support(),
            "author_name": idea.author.name if idea.author else None,
        }
        if include_description:
            data["description"] = idea.description
        if include_milestones:
            data["milestones"] = [milestone.to_dict() for milestone in idea.milestones.order_by(IdeaMilestone.likes_target.asc())]
        return data
