import unittest

from app.services.ml_engine import PriceAnalyticsEngine


class PredictorTests(unittest.TestCase):
    def test_predict_future_price_returns_values_for_history(self):
        engine = PriceAnalyticsEngine()
        history = [7000.0, 7050.0, 7100.0, 7150.0, 7200.0, 7250.0, 7300.0, 7350.0, 7400.0, 7450.0, 7500.0, 7550.0]

        result = engine.predict_future_price(history, 'Rice')

        self.assertIn('current_price', result)
        self.assertIn('predicted_price', result)
        self.assertEqual(result['current_price'], 7550.0)
        self.assertIsInstance(result['predicted_price'], float)
        self.assertIn(result['trend'], {'up', 'down', 'steady'})


if __name__ == '__main__':
    unittest.main()
