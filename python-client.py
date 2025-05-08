import socketio
import uuid
import time
import sys
import threading
import random

# Create a Socket.IO client
sio = socketio.Client()

# User data
user_id = str(uuid.uuid4())
username = input("Enter your username: ")
current_room = None

# Connect event handler
@sio.event
def connect():
    print("Connected to server!")
    sio.emit('register', {'user_id': user_id, 'username': username})
    print(f"Registered as {username}")
    join_room()

# Connection error event handler
@sio.event
def connect_error(data):
    print(f"Connection failed: {data}")

# Disconnect event handler
@sio.event
def disconnect():
    print("Disconnected from server")

# Message event handler
@sio.on('message')
def on_message(data):
    sender = data.get('user')
    msg = data.get('message')
    timestamp = data.get('timestamp', '')
    
    # Don't print our own messages again
    if sender != username:
        print(f"\n{sender}: {msg}")

# Room history event handler
@sio.on('room_history')
def on_room_history(history):
    if not history:
        print(f"\nJoined room '{current_room}'. No previous messages.")
        return
        
    print(f"\nRoom history for '{current_room}':")
    for msg in history:
        sender = msg.get('user')
        message = msg.get('message')
        print(f"{sender}: {message}")
    print("\n")

# User joined event handler
@sio.on('user_joined')
def on_user_joined(data):
    print(f"\n{data.get('user')} joined the room")

# User left event handler
@sio.on('user_left')
def on_user_left(data):
    print(f"\n{data.get('user')} left the room")

# User list update event handler
@sio.on('user_list_update')
def on_user_list(users):
    print("\nOnline users:")
    for user in users:
        print(f"- {user.get('username')}")
    print()

def join_room():
    global current_room
    print("\nAvailable rooms: general, random, support")
    room = input("Enter room name to join: ")
    current_room = room
    
    if current_room:
        sio.emit('leave_room', {'room': current_room, 'user_id': user_id})
        
    sio.emit('join_room', {'room': room, 'user_id': user_id})
    print(f"Joined room: {room}")

def send_message():
    while True:
        message = input("")
        
        if message.lower() == "/quit":
            sio.disconnect()
            sys.exit()
        elif message.lower() == "/rooms":
            join_room()
        elif message.strip():
            if current_room:
                sio.emit('message', {
                    'room': current_room,
                    'user_id': user_id,
                    'message': message,
                    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                })

def main():
    try:
        # Connect to the server
        sio.connect('http://localhost:5000')
        
        # Start a thread for sending messages
        message_thread = threading.Thread(target=send_message)
        message_thread.daemon = True
        message_thread.start()
        
        # Keep the main thread alive
        message_thread.join()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if sio.connected:
            sio.disconnect()

if __name__ == "__main__":
    print("Simple WebSocket Chat Client")
    print("Commands:")
    print("  /quit - Exit the application")
    print("  /rooms - Change rooms")
    main()