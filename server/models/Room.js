const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostUsername: {
    type: String,
    required: true
  },
  
  // Players
  players: [{
    oderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    odername: String,
    socketId: String,
    role: { type: String, enum: ['criminal', 'cop', 'spectator', null], default: null },
    isReady: { type: Boolean, default: false },
    isHost: { type: Boolean, default: false }
  }],
  
  // Room settings
  settings: {
    map: { type: String, default: 'easy', enum: ['easy', 'medium', 'hard'] },
    isPrivate: { type: Boolean, default: false },
    password: { type: String, default: null },
    maxSpectators: { type: Number, default: 5 },
    allowChat: { type: Boolean, default: true }
  },
  
  // Game state
  status: {
    type: String,
    enum: ['waiting', 'starting', 'playing', 'finished'],
    default: 'waiting'
  },
  
  // Game data (when playing)
  gameData: {
    startTime: Date,
    timeLimit: Number,
    criminalPosition: { x: Number, y: Number },
    copPosition: { x: Number, y: Number },
    coinsCollected: [Number],
    powerupsCollected: [Number],
    winner: String
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Room auto-deletes after 1 hour
  }
});

// Get public room info for lobby
roomSchema.methods.getPublicInfo = function() {
  return {
    roomId: this.roomId,
    name: this.name,
    hostUsername: this.hostUsername,
    playerCount: this.players.length,
    maxPlayers: 2,
    spectatorCount: this.players.filter(p => p.role === 'spectator').length,
    map: this.settings.map,
    isPrivate: this.settings.isPrivate,
    status: this.status
  };
};

module.exports = mongoose.model('Room', roomSchema);
