from flask import Blueprint, jsonify, request

from app.services.ml_engine import PriceAnalyticsEngine
from app.services.models import CommodityPrice

predictor_bp = Blueprint('predictor', __name__)
ml_engine = PriceAnalyticsEngine()

@predictor_bp.route('/api/predictor/forecast', methods=['GET'])
def get_forecast():
    commodity = request.args.get('commodity', 'Chili (Red)')
    region_id = request.args.get('region_id', '1')
    try:
        region_id = int(region_id)
    except ValueError:
        region_id = 1

    historical_data = []
    try:
        query = CommodityPrice.query.filter(CommodityPrice.commodity_name.ilike(f'%{commodity}%'))
        if region_id is not None:
            query = query.filter_by(region_id=region_id)
        prices = query.order_by(CommodityPrice.recorded_date.desc()).limit(12).all()
        historical_data = [float(item.price_value) for item in reversed(prices)]
    except Exception:
        historical_data = []

    forecast = ml_engine.predict_future_price(historical_data=historical_data, commodity=commodity)
    return jsonify({"status": "success", "data": forecast}), 200

@predictor_bp.route('/api/predictor/compare', methods=['GET'])
def get_market_comparison():
    commodity = request.args.get('commodity', 'Chili (Red)')
    region_id = request.args.get('region_id', '1')
    try:
        region_id = int(region_id)
    except ValueError:
        region_id = 1

    comparison = ml_engine.compare_market_prices(commodity, region_id)
    return jsonify({"status": "success", "data": comparison}), 200
