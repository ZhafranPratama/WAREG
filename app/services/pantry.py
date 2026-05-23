from flask import Blueprint, request, jsonify
from app.services.models import db, PantryItem
from app.services.auth import token_required
from datetime import datetime

pantry_bp = Blueprint('pantry', __name__)

@pantry_bp.route('/api/pantry', methods=['GET'])
@token_required
def get_pantry(current_user):
    items = PantryItem.query.filter_by(user_id=current_user.user_id).all()
    result = [{
        "item_id": i.item_id,
        "commodity": i.commodity_name,
        "quantity": float(i.quantity)
    } for i in items]
    return jsonify({"data": result}), 200

@pantry_bp.route('/api/pantry', methods=['POST'])
@token_required
def add_item(current_user):
    data = request.get_json()
    new_item = PantryItem(
        user_id=current_user.user_id,
        commodity_name=data['commodity_name'],
        quantity=data['quantity'],
        unit=data['unit'],
        purchase_date=datetime.strptime(data['purchase_date'], '%Y-%m-%d').date()
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify({"message": "Success"}), 201
