const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: 'default'
  },
  
  // Stats
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    
    // As Criminal
    criminalGames: { type: Number, default: 0 },
    criminalWins: { type: Number, default: 0 },
    totalCoinsCollected: { type: Number, default: 0 },
    totalEscapes: { type: Number, default: 0 },
    fastestEscape: { type: Number, default: null }, // in seconds
    
    // As Cop
    copGames: { type: Number, default: 0 },
    copWins: { type: Number, default: 0 },
    totalCatches: { type: Number, default: 0 },
    fastestCatch: { type: Number, default: null }, // in seconds
    
    // Power-ups
    powerupsCollected: { type: Number, default: 0 },
    teleportersUsed: { type: Number, default: 0 }
  },
  
  // Ranking
  ranking: {
    points: { type: Number, default: 1000 },
    tier: { type: String, default: 'Bronze', enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Legend'] },
    rank: { type: Number, default: 0 },
    seasonWins: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 }
  },
  
  // Status
  status: {
    type: String,
    enum: ['online', 'offline', 'in-game', 'in-lobby'],
    default: 'offline'
  },
  currentRoom: {
    type: String,
    default: null
  },
  
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate tier based on points
userSchema.methods.updateTier = function() {
  const points = this.ranking.points;
  if (points >= 3000) this.ranking.tier = 'Legend';
  else if (points >= 2500) this.ranking.tier = 'Master';
  else if (points >= 2000) this.ranking.tier = 'Diamond';
  else if (points >= 1500) this.ranking.tier = 'Platinum';
  else if (points >= 1200) this.ranking.tier = 'Gold';
  else if (points >= 1000) this.ranking.tier = 'Silver';
  else this.ranking.tier = 'Bronze';
};

// Update stats after a game
userSchema.methods.updateAfterGame = function(gameResult) {
  this.stats.gamesPlayed++;
  
  if (gameResult.won) {
    this.stats.gamesWon++;
    this.ranking.seasonWins++;
    this.ranking.winStreak++;
    if (this.ranking.winStreak > this.ranking.bestWinStreak) {
      this.ranking.bestWinStreak = this.ranking.winStreak;
    }
  } else {
    this.stats.gamesLost++;
    this.ranking.winStreak = 0;
  }
  
  if (gameResult.role === 'criminal') {
    this.stats.criminalGames++;
    if (gameResult.won) {
      this.stats.criminalWins++;
      this.stats.totalEscapes++;
      if (!this.stats.fastestEscape || gameResult.time < this.stats.fastestEscape) {
        this.stats.fastestEscape = gameResult.time;
      }
    }
    this.stats.totalCoinsCollected += gameResult.coinsCollected || 0;
  } else {
    this.stats.copGames++;
    if (gameResult.won) {
      this.stats.copWins++;
      this.stats.totalCatches++;
      if (!this.stats.fastestCatch || gameResult.time < this.stats.fastestCatch) {
        this.stats.fastestCatch = gameResult.time;
      }
    }
  }
  
  this.stats.powerupsCollected += gameResult.powerupsCollected || 0;
  this.stats.teleportersUsed += gameResult.teleportersUsed || 0;
  
  // Update ranking points
  this.ranking.points += gameResult.pointsChange;
  if (this.ranking.points < 0) this.ranking.points = 0;
  
  this.updateTier();
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    avatar: this.avatar,
    stats: this.stats,
    ranking: this.ranking,
    status: this.status,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
