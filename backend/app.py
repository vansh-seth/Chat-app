from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active users and their rooms
users = {}
rooms = {
    'general': {'users': [], 'messages': []},
    'random': {'users': [], 'messages': []},
    'support': {'users': [], 'messages': []}
}

@app.route('/')
def index():
    return {"status": "Server running"}

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connection_response', {'data': 'Connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')
    user_id = None
    
    # Find user id by sid
    for uid, data in users.items():
        if data.get('sid') == request.sid:
            user_id = uid
            break
    
    if user_id:
        # Remove user from any rooms they were in
        for room_id in list(rooms.keys()):
            if user_id in rooms[room_id]['users']:
                rooms[room_id]['users'].remove(user_id)
                # Don't delete default rooms
                if room_id not in ['general', 'random', 'support'] and len(rooms[room_id]['users']) == 0:
                    del rooms[room_id]
                else:
                    emit('user_left', {'user': users[user_id]['username']}, to=room_id)
        
        # Remove user
        del users[user_id]
        emit('user_list_update', list(users.values()), broadcast=True)

@socketio.on('register')
def handle_register(data):
    user_id = data.get('user_id')
    username = data.get('username')
    
    users[user_id] = {
        'user_id': user_id,
        'username': username,
        'sid': request.sid
    }
    
    print(f"User registered: {username}")
    emit('user_list_update', list(users.values()), broadcast=True)

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room')
    user_id = data.get('user_id')
    
    if user_id not in users:
        return
    
    join_room(room_id)
    
    if room_id not in rooms:
        rooms[room_id] = {
            'users': [user_id],
            'messages': []
        }
    else:
        if user_id not in rooms[room_id]['users']:
            rooms[room_id]['users'].append(user_id)
    
    # Send room history to the user
    emit('room_history', rooms[room_id]['messages'])
    
    # Notify other users in the room
    emit('user_joined', {'user': users[user_id]['username']}, to=room_id, skip_sid=request.sid)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data.get('room')
    user_id = data.get('user_id')
    
    if user_id not in users or room_id not in rooms:
        return
    
    leave_room(room_id)
    
    if user_id in rooms[room_id]['users']:
        rooms[room_id]['users'].remove(user_id)
    
    # Don't delete default rooms
    if room_id not in ['general', 'random', 'support'] and len(rooms[room_id]['users']) == 0:
        del rooms[room_id]
    else:
        emit('user_left', {'user': users[user_id]['username']}, to=room_id)

@socketio.on('message')
def handle_message(data):
    room_id = data.get('room')
    user_id = data.get('user_id')
    message = data.get('message')
    
    if user_id not in users or not message:
        return
    
    message_data = {
        'user': users[user_id]['username'],
        'message': message,
        'timestamp': data.get('timestamp', '')
    }
    
    print(f"Message in {room_id}: {message_data}")
    
    if room_id in rooms:
        rooms[room_id]['messages'].append(message_data)
        emit('message', message_data, to=room_id)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)