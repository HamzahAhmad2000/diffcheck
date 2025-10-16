"""
WebSocket Manager for Real-time Notifications
Handles real-time communication for user and admin notifications
"""
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
import logging

logger = logging.getLogger(__name__)

# Initialize SocketIO with CORS support
socketio = SocketIO(cors_allowed_origins="*", async_mode='eventlet')

# Store active connections
active_connections = {}


def init_socketio(app):
    """Initialize SocketIO with Flask app"""
    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet', logger=False, engineio_logger=False)
    # SocketIO initialized silently
    return socketio


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    # Silently handle connection
    emit('connection_response', {'status': 'connected', 'sid': request.sid})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    # Silently handle disconnection
    # Clean up user room associations
    for user_id, sid in list(active_connections.items()):
        if sid == request.sid:
            del active_connections[user_id]


@socketio.on('register_user')
def handle_register_user(data):
    """Register user for their notification room"""
    try:
        user_id = data.get('user_id')
        if not user_id:
            emit('error', {'message': 'user_id is required'})
            return
        
        # Join user-specific room
        room = f"user_{user_id}"
        join_room(room)
        active_connections[user_id] = request.sid
        
        # Silently register user
        emit('registration_success', {'user_id': user_id, 'room': room})
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error registering user: {e}")
        emit('error', {'message': str(e)})


@socketio.on('unregister_user')
def handle_unregister_user(data):
    """Unregister user from their notification room"""
    try:
        user_id = data.get('user_id')
        if not user_id:
            return
        
        room = f"user_{user_id}"
        leave_room(room)
        if user_id in active_connections:
            del active_connections[user_id]
        
        # Silently unregister user
        emit('unregistration_success', {'user_id': user_id})
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error unregistering user: {e}")


@socketio.on('register_admin')
def handle_register_admin(data):
    """Register admin for admin notification room"""
    try:
        admin_id = data.get('admin_id')
        if not admin_id:
            emit('error', {'message': 'admin_id is required'})
            return
        
        # Join admin-specific room
        room = f"admin_{admin_id}"
        join_room(room)
        
        # Also join general admin room
        join_room("admins")
        
        active_connections[f"admin_{admin_id}"] = request.sid
        
        # Silently register admin
        emit('registration_success', {'admin_id': admin_id, 'rooms': [room, 'admins']})
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error registering admin: {e}")
        emit('error', {'message': str(e)})


def emit_notification(user_id, notification_data):
    """Emit notification to specific user"""
    try:
        room = f"user_{user_id}"
        socketio.emit('new_notification', notification_data, room=room)
        # Silently emit notification
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error emitting notification to user {user_id}: {e}")


def emit_admin_notification(admin_id, notification_data):
    """Emit notification to specific admin"""
    try:
        room = f"admin_{admin_id}"
        socketio.emit('new_admin_notification', notification_data, room=room)
        # Silently emit notification
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error emitting notification to admin {admin_id}: {e}")


def emit_broadcast_notification(notification_data):
    """Emit notification to all admins"""
    try:
        socketio.emit('new_admin_notification', notification_data, room='admins')
        # Silently broadcast notification
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error broadcasting notification: {e}")


def emit_task_status(user_id, task_data):
    """Emit AI task status update to user"""
    try:
        room = f"user_{user_id}"
        socketio.emit('task_status', task_data, room=room)
        # Silently emit task status
    except Exception as e:
        logger.error(f"[WEBSOCKET] Error emitting task status to user {user_id}: {e}")


