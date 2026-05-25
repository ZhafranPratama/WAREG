import uuid
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    user_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=True)
    location_name = db.Column(db.String(100), nullable=True)
    location_id = db.Column(db.Integer, nullable=False)
    persona = db.Column(db.String(50), nullable=True)
    monthly_budget = db.Column(db.Numeric(12, 2), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class CommodityPrice(db.Model):
    __tablename__ = 'commodity_prices'
    price_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    commodity_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    region_id = db.Column(db.Integer, nullable=False)
    price_value = db.Column(db.Numeric(12, 2), nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    price_type = db.Column(db.Enum('retail', 'wholesale', name='price_types'), nullable=False)
    recorded_date = db.Column(db.Date, nullable=False)
    source = db.Column(db.String(100), nullable=False)

class PantryItem(db.Model):
    __tablename__ = 'pantry_items'
    item_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=False)
    commodity_name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Numeric(10, 3), nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    purchase_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)
    purchase_price = db.Column(db.Numeric(10, 2), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GroupBuy(db.Model):
    __tablename__ = 'group_buys'
    group_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(150), nullable=False)
    commodity_name = db.Column(db.String(100), nullable=False)
    price_per_person = db.Column(db.Numeric(12, 2), nullable=False)
    target_slots = db.Column(db.Integer, nullable=False, default=8)
    created_by = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    ends_at = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum('open', 'ready', 'closed', name='group_status'), default='open')


class GroupParticipant(db.Model):
    __tablename__ = 'group_participants'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    group_id = db.Column(db.String(36), db.ForeignKey('group_buys.group_id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
