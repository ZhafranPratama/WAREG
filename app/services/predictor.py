from flask import Blueprint, jsonify, request

from app.services.ml_engine import PriceAnalyticsEngine
from app.services.models import CommodityPrice
from app.services.dataset import load_dataset_dataframe, build_region_lookup
import pandas as pd

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
    # Prefer reading market-level data directly from the CSV/XLSX dataset
    try:
        df = load_dataset_dataframe()
        if df is not None and not df.empty:
            # build region lookup and reverse-map id -> name
            region_lookup = build_region_lookup(df)
            rev_lookup = {v: k for k, v in region_lookup.items()}
            region_name = rev_lookup.get(region_id, None)

            if region_name:
                filtered = df[
                    (df['admin2'].fillna('National').astype(str) == region_name) &
                    (df['commodity_name'].str.contains(commodity, case=False, na=False, regex=False))
                ]
            else:
                # fallback: filter by commodity only when region mapping is missing
                filtered = df[(df['commodity_name'].str.contains(commodity, case=False, na=False, regex=False))]

            if filtered.empty:
                if region_name:
                    return jsonify({
                        'status': 'success',
                        'data': {
                            'commodity': commodity,
                            'region_id': region_id,
                            'province': region_name,
                            'reference_price': 0.0,
                            'recommendation': 'Data pasar tidak tersedia untuk wilayah ini.',
                            'recommendations': []
                        }
                    }), 200
                # if region_name is missing, continue to ML fallback

            grouped = (
                filtered.groupby('market', dropna=False)['price_value']
                .mean()
                .reset_index()
                .sort_values('price_value')
            )

            recommendations = []
            for idx, row in grouped.head(10).iterrows():
                market_name = row['market'] if pd.notna(row['market']) else 'Unknown Market'
                avg_price = float(row['price_value']) if pd.notna(row['price_value']) else None
                recommendations.append({
                    'market': market_name,
                    'predicted_price': round(avg_price, 2) if avg_price is not None else None,
                    'distance': round(0.8 + (len(recommendations) * 0.18), 1)
                })

            reference_price = float(grouped['price_value'].median()) if not grouped.empty else 0.0
            data = {
                'commodity': commodity,
                'region_id': region_id,
                'province': region_name,
                'reference_price': round(reference_price, 2),
                'recommendation': 'Pantau harga',
                'recommendations': recommendations
            }
            return jsonify({'status': 'success', 'data': data}), 200
    except Exception:
        # if dataset access fails, fallback to ml engine
        pass

    comparison = ml_engine.compare_market_prices(commodity, region_id)
    return jsonify({"status": "success", "data": comparison}), 200


@predictor_bp.route('/api/predictor/regions', methods=['GET'])
def get_regions():
    try:
        df = load_dataset_dataframe()
        region_lookup = build_region_lookup(df)
        regions = [{ 'id': idx, 'name': name } for name, idx in region_lookup.items()]
        return jsonify({'status': 'success', 'data': regions}), 200
    except Exception:
        # fallback minimal list
        return jsonify({'status': 'success', 'data': [{ 'id': 1, 'name': 'National' }]}), 200
