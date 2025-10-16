from ..models import QuestionBank, db

class QuestionBankController:
    # In question_bank_controller.py
    @staticmethod
    def get_all_questions():
        try:
            questions = QuestionBank.query.all()
            return [{
                'id': q.id,
                'question_text': q.question_text,
                'description': q.description,
                'additional_text': q.additional_text,
                'question_type': q.question_type,
                'options': q.options,
                'image_url': q.image_url,
                'rating_start': q.rating_start,
                'rating_end': q.rating_end,
                'rating_step': q.rating_step,
                'rating_unit': q.rating_unit,
                'created_at': q.created_at.isoformat() if q.created_at else None
            } for q in questions]
        except Exception as e:
            # Log the error so you can see details in your backend logs
            print("Error in get_all_questions:", e)
            return {'error': str(e)}, 500


    @staticmethod
    def add_question(data):
        try:
            new_question = QuestionBank(
                question_text=data['question_text'],
                description=data.get('description'),
                additional_text=data.get('additional_text'),
                question_type=data['question_type'],
                options=data.get('options'),
                image_url=data.get('image_url'),
                rating_start=data.get('rating_start'),
                rating_end=data.get('rating_end'),
                rating_step=data.get('rating_step'),
                rating_unit=data.get('rating_unit')
            )
            db.session.add(new_question)
            db.session.commit()
            return {'message': 'Question added to bank', 'id': new_question.id}
        except Exception as e:
            db.session.rollback()
            return {'error': str(e)}, 500

    @staticmethod
    def remove_question(question_id):
        try:
            question = QuestionBank.query.get(question_id)
            if question:
                db.session.delete(question)
                db.session.commit()
                return {'message': 'Question removed from bank'}
            return {'error': 'Question not found'}, 404
        except Exception as e:
            db.session.rollback()
            return {'error': str(e)}, 500
