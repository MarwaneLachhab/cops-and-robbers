const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// In-memory user store (fallback when no MongoDB)
const inMemoryUsers = new Map();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id || user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET || 'cops-robbers-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if using MongoDB or in-memory
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      // Check existing user
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(400).json({ error: 'Username already taken' });
      }

      // Create user
      const user = new User({ username, email, password });
      await user.save();

      const token = generateToken(user);

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: user.getPublicProfile()
      });
    } else {
      // In-memory fallback
      if (inMemoryUsers.has(username) || [...inMemoryUsers.values()].find(u => u.email === email)) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const user = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        avatar: 'default',
        stats: {
          gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
          criminalGames: 0, criminalWins: 0, totalCoinsCollected: 0, totalEscapes: 0,
          copGames: 0, copWins: 0, totalCatches: 0,
          powerupsCollected: 0, teleportersUsed: 0
        },
        ranking: { points: 1000, tier: 'Bronze', rank: 0, seasonWins: 0, winStreak: 0, bestWinStreak: 0 },
        status: 'online',
        createdAt: new Date()
      };

      inMemoryUsers.set(username, user);

      const token = generateToken(user);

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { ...user, password: undefined }
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findOne({ 
        $or: [{ username }, { email: username }] 
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      user.status = 'online';
      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        token,
        user: user.getPublicProfile()
      });
    } else {
      // In-memory fallback
      const user = inMemoryUsers.get(username) || [...inMemoryUsers.values()].find(u => u.email === username);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      user.status = 'online';
      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        token,
        user: { ...user, password: undefined }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: user.getPublicProfile() });
    } else {
      const user = [...inMemoryUsers.values()].find(u => u.id === req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: { ...user, password: undefined } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      await User.findByIdAndUpdate(req.user.userId, { status: 'offline' });
    } else {
      const user = [...inMemoryUsers.values()].find(u => u.id === req.user.userId);
      if (user) user.status = 'offline';
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export for use in other modules
router.inMemoryUsers = inMemoryUsers;

module.exports = router;
