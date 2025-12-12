const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user profile by username
router.get('/profile/:username', async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findOne({ username: req.params.username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: user.getPublicProfile() });
    } else {
      const authRoutes = require('./auth');
      const user = authRoutes.inMemoryUsers.get(req.params.username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: { ...user, password: undefined } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { avatar } = req.body;
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findByIdAndUpdate(
        req.user.userId,
        { avatar },
        { new: true }
      );
      res.json({ user: user.getPublicProfile() });
    } else {
      const authRoutes = require('./auth');
      const user = [...authRoutes.inMemoryUsers.values()].find(u => u.id === req.user.userId);
      if (user) {
        user.avatar = avatar;
      }
      res.json({ user: { ...user, password: undefined } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user stats
router.get('/stats/:username', async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findOne({ username: req.params.username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        username: user.username,
        stats: user.stats,
        ranking: user.ranking
      });
    } else {
      const authRoutes = require('./auth');
      const user = authRoutes.inMemoryUsers.get(req.params.username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        username: user.username,
        stats: user.stats,
        ranking: user.ranking
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const users = await User.find({
        username: { $regex: q, $options: 'i' }
      }).limit(10).select('username avatar ranking.tier ranking.points');
      
      res.json({ users });
    } else {
      const authRoutes = require('./auth');
      const users = [...authRoutes.inMemoryUsers.values()]
        .filter(u => u.username.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 10)
        .map(u => ({
          username: u.username,
          avatar: u.avatar,
          ranking: u.ranking
        }));
      
      res.json({ users });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
