const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// In-memory rooms storage
const rooms = new Map();

// Create a new room
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, map, isPrivate, password } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomId = uuidv4().substring(0, 8).toUpperCase();

    const room = {
      roomId,
      name: name.trim(),
      host: req.user.userId,
      hostUsername: req.user.username,
      players: [{
        userId: req.user.userId,
        username: req.user.username,
        socketId: null,
        role: null,
        isReady: false,
        isHost: true
      }],
      settings: {
        map: map || 'easy',
        isPrivate: isPrivate || false,
        password: isPrivate ? password : null,
        maxSpectators: 5,
        allowChat: true
      },
      status: 'waiting',
      gameData: null,
      createdAt: new Date()
    };

    rooms.set(roomId, room);

    res.status(201).json({
      message: 'Room created successfully',
      room: getPublicRoomInfo(room)
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get all public rooms
router.get('/', async (req, res) => {
  try {
    const publicRooms = [];
    rooms.forEach((room) => {
      if (!room.settings.isPrivate && room.status === 'waiting') {
        publicRooms.push(getPublicRoomInfo(room));
      }
    });

    res.json({ rooms: publicRooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const room = rooms.get(req.params.roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: getPublicRoomInfo(room) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Join a room
router.post('/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const room = rooms.get(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already in progress' });
    }

    // Check if player already in room
    if (room.players.find(p => p.userId === req.user.userId)) {
      return res.json({ message: 'Already in room', room: getPublicRoomInfo(room) });
    }

    // Check password for private rooms
    if (room.settings.isPrivate && room.settings.password !== password) {
      return res.status(401).json({ error: 'Incorrect room password' });
    }

    // Check player count (max 2 players + spectators)
    const playerCount = room.players.filter(p => p.role !== 'spectator').length;
    if (playerCount >= 2) {
      // Add as spectator
      room.players.push({
        userId: req.user.userId,
        username: req.user.username,
        socketId: null,
        role: 'spectator',
        isReady: true,
        isHost: false
      });
    } else {
      room.players.push({
        userId: req.user.userId,
        username: req.user.username,
        socketId: null,
        role: null,
        isReady: false,
        isHost: false
      });
    }

    res.json({
      message: 'Joined room successfully',
      room: getPublicRoomInfo(room)
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave a room
router.post('/:roomId/leave', authenticateToken, async (req, res) => {
  try {
    const room = rooms.get(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const playerIndex = room.players.findIndex(p => p.userId === req.user.userId);
    if (playerIndex === -1) {
      return res.status(400).json({ error: 'Not in this room' });
    }

    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    // If host left, assign new host or delete room
    if (player.isHost) {
      if (room.players.length > 0) {
        room.players[0].isHost = true;
        room.host = room.players[0].userId;
        room.hostUsername = room.players[0].username;
      } else {
        rooms.delete(req.params.roomId);
        return res.json({ message: 'Room deleted (no players left)' });
      }
    }

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Helper function
function getPublicRoomInfo(room) {
  return {
    roomId: room.roomId,
    name: room.name,
    hostUsername: room.hostUsername,
    players: room.players.map(p => ({
      username: p.username,
      role: p.role,
      isReady: p.isReady,
      isHost: p.isHost
    })),
    playerCount: room.players.filter(p => p.role !== 'spectator').length,
    spectatorCount: room.players.filter(p => p.role === 'spectator').length,
    settings: {
      map: room.settings.map,
      isPrivate: room.settings.isPrivate
    },
    status: room.status,
    createdAt: room.createdAt
  };
}

// Export rooms for socket handler
router.rooms = rooms;
router.getPublicRoomInfo = getPublicRoomInfo;

module.exports = router;
