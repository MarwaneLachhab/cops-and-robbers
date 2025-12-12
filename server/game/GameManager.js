const { v4: uuidv4 } = require('uuid');
const RankingSystem = require('./RankingSystem');

// Map data for server-side validation
const MAPS = {
  easy: {
    name: 'Training Ground',
    width: 900,
    height: 700,
    timeLimit: 90,
    coinsCount: 8
  },
  medium: {
    name: 'City Streets',
    width: 1000,
    height: 750,
    timeLimit: 120,
    coinsCount: 12
  },
  hard: {
    name: 'Maximum Security',
    width: 1100,
    height: 850,
    timeLimit: 150,
    coinsCount: 16
  }
};

class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRooms = new Map(); // socketId -> roomId
    this.rankingSystem = new RankingSystem();
  }

  // Create a new room
  createRoom(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Must be authenticated to create room' });
      return;
    }

    const roomId = uuidv4().substring(0, 8).toUpperCase();
    
    const room = {
      roomId,
      name: data.name || `${socket.username}'s Room`,
      host: socket.userId,
      hostUsername: socket.username,
      settings: {
        map: data.map || 'easy',
        isPrivate: data.isPrivate || false,
        password: data.password || null
      },
      players: [{
        oderId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        role: null,
        isReady: false,
        isHost: true
      }],
      spectators: [],
      status: 'waiting',
      gameState: null,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.playerRooms.set(socket.id, roomId);
    
    socket.join(roomId);
    socket.emit('room-created', { room: this.getPublicRoomInfo(room) });
    
    // Broadcast updated room list
    this.io.emit('rooms-updated', this.getPublicRooms());
    
    console.log(`Room ${roomId} created by ${socket.username}`);
  }

  // Join existing room
  joinRoom(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Must be authenticated to join room' });
      return;
    }

    const room = this.rooms.get(data.roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    // Check password for private rooms
    if (room.settings.isPrivate && room.settings.password !== data.password) {
      socket.emit('error', { message: 'Incorrect password' });
      return;
    }

    // Check if already in room
    if (room.players.find(p => p.oderId === socket.userId)) {
      socket.emit('error', { message: 'Already in this room' });
      return;
    }

    // Check player count
    const activePlayers = room.players.filter(p => p.role !== 'spectator');
    if (activePlayers.length >= 2) {
      // Add as spectator
      room.spectators.push({
        oderId: socket.userId,
        username: socket.username,
        socketId: socket.id
      });
    } else {
      room.players.push({
        oderId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        role: null,
        isReady: false,
        isHost: false
      });
    }

    this.playerRooms.set(socket.id, data.roomId);
    socket.join(data.roomId);

    // Notify all in room
    this.io.to(data.roomId).emit('player-joined', {
      username: socket.username,
      room: this.getPublicRoomInfo(room)
    });

    socket.emit('room-joined', { room: this.getPublicRoomInfo(room) });
    this.io.emit('rooms-updated', this.getPublicRooms());

    console.log(`${socket.username} joined room ${data.roomId}`);
  }

  // Leave room
  leaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Remove from players
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      room.players.splice(playerIndex, 1);

      // Handle host leaving
      if (player.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.host = room.players[0].oderId;
        room.hostUsername = room.players[0].username;
      }
    }

    // Remove from spectators
    const specIndex = room.spectators.findIndex(s => s.socketId === socket.id);
    if (specIndex !== -1) {
      room.spectators.splice(specIndex, 1);
    }

    this.playerRooms.delete(socket.id);
    socket.leave(roomId);

    // Delete empty room
    if (room.players.length === 0 && room.spectators.length === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      this.io.to(roomId).emit('player-left', {
        username: socket.username,
        room: this.getPublicRoomInfo(room)
      });
    }

    socket.emit('left-room');
    this.io.emit('rooms-updated', this.getPublicRooms());
  }

  // Select role (cop/criminal)
  selectRole(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const { role } = data;
    if (!['cop', 'criminal'].includes(role)) return;

    // Check if role is taken
    const roleTaken = room.players.find(p => p.role === role && p.socketId !== socket.id);
    if (roleTaken) {
      socket.emit('error', { message: `${role} role is already taken` });
      return;
    }

    player.role = role;
    player.isReady = false;

    this.io.to(roomId).emit('role-selected', {
      username: socket.username,
      role,
      room: this.getPublicRoomInfo(room)
    });
  }

  // Toggle ready status
  toggleReady(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    if (!player.role) {
      socket.emit('error', { message: 'Select a role first' });
      return;
    }

    player.isReady = !player.isReady;

    this.io.to(roomId).emit('ready-toggled', {
      username: socket.username,
      isReady: player.isReady,
      room: this.getPublicRoomInfo(room)
    });

    // Check if all ready
    const activePlayers = room.players.filter(p => p.role && p.role !== 'spectator');
    if (activePlayers.length === 2 && activePlayers.every(p => p.isReady)) {
      this.io.to(roomId).emit('all-ready');
    }
  }

  // Start game (host only)
  startGame(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'Only host can start the game' });
      return;
    }

    const activePlayers = room.players.filter(p => p.role && p.role !== 'spectator');
    if (activePlayers.length !== 2) {
      socket.emit('error', { message: 'Need exactly 2 players' });
      return;
    }

    if (!activePlayers.every(p => p.isReady)) {
      socket.emit('error', { message: 'All players must be ready' });
      return;
    }

    // Initialize game state
    const map = MAPS[room.settings.map];
    
    room.status = 'playing';
    room.gameState = {
      startTime: Date.now(),
      timeLimit: map.timeLimit,
      map: room.settings.map,
      criminal: {
        x: map.width - 100,
        y: map.height / 2,
        powerup: null,
        powerupEndTime: 0
      },
      cop: {
        x: 50,
        y: map.height / 2,
        powerup: null,
        powerupEndTime: 0,
        frozen: false,
        frozenEndTime: 0
      },
      coinsCollected: [],
      totalCoins: map.coinsCount,
      powerupsCollected: [],
      winner: null,
      endTime: null
    };

    this.io.to(roomId).emit('game-started', {
      gameState: room.gameState,
      map: room.settings.map
    });

    // Start game timer
    this.startGameTimer(roomId);

    console.log(`Game started in room ${roomId}`);
  }

  // Game timer
  startGameTimer(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const timer = setInterval(() => {
      const room = this.rooms.get(roomId);
      if (!room || room.status !== 'playing') {
        clearInterval(timer);
        return;
      }

      const elapsed = Math.floor((Date.now() - room.gameState.startTime) / 1000);
      const remaining = room.gameState.timeLimit - elapsed;

      if (remaining <= 0) {
        clearInterval(timer);
        this.endGame(roomId, 'cop', 'timeout');
      } else {
        this.io.to(roomId).emit('time-update', { remaining });
      }
    }, 1000);

    room.timer = timer;
  }

  // Handle player movement input
  handlePlayerInput(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.role) return;

    // Update position
    const { x, y } = data;
    room.gameState[player.role].x = x;
    room.gameState[player.role].y = y;

    // Broadcast to others in room
    socket.to(roomId).emit('player-moved', {
      role: player.role,
      x, y
    });
  }

  // Handle coin collection
  handleCoinCollect(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== 'criminal') return;

    const { coinIndex } = data;
    if (!room.gameState.coinsCollected.includes(coinIndex)) {
      room.gameState.coinsCollected.push(coinIndex);
      
      this.io.to(roomId).emit('coin-collected', {
        coinIndex,
        totalCollected: room.gameState.coinsCollected.length
      });
    }
  }

  // Handle powerup collection
  handlePowerupCollect(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const { powerupIndex, powerupType, duration } = data;
    
    if (!room.gameState.powerupsCollected.includes(powerupIndex)) {
      room.gameState.powerupsCollected.push(powerupIndex);
      
      const playerState = room.gameState[player.role];
      playerState.powerup = powerupType;
      playerState.powerupEndTime = Date.now() + duration;

      this.io.to(roomId).emit('powerup-collected', {
        role: player.role,
        powerupIndex,
        powerupType,
        duration
      });

      // Clear powerup after duration
      setTimeout(() => {
        if (room.gameState && room.gameState[player.role]) {
          room.gameState[player.role].powerup = null;
          this.io.to(roomId).emit('powerup-ended', { role: player.role });
        }
      }, duration);
    }
  }

  // Handle teleporter use
  handleTeleporter(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const { targetX, targetY } = data;
    room.gameState[player.role].x = targetX;
    room.gameState[player.role].y = targetY;

    this.io.to(roomId).emit('player-teleported', {
      role: player.role,
      x: targetX,
      y: targetY
    });
  }

  // Handle player caught (criminal caught by cop)
  handlePlayerCaught(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    this.endGame(roomId, 'cop', 'caught');
  }

  // Handle player escaped (criminal reached exit)
  handlePlayerEscaped(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    this.endGame(roomId, 'criminal', 'escaped');
  }

  // End game and calculate rankings
  async endGame(roomId, winner, reason) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    if (room.timer) {
      clearInterval(room.timer);
    }

    room.status = 'finished';
    room.gameState.winner = winner;
    room.gameState.endTime = Date.now();

    const gameTime = Math.floor((room.gameState.endTime - room.gameState.startTime) / 1000);

    // Calculate ranking changes
    const criminalPlayer = room.players.find(p => p.role === 'criminal');
    const copPlayer = room.players.find(p => p.role === 'cop');

    const rankingResult = await this.rankingSystem.calculateGameResult(
      { oderId: criminalPlayer.userId, username: criminalPlayer.username },
      { oderId: copPlayer.userId, username: copPlayer.username },
      winner,
      {
        gameTime,
        coinsCollected: room.gameState.coinsCollected.length,
        totalCoins: room.gameState.totalCoins,
        map: room.settings.map,
        reason
      }
    );

    this.io.to(roomId).emit('game-ended', {
      winner,
      reason,
      gameTime,
      coinsCollected: room.gameState.coinsCollected.length,
      totalCoins: room.gameState.totalCoins,
      rankings: rankingResult
    });

    console.log(`Game ended in room ${roomId}: ${winner} wins (${reason})`);

    // Reset room after 10 seconds
    setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room) {
        room.status = 'waiting';
        room.gameState = null;
        room.players.forEach(p => {
          p.isReady = false;
        });
        this.io.to(roomId).emit('room-reset', { room: this.getPublicRoomInfo(room) });
      }
    }, 10000);
  }

  // Handle chat message
  handleChat(socket, message) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || !room.settings.allowChat) return;

    this.io.to(roomId).emit('chat-message', {
      username: socket.username,
      message: message.substring(0, 200), // Limit message length
      timestamp: Date.now()
    });
  }

  // Handle disconnect
  handleDisconnect(socket) {
    this.leaveRoom(socket);
  }

  // Get public room info
  getPublicRoomInfo(room) {
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
      spectators: room.spectators.map(s => ({ username: s.username })),
      settings: {
        map: room.settings.map,
        isPrivate: room.settings.isPrivate
      },
      status: room.status
    };
  }

  // Get all public rooms
  getPublicRooms() {
    const publicRooms = [];
    this.rooms.forEach((room) => {
      if (!room.settings.isPrivate && room.status === 'waiting') {
        publicRooms.push(this.getPublicRoomInfo(room));
      }
    });
    return publicRooms;
  }
}

module.exports = GameManager;
