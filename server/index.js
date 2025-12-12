const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const leaderboardRoutes = require('./routes/leaderboard');

// Game Manager
const GameManager = require('./game/GameManager');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cops & Robbers Server Running!' });
});

// Initialize Game Manager
const gameManager = new GameManager(io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cops-robbers-secret-key');
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.emit('authenticated', { success: true, username: decoded.username });
      console.log(`Player authenticated: ${decoded.username}`);
    } catch (error) {
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
    }
  });

  // Room events
  socket.on('create-room', (data) => gameManager.createRoom(socket, data));
  socket.on('join-room', (data) => gameManager.joinRoom(socket, data));
  socket.on('leave-room', () => gameManager.leaveRoom(socket));
  socket.on('select-role', (data) => gameManager.selectRole(socket, data));
  socket.on('toggle-ready', () => gameManager.toggleReady(socket));
  socket.on('start-game', () => gameManager.startGame(socket));

  // Game events
  socket.on('player-input', (data) => gameManager.handlePlayerInput(socket, data));
  socket.on('collect-coin', (data) => gameManager.handleCoinCollect(socket, data));
  socket.on('collect-powerup', (data) => gameManager.handlePowerupCollect(socket, data));
  socket.on('use-teleporter', (data) => gameManager.handleTeleporter(socket, data));
  socket.on('player-caught', () => gameManager.handlePlayerCaught(socket));
  socket.on('player-escaped', () => gameManager.handlePlayerEscaped(socket));

  // Chat
  socket.on('room-chat', (message) => gameManager.handleChat(socket, message));

  // Get rooms list
  socket.on('get-rooms', () => {
    socket.emit('rooms-list', gameManager.getPublicRooms());
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameManager.handleDisconnect(socket);
  });
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cops-and-robbers';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000 // 5 second timeout
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((err) => {
    console.log('⚠️ MongoDB connection error:', err.message);
    console.log('💾 Running without database - using in-memory storage');
  });

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚔 Cops & Robbers Server running on port ${PORT}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});

module.exports = { app, server, io };
