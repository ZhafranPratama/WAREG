from functools import wraps
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from app.services.models import db, User
import os

auth_bp = Blueprint('auth', __name__)
SECRET_KEY = os.environ.get('SECRET_KEY', 'wareg-super-secret-key-development')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.filter_by(user_id=data['user_id']).first()
            if not current_user:
                raise ValueError('User not found')
        except Exception:
            return jsonify({'error': 'Token invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Data tidak lengkap"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email sudah terdaftar"}), 409
    hashed_password = generate_password_hash(data['password'])
    new_user = User(
        email=data['email'],
        password_hash=hashed_password,
        full_name=data.get('full_name', 'User WAREG'),
        location_id=data.get('location_id', 1),
        location_name=data.get('location_name', 'Jakarta Selatan')
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"status": "success", "message": "Registrasi berhasil"}), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if not user or not check_password_hash(user.password_hash, data.get('password')):
        return jsonify({"error": "Kredensial tidak valid"}), 401
    token = jwt.encode({
        'user_id': user.user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm='HS256')
    return jsonify({"status": "success", "token": token}), 200

@auth_bp.route('/api/auth/me', methods=['GET'])
@token_required
def current_user_profile(current_user):
    return jsonify({
        'user_id': current_user.user_id,
        'email': current_user.email,
        'full_name': current_user.full_name,
        'location_id': current_user.location_id,
        'location_name': getattr(current_user, 'location_name', None) or 'Jakarta Selatan',
        'created_at': current_user.created_at.isoformat(),
    }), 200

@auth_bp.route('/api/auth/me', methods=['PATCH'])
@token_required
def update_user_profile(current_user):
    data = request.get_json() or {}
    if data.get('email') and data['email'] != current_user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email sudah digunakan"}), 409
        current_user.email = data['email'].strip()

    if data.get('full_name'):
        current_user.full_name = data['full_name'].strip()

    if data.get('location_name') is not None:
        current_user.location_name = data['location_name'].strip() or None

    db.session.commit()
    return jsonify({"status": "success", "message": "Profil diperbarui"}), 200
