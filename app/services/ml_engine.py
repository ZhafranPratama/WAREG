import pickle
from pathlib import Path
from datetime import datetime

import numpy as np

try:
    import tensorflow as tf
except ModuleNotFoundError:
    tf = None

try:
    import xgboost as xgb
except ModuleNotFoundError:
    xgb = None

class PriceAnalyticsEngine:
    def __init__(self):
        self.xgb_booster = None
        self.xgb_encoders = None
        self.lstm_scalers = None
        self.lstm_models = {}
        self.base_dir = Path(__file__).resolve().parents[2]
        self.xgb_model_path = self.base_dir / 'wareg_xgboost.json'
        self.xgb_encoders_path = self.base_dir / 'wareg_xgboost_encoders.pkl'
        self.lstm_scaler_path = self.base_dir / 'wareg_lstm_scalers.pkl'
        self.lstm_model_files = {
            'Rice': 'wareg_lstm_Rice.h5',
            'Eggs': 'wareg_lstm_Eggs.h5',
            'Meat (Beef)': 'wareg_lstm_Meat_Beef.h5',
            'Chili (Red)': 'wareg_lstm_Chili_Red.h5',
            'Oil (Vegetable)': 'wareg_lstm_Oil_Vegetable.h5',
            'Sugar': 'wareg_lstm_Sugar.h5',
            'Garlic (Medium)': None,
        }
        self.default_commodity = 'Rice'
        self.lookback = 12

    def _normalize_commodity_name(self, commodity):
        if not commodity or not isinstance(commodity, str):
            return self.default_commodity

        normalized = commodity.strip().lower()
        alias_map = {
            'rice': 'Rice',
            'beras': 'Rice',
            'eggs': 'Eggs',
            'telur': 'Eggs',
            'meat (beef)': 'Meat (Beef)',
            'meat': 'Meat (Beef)',
            'beef': 'Meat (Beef)',
            'chili (red)': 'Chili (Red)',
            'chili': 'Chili (Red)',
            'cabai': 'Chili (Red)',
            'cabe': 'Chili (Red)',
            'oil (vegetable)': 'Oil (Vegetable)',
            'oil': 'Oil (Vegetable)',
            'minyak': 'Oil (Vegetable)',
            'sugar': 'Sugar',
            'gula': 'Sugar',
            'garlic (medium)': 'Garlic (Medium)',
            'garlic': 'Garlic (Medium)',
            'bawang': 'Garlic (Medium)',
        }

        if normalized in alias_map:
            return alias_map[normalized]

        for key, value in alias_map.items():
            if key in normalized and len(key) > 3:
                return value

        if self.lstm_scalers is None:
            try:
                self._load_lstm_scalers()
            except Exception:
                pass

        if self.lstm_scalers and commodity in self.lstm_scalers.get('commodities', []):
            return commodity

        return self.default_commodity

    def _load_xgboost_model(self):
        if self.xgb_booster is not None:
            return self.xgb_booster

        if xgb is None:
            raise RuntimeError('xgboost tidak tersedia di environment')

        booster = xgb.Booster()
        booster.load_model(str(self.xgb_model_path))
        self.xgb_booster = booster
        return booster

    def _load_xgb_encoders(self):
        if self.xgb_encoders is not None:
            return self.xgb_encoders

        with open(self.xgb_encoders_path, 'rb') as file_handle:
            self.xgb_encoders = pickle.load(file_handle)
        return self.xgb_encoders

    def _load_lstm_scalers(self):
        if self.lstm_scalers is not None:
            return self.lstm_scalers

        with open(self.lstm_scaler_path, 'rb') as file_handle:
            self.lstm_scalers = pickle.load(file_handle)
        return self.lstm_scalers

    def _load_lstm_model(self, commodity):
        commodity = self._normalize_commodity_name(commodity)

        if commodity in self.lstm_models:
            return self.lstm_models[commodity]

        if tf is None:
            raise RuntimeError('tensorflow tidak tersedia di environment')

        model_name = self.lstm_model_files.get(commodity)
        if not model_name:
            raise ValueError(f'Tidak ada model LSTM untuk komoditas {commodity}')

        model_path = self.base_dir / model_name
        model = tf.keras.models.load_model(str(model_path), compile=False)
        self.lstm_models[commodity] = model
        return model

    def _prepare_historical_sequence(self, historical_data):
        if not isinstance(historical_data, list):
            historical_data = []

        values = []
        for item in historical_data:
            if item is None:
                continue
            if isinstance(item, dict):
                if 'price_value' in item:
                    values.append(float(item['price_value']))
                elif 'price' in item:
                    values.append(float(item['price']))
            else:
                try:
                    values.append(float(item))
                except Exception:
                    continue

        if len(values) == 0:
            return [0.0] * self.lookback

        if len(values) < self.lookback:
            pad_value = values[0]
            values = [pad_value] * (self.lookback - len(values)) + values

        return values[-self.lookback:]

    def _safe_encode(self, encoder, value, default=0):
        if encoder is None or not hasattr(encoder, 'classes_'):
            return default

        if value in encoder.classes_:
            return int(encoder.transform([value])[0])

        return default

    def compare_market_prices(self, commodity, region_id):
        commodity = self._normalize_commodity_name(commodity)
        try:
            enc = self._load_xgb_encoders()
            booster = self._load_xgboost_model()
            market_names = list(enc['le_market'].classes_)
            province_names = list(enc['le_province'].classes_)
            if isinstance(region_id, int) and 1 <= region_id <= len(province_names):
                province = province_names[region_id - 1]
            elif isinstance(region_id, int) and 0 <= region_id < len(province_names):
                province = province_names[region_id]
            else:
                province = 'National'

            comm_enc = self._safe_encode(enc['le_commodity'], commodity)
            province_enc = self._safe_encode(enc['le_province'], province)
            year = datetime.utcnow().year
            month = datetime.utcnow().month
            rows = []
            for market in market_names:
                market_enc = self._safe_encode(enc['le_market'], market)
                rows.append([comm_enc, market_enc, province_enc, year, month, 0.0, 0.0])

            data_matrix = xgb.DMatrix(np.array(rows, dtype=float), feature_names=enc.get('features'))
            predictions = booster.predict(data_matrix)
            recommendations = []
            for idx, market in enumerate(market_names):
                price = float(predictions[idx])
                recommendations.append({
                    'market': market,
                    'predicted_price': round(price, 2),
                    'distance': round(0.8 + (idx * 0.18), 1) if idx < 6 else round(1.8 + ((idx - 6) * 0.25), 1)
                })

            recommendations.sort(key=lambda item: item['predicted_price'])
            reference_price = float(np.median(predictions)) if len(predictions) else 0.0
            recommendation_text = 'Pantau harga'
            if recommendations:
                top = recommendations[0]
                if top['predicted_price'] <= reference_price * 0.95:
                    recommendation_text = f'Beli di {top["market"]}'
                else:
                    recommendation_text = 'Pantau harga saat ini'

            return {
                'commodity': commodity,
                'region_id': int(region_id) if isinstance(region_id, int) else region_id,
                'province': province,
                'reference_price': round(reference_price, 2),
                'recommendation': recommendation_text,
                'recommendations': recommendations[:5]
            }
        except Exception as exc:
            return {
                'commodity': commodity,
                'region_id': int(region_id) if isinstance(region_id, int) else region_id,
                'province': 'National',
                'recommendation': 'Rekomendasi default karena model belum ter-load',
                'recommendations': [
                    {'market': 'Pasar Minggu', 'predicted_price': 65000, 'distance': 0.8},
                    {'market': 'Pasar Santa', 'predicted_price': 75000, 'distance': 1.2}
                ],
                'error': str(exc)
            }

    def predict_future_price(self, historical_data, commodity=None):
        try:
            commodity = self._normalize_commodity_name(commodity or None)
            scaler_data = self._load_lstm_scalers()
            if commodity not in scaler_data.get('scalers', {}):
                commodity = self.default_commodity

            scaler = scaler_data['scalers'][commodity]
            values = self._prepare_historical_sequence(historical_data)
            sequence = np.array(values, dtype=float).reshape(-1, 1)
            scaled_sequence = scaler.transform(sequence).reshape(1, self.lookback, 1)
            model = self._load_lstm_model(commodity)
            predicted = model.predict(scaled_sequence, verbose=0)
            predicted_price = float(scaler.inverse_transform(predicted.reshape(-1, 1))[0, 0])
            current_price = float(values[-1])
            if current_price == 0:
                trend = 'steady'
                percentage = 0
            else:
                trend = 'up' if predicted_price > current_price else 'down' if predicted_price < current_price else 'steady'
                percentage = int(round(abs(predicted_price - current_price) / current_price * 100))

            recommendation = 'Beli sekarang' if trend == 'up' else 'Tunda pembelian' if trend == 'down' else 'Pantau harga'
            return {
                'commodity': commodity,
                'current_price': round(current_price, 2),
                'predicted_price': round(predicted_price, 2),
                'trend': trend,
                'percentage': percentage,
                'recommendation': recommendation
            }
        except Exception as exc:
            return {
                'commodity': commodity or self.default_commodity,
                'current_price': 0.0,
                'predicted_price': 0.0,
                'trend': 'steady',
                'percentage': 0,
                'recommendation': 'Prediksi tidak tersedia',
                'error': str(exc)
            }
