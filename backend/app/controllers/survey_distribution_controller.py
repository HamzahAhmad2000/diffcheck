import datetime
from flask import send_file, jsonify, current_app
import io, qrcode, os
from app.models import db
#from app.survey_link import SurveyLink
from app.models import Survey, Response,SurveyLink

class SurveyDistributionController:
    @staticmethod
    def list_links(survey_id):
        links = SurveyLink.query.filter_by(survey_id=survey_id).all()
        return [link.to_dict() for link in links], 200

    @staticmethod
    def create_link(survey_id, data):
        try:
            # Only use label (others will use defaults)
            new_link = SurveyLink(
                survey_id=survey_id,
                label=data.get('label', None),
                allowed_domain=data.get('allowed_domain'),
                allowed_emails=data.get('allowed_emails')
            )
            db.session.add(new_link)
            db.session.commit()
            return new_link.to_dict(), 201
        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @staticmethod
    def update_link(survey_id, link_id, data):
        link = SurveyLink.query.filter_by(survey_id=survey_id, id=link_id).first()
        if not link:
            return {"error": "Link not found"}, 404
        try:
            if 'label' in data:
                link.label = data['label']
            if 'allowed_domain' in data:
                link.allowed_domain = data['allowed_domain']
            if 'allowed_emails' in data:
                link.allowed_emails = data['allowed_emails']
            db.session.commit()
            return link.to_dict(), 200
        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @staticmethod
    def generate_qr(survey_id, link_id):
        link = SurveyLink.query.filter_by(survey_id=survey_id, id=link_id).first()
        if not link:
            return {"error": "Link not found"}, 404
        
        # Use dynamic frontend URL from config
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
        full_url = f"{frontend_url}/survey/{survey_id}/{link.code}"
        
        img = qrcode.make(full_url)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return send_file(buf, mimetype='image/png', as_attachment=True, download_name=f"survey_link_{link_id}_QR.png")
