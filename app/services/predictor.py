from flask import Blueprint, jsonify
from app.services.ml_engine import PriceAnalyticsEngine

predictor_bp = Blueprint('predictor', __name__)
ml_engine = PriceAnalyticsEngine()

@predictor_bp.route('/api/predictor/forecast', methods=['GET'])
def get_forecast():
    forecast = ml_engine.predict_future_price(historical_data=[])
    return jsonify({"status": "success", "data": forecast}), 200
