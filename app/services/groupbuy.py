from flask import Blueprint, request, jsonify
from app.services.models import db, GroupBuy, GroupParticipant
from app.services.auth import token_required
from datetime import datetime
import pandas as pd

groupbuy_bp = Blueprint('groupbuy', __name__)

@groupbuy_bp.route('/api/groupbuys', methods=['GET'])
def list_groupbuys():
    groups = GroupBuy.query.order_by(GroupBuy.ends_at.asc().nulls_last()).all()
    result = []
    for g in groups:
        participants = GroupParticipant.query.filter_by(group_id=g.group_id).all()
        result.append({
            'group_id': g.group_id,
            'title': g.title,
            'commodity_name': g.commodity_name,
            'price_per_person': float(g.price_per_person),
            'target_slots': g.target_slots,
            'participants_count': len(participants),
            'ends_at': g.ends_at.strftime('%Y-%m-%d') if g.ends_at else None,
            'status': g.status,
        })
    return jsonify({'data': result}), 200

@groupbuy_bp.route('/api/groupbuys', methods=['POST'])
@token_required
def create_groupbuy(current_user):
    payload = request.get_json() or {}
    required = ['title', 'commodity_name', 'price_per_person', 'target_slots']
    if not all(k in payload for k in required):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        ends_at = None
        if payload.get('ends_at'):
            ends_at = datetime.strptime(payload['ends_at'], '%Y-%m-%d').date()

        gb = GroupBuy(
            title=payload['title'],
            commodity_name=payload['commodity_name'],
            price_per_person=float(payload['price_per_person']),
            target_slots=int(payload['target_slots']),
            created_by=current_user.user_id,
            ends_at=ends_at,
            status=payload.get('status', 'open')
        )
        db.session.add(gb)
        db.session.commit()
        return jsonify({'message': 'Group buy created', 'group_id': gb.group_id}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

@groupbuy_bp.route('/api/groupbuys/<group_id>/join', methods=['POST'])
@token_required
def join_groupbuy(current_user, group_id):
    g = GroupBuy.query.filter_by(group_id=group_id).first()
    if not g:
        return jsonify({'error': 'Group not found'}), 404

    existing = GroupParticipant.query.filter_by(group_id=group_id, user_id=current_user.user_id).first()
    if existing:
        return jsonify({'message': 'Already joined'}), 200

    try:
        part = GroupParticipant(group_id=group_id, user_id=current_user.user_id)
        db.session.add(part)
        db.session.commit()

        # check if reached target
        count = GroupParticipant.query.filter_by(group_id=group_id).count()
        if count >= g.target_slots:
            g.status = 'ready'
            db.session.commit()

        return jsonify({'message': 'Joined group', 'participants_count': count}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

@groupbuy_bp.route('/api/groupbuys/<group_id>/leave', methods=['POST'])
@token_required
def leave_groupbuy(current_user, group_id):
    p = GroupParticipant.query.filter_by(group_id=group_id, user_id=current_user.user_id).first()
    if not p:
        return jsonify({'message': 'Not a participant'}), 200
    try:
        db.session.delete(p)
        db.session.commit()
        g = GroupBuy.query.filter_by(group_id=group_id).first()
        count = GroupParticipant.query.filter_by(group_id=group_id).count()
        if g and g.status == 'ready' and count < g.target_slots:
            g.status = 'open'
            db.session.commit()
        return jsonify({'message': 'Left group', 'participants_count': count}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

@groupbuy_bp.route('/api/groupbuys/import-xlsx', methods=['POST'])
@token_required
def import_from_xlsx(current_user):
    payload = request.get_json() or {}
    path = payload.get('file_path') or 'instance/groupbuys.xlsx'
    try:
        df = pd.read_excel(path)
    except Exception as exc:
        return jsonify({'error': f'Failed to read xlsx: {exc}'}), 400

    created = 0
    for _, row in df.iterrows():
        try:
            gb = GroupBuy(
                title=str(row.get('title') or row.get('name') or row.get('commodity')),
                commodity_name=str(row.get('commodity') or row.get('commodity_name') or ''),
                price_per_person=float(row.get('price_per_person') or row.get('price') or 0),
                target_slots=int(row.get('target_slots') or row.get('slots') or 8),
                created_by=current_user.user_id,
                ends_at=pd.to_datetime(row.get('ends_at')).date() if row.get('ends_at') else None,
            )
            db.session.add(gb)
            created += 1
        except Exception:
            continue
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

    return jsonify({'message': f'Imported {created} group buys from {path}'}), 200