const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User'); // Adjust the path to your User model

module.exports = (server) => {
  console.log('Initializing Socket.IO server...');
  
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins in development
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Keep track of online users and last seen times
  const onlineUsers = new Map();
  const lastSeenTimes = new Map();
  const userSockets = new Map();

  // Function to broadcast user status
  const broadcastUserStatus = (username, isOnline) => {
    const timestamp = new Date();
    
    // Always update last seen time when going offline
    if (!isOnline) {
      lastSeenTimes.set(username, timestamp);
    }

    // Get the current last seen time
    const lastSeen = lastSeenTimes.get(username);

    // Broadcast to all clients
    io.emit(isOnline ? 'user_online' : 'user_offline', {
      username,
      lastSeen,
      timestamp,
      isOnline
    });

    console.log(`Broadcasting ${isOnline ? 'online' : 'offline'} status for ${username}`, {
      lastSeen,
      timestamp,
      isOnline
    });
  };

  // Function to check if user is really online
  const isUserOnline = (username) => {
    const sockets = userSockets.get(username);
    return sockets && sockets.size > 0;
  };

  // Function to send current status to a specific socket
  const sendCurrentStatus = (socket, username) => {
    const isOnline = isUserOnline(username);
    const lastSeen = lastSeenTimes.get(username);
    
    socket.emit(isOnline ? 'user_online' : 'user_offline', {
      username,
      lastSeen,
      timestamp: new Date(),
      isOnline
    });
  };

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: Invalid user'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.user.username);

    // Initialize user's socket set if not exists
    if (!userSockets.has(socket.user.username)) {
      userSockets.set(socket.user.username, new Set());
    }
    
    // Add socket to user's sockets
    userSockets.get(socket.user.username).add(socket);
    
    // Update online status
    onlineUsers.set(socket.user.username, socket.id);

    // Join user's room
    socket.join(socket.user._id.toString());

    // Send connection success event
    socket.emit('connection_success', {
      message: 'Connected successfully',
      userId: socket.user._id,
      username: socket.user.username
    });

    // Send current status of other user to the new connection
    const otherUsername = socket.user.username === 'bhupesh' ? 'pihu' : 'bhupesh';
    sendCurrentStatus(socket, otherUsername);

    // Broadcast user online status
    broadcastUserStatus(socket.user.username, true);

    // Set up periodic status update
    const statusInterval = setInterval(() => {
      if (isUserOnline(socket.user.username)) {
        broadcastUserStatus(socket.user.username, true);
      }
    }, 30000); // Update every 30 seconds

    // Handle new messages
    socket.on('send_message', async (messageData) => {
      try {
        const otherUsername = socket.user.username === 'bhupesh' ? 'pihu' : 'bhupesh';
        const otherUser = await User.findOne({ username: otherUsername });

        if (!otherUser) {
          throw new Error('Recipient not found');
        }

        const message = new Message({
          text: messageData.text,
          sender: socket.user._id,
          recipient: otherUser._id,
          emoji: messageData.emoji,
          timestamp: messageData.timestamp || new Date()
        });

        // Save message to database
        await message.save();

        // Only broadcast to other clients, not the sender
        socket.broadcast.emit('receive_message', {
          ...message.toObject(),
          tempId: messageData.tempId
        });
        
        // Send confirmation back to sender with the same tempId
        socket.emit('message_sent', {
          ...message.toObject(),
          tempId: messageData.tempId
        });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle typing status
    socket.on('typing', async (isTyping) => {
      try {
        const otherUsername = socket.user.username === 'bhupesh' ? 'pihu' : 'bhupesh';
        const otherUser = await User.findOne({ username: otherUsername });
        
        if (otherUser) {
          // Only broadcast typing status to other clients
          socket.broadcast.emit('typing', {
            isTyping,
            username: socket.user.username
          });
        }
      } catch (error) {
        console.error('Error in typing status:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user.username);
      
      // Clear status update interval
      clearInterval(statusInterval);

      // Remove socket from user's sockets
      const userSocketSet = userSockets.get(socket.user.username);
      if (userSocketSet) {
        userSocketSet.delete(socket);
        
        // If no more sockets for this user, mark as offline
        if (userSocketSet.size === 0) {
          onlineUsers.delete(socket.user.username);
          broadcastUserStatus(socket.user.username, false);
          userSockets.delete(socket.user.username);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error', {
        message: 'Socket error occurred',
        details: error.message
      });
    });
  });

  return io;
};