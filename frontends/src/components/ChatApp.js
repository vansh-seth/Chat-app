import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const ChatApp = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [registered, setRegistered] = useState(false);
  const [currentRoom, setCurrentRoom] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState(['general', 'random', 'support']);
  const messagesEndRef = useRef(null);

  // Connect to socket on component mount
  useEffect(() => {
    // In a real app, update this URL to your server location
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('connection_response', (data) => {
      console.log('Connection response:', data);
    });

    newSocket.on('user_list_update', (userList) => {
      console.log('User list updated:', userList);
      setUsers(userList);
    });

    newSocket.on('message', (data) => {
      console.log('Message received:', data);
      // Add an id to prevent duplicate messages in case of network issues
      const messageWithId = {
        ...data,
        id: uuidv4()
      };
      setMessages(msgs => [...msgs, messageWithId]);
    });

    newSocket.on('room_history', (history) => {
      console.log('Room history received:', history);
      setMessages(history || []);
    });

    newSocket.on('user_joined', (data) => {
      console.log('User joined:', data);
      setMessages(msgs => [...msgs, {
        user: 'System',
        message: `${data.user} joined the room`,
        timestamp: new Date().toISOString()
      }]);
    });

    newSocket.on('user_left', (data) => {
      console.log('User left:', data);
      setMessages(msgs => [...msgs, {
        user: 'System',
        message: `${data.user} left the room`,
        timestamp: new Date().toISOString()
      }]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Register user
  const registerUser = () => {
    if (!username.trim()) return;
    
    const newUserId = uuidv4();
    setUserId(newUserId);
    
    socket.emit('register', {
      user_id: newUserId,
      username: username
    });
    
    setRegistered(true);
    // Auto-join general room after registration
    setTimeout(() => joinRoom('general'), 500);
  };

  // Join room
  const joinRoom = (roomName) => {
    if (currentRoom) {
      socket.emit('leave_room', {
        room: currentRoom,
        user_id: userId
      });
    }

    socket.emit('join_room', {
      room: roomName,
      user_id: userId
    });

    setCurrentRoom(roomName);
  };

  // Send message
  const sendMessage = () => {
    if (!message.trim() || !currentRoom) return;

    const messageData = {
      room: currentRoom,
      user_id: userId,
      message: message,
      timestamp: new Date().toISOString()
    };

    console.log('Sending message:', messageData);
    socket.emit('message', messageData);
    
    // Clear the input field but don't add message to UI
    // The server will echo it back through the socket
    setMessage('');
  };

  // Handle key press for sending messages
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-4">Chat App</h1>
          <p className="text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!registered) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md w-80">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">Welcome to Chat</h1>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
                onKeyDown={(e) => e.key === 'Enter' && registerUser()}
              />
            </div>
            <button
              onClick={registerUser}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
            >
              Join Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        {/* User info */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-bold text-xl">Chat App</h2>
          <p className="text-gray-300 text-sm mt-1">Logged in as {username}</p>
        </div>
        
        {/* Rooms */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-bold text-gray-400 text-sm uppercase mb-2">Rooms</h3>
          <ul className="space-y-1">
            {rooms.map(room => (
              <li key={room}>
                <button
                  onClick={() => joinRoom(room)}
                  className={`w-full text-left px-2 py-1 rounded ${currentRoom === room ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                >
                  # {room}
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Users */}
        <div className="p-4 flex-grow overflow-y-auto">
          <h3 className="font-bold text-gray-400 text-sm uppercase mb-2">Online Users</h3>
          <ul className="space-y-1">
            {users.map(user => (
              <li key={user.user_id} className="px-2 py-1 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {user.username} {user.user_id === userId && '(you)'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="bg-white border-b p-4 shadow-sm">
          <h2 className="font-bold text-lg">
            {currentRoom ? `#${currentRoom}` : 'Select a room to start chatting'}
          </h2>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {currentRoom ? (
            messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id || `${msg.timestamp}-${Math.random()}`} className={`flex ${msg.user === 'System' ? 'justify-center' : msg.user === username ? 'justify-end' : 'justify-start'}`}>
                    {msg.user === 'System' ? (
                      <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                        {msg.message}
                      </div>
                    ) : (
                      <div className={`max-w-3/4 ${msg.user === username ? 'bg-blue-600 text-white' : 'bg-gray-200'} px-4 py-2 rounded-lg`}>
                        {msg.user !== username && (
                          <div className="font-bold text-sm">{msg.user}</div>
                        )}
                        <div>{msg.message}</div>
                        <div className="text-xs opacity-70 text-right mt-1">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet in #{currentRoom}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a room from the sidebar to start chatting
            </div>
          )}
        </div>
        
        {/* Message input */}
        {currentRoom && (
          <div className="p-4 bg-white border-t">
            <div className="flex">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your message..."
                disabled={!currentRoom}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 transition"
                disabled={!message.trim() || !currentRoom}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;