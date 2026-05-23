from datetime import datetime

from flask import Blueprint, jsonify, render_template, request

from app.services.auth import token_required
from app.services.models import CommodityPrice, db

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/login')
def login_page():
    return render_template('login.html')

@main_bp.route('/register')
def register_page():
    return render_template('register.html')

@main_bp.route('/api/commodity', methods=['GET'])
@token_required
def get_commodity_prices(current_user):
    prices = CommodityPrice.query.order_by(CommodityPrice.recorded_date.desc()).all()
    result = [
        {
            'price_id': item.price_id,
            'commodity_name': item.commodity_name,
            'category': item.category,
            'region_id': item.region_id,
            'price_value': float(item.price_value),
            'unit': item.unit,
            'price_type': item.price_type,
            'recorded_date': item.recorded_date.strftime('%Y-%m-%d'),
            'source': item.source,
        }
        for item in prices
    ]
    return jsonify(result), 200

@main_bp.route('/api/commodity', methods=['POST'])
@token_required
def add_commodity_price(current_user):
    payload = request.get_json() or {}
    required_fields = ['commodity_name', 'category', 'region_id', 'price_value', 'unit', 'price_type', 'recorded_date', 'source']
    if not all(field in payload for field in required_fields):
        return jsonify({'error': 'Semua field komoditas harus diisi'}), 400

    try:
        recorded_date = datetime.strptime(payload['recorded_date'], '%Y-%m-%d').date()
        new_price = CommodityPrice(
            commodity_name=payload['commodity_name'],
            category=payload['category'],
            region_id=int(payload['region_id']),
            price_value=float(payload['price_value']),
            unit=payload['unit'],
            price_type=payload['price_type'],
            recorded_date=recorded_date,
            source=payload['source'],
        )
        db.session.add(new_price)
        db.session.commit()
        return jsonify({'message': 'Sukses menyimpan komoditas', 'data': {
            'price_id': new_price.price_id,
            'commodity_name': new_price.commodity_name,
            'price_value': float(new_price.price_value),
            'unit': new_price.unit,
            'source': new_price.source,
            'recorded_date': new_price.recorded_date.strftime('%Y-%m-%d'),
        }}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Gagal menyimpan komoditas: {exc}'}), 500
