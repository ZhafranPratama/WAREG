from flask import Flask
from flask_cors import CORS
from app.services.models import db, User, CommodityPrice, PantryItem
from app.services.auth import auth_bp, token_required
from app.services.dataset import seed_commodity_prices
from app.services.pantry import pantry_bp
from app.services.predictor import predictor_bp
from app.routes.main import main_bp


def create_app():
    """Factory function to create and configure the Flask application."""
    app = Flask(__name__)
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'your-secret-key-change-this'
    
    # Initialize extensions
    db.init_app(app)
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(pantry_bp)
    app.register_blueprint(predictor_bp)
    
    # Create tables
    with app.app_context():
        db.create_all()
        seed_commodity_prices()

    return app


__all__ = [
    'create_app',
    'db', 'User', 'CommodityPrice', 'PantryItem',
    'auth_bp', 'token_required',
    'pantry_bp', 'predictor_bp',
]
