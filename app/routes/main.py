from datetime import datetime
from pathlib import Path

import pandas as pd
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
    prices = (
    CommodityPrice.query
    .filter(CommodityPrice.commodity_name != 'Garlic (Medium)')
    .order_by(CommodityPrice.recorded_date.desc())
    .all()
    )   
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

@main_bp.route('/api/commodity/import-excel', methods=['POST'])
@token_required
def import_commodity_prices_from_excel(current_user):
    excel_path = Path(__file__).resolve().parents[2] / 'wfp_food_prices_idn_clean_12_category_table.xlsx'
    if not excel_path.exists():
        return jsonify({'error': 'File Excel tidak ditemukan di server.'}), 404

    try:
        df = pd.read_excel(excel_path, engine='openpyxl')
    except Exception as exc:
        return jsonify({'error': f'Gagal membaca file Excel: {exc}'}), 500

    df = df[df['priceflag'].astype(str).str.lower() == 'actual']
    df = df.dropna(subset=['commodity', 'price'])

    imported = 0
    for _, row in df.iterrows():
        try:
            commodity_name = str(row['commodity']).strip()
            if not commodity_name:
                continue

            recorded_date = row['date']
            if hasattr(recorded_date, 'date'):
                recorded_date = recorded_date.date()
            else:
                recorded_date = pd.to_datetime(recorded_date, errors='coerce')
                if pd.isna(recorded_date):
                    recorded_date = datetime.utcnow().date()
                else:
                    recorded_date = recorded_date.date()

            source = str(row.get('market', 'National Average')).strip() or 'National Average'
            category = str(row.get('category', 'Lainnya')).strip() or 'Lainnya'
            unit = str(row.get('unit', 'kg')).strip() or 'kg'
            price_value = float(row['price'])
            region_id = int(row['market_id']) if pd.notna(row.get('market_id')) else 1
            price_type = 'retail'

            existing = CommodityPrice.query.filter_by(
                commodity_name=commodity_name,
                recorded_date=recorded_date,
                source=source,
            ).first()
            if existing:
                continue

            new_price = CommodityPrice(
                commodity_name=commodity_name,
                category=category,
                region_id=region_id,
                price_value=price_value,
                unit=unit,
                price_type=price_type,
                recorded_date=recorded_date,
                source=source,
            )
            db.session.add(new_price)
            imported += 1
        except Exception:
            continue

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Gagal menyimpan data Excel ke database: {exc}'}), 500

    return jsonify({'message': 'Data Excel berhasil diimpor', 'imported': imported}), 201
