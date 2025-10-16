from flask import Blueprint, request, jsonify
from ..controllers.question_bank_controller import QuestionBankController

question_bank_bp = Blueprint('question_bank', __name__)

@question_bank_bp.route('/question-bank', methods=['GET'])
def list_bank_questions():
    questions = QuestionBankController.get_all_questions()
    return jsonify(questions)

@question_bank_bp.route('/question-bank', methods=['POST'])
def add_to_bank():
    data = request.json
    result = QuestionBankController.add_question(data)
    return jsonify(result), 201

@question_bank_bp.route('/question-bank/<int:question_id>', methods=['DELETE'])
def remove_from_bank(question_id):
    result = QuestionBankController.remove_question(question_id)
    return jsonify(result), 200
