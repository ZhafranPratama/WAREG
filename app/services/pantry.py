from flask import Blueprint, request, jsonify
from app.services.models import db, PantryItem
from app.services.auth import token_required
from datetime import datetime, date

pantry_bp = Blueprint('pantry', __name__)

def _compute_pantry_status(expiry_date):
    if not expiry_date:
        return 'unknown', 'Tidak ada tanggal kadaluarsa'

    days_left = (expiry_date - date.today()).days
    if days_left < 0:
        return 'expired', f'Kadaluarsa {abs(days_left)} hari lalu'
    if days_left == 0:
        return 'expires-today', 'Kadaluarsa hari ini'
    if days_left <= 3:
        return 'soon', f'{days_left} hari lagi'
    if days_left <= 7:
        return 'warning', f'{days_left} hari lagi'
    return 'fresh', f'{days_left} hari lagi'

@pantry_bp.route('/api/pantry', methods=['GET'])
@token_required
def get_pantry(current_user):
    items = PantryItem.query.filter_by(user_id=current_user.user_id).order_by(PantryItem.expiry_date.asc()).all()
    result = []
    for i in items:
        expiry_date = i.expiry_date
        status_key, status_text = _compute_pantry_status(expiry_date)
        result.append({
            "item_id": i.item_id,
            "commodity": i.commodity_name,
            "quantity": float(i.quantity),
            "unit": i.unit,
            "purchase_date": i.purchase_date.strftime('%Y-%m-%d'),
            "expiry_date": expiry_date.strftime('%Y-%m-%d') if expiry_date else None,
            "purchase_price": float(i.purchase_price) if i.purchase_price is not None else None,
            "days_remaining": (expiry_date - date.today()).days if expiry_date else None,
            "status": status_key,
            "status_text": status_text,
        })
    return jsonify({"data": result}), 200

@pantry_bp.route('/api/pantry', methods=['POST'])
@token_required
def add_item(current_user):
    data = request.get_json() or {}
    if not data.get('commodity_name') or not data.get('quantity') or not data.get('unit') or not data.get('purchase_date'):
        return jsonify({'error': 'Semua field nama, jumlah, satuan, dan tanggal pembelian harus diisi'}), 400

    try:
        purchase_date = datetime.strptime(data['purchase_date'], '%Y-%m-%d').date()
        expiry_date = None
        if data.get('expiry_date'):
            expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()

        new_item = PantryItem(
            user_id=current_user.user_id,
            commodity_name=data['commodity_name'],
            quantity=float(data['quantity']),
            unit=data['unit'],
            purchase_date=purchase_date,
            expiry_date=expiry_date,
            purchase_price=float(data.get('purchase_price')) if data.get('purchase_price') else None,
        )
        db.session.add(new_item)
        db.session.commit()
        return jsonify({"message": "Success"}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Gagal menyimpan data pantry: {exc}'}), 500

@pantry_bp.route('/api/pantry/<item_id>', methods=['DELETE'])
@token_required
def delete_item(current_user, item_id):
    try:
        item = PantryItem.query.filter_by(item_id=item_id, user_id=current_user.user_id).first()
        if not item:
            return jsonify({'error': 'Item tidak ditemukan'}), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Item dihapus'}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Gagal menghapus item: {exc}'}), 500
