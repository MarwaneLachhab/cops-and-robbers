const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Get global leaderboard
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'points' } = req.query;
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    let sortField = {};
    switch (sortBy) {
      case 'wins':
        sortField = { 'stats.gamesWon': -1 };
        break;
      case 'winrate':
        sortField = { 'stats.gamesWon': -1 };
        break;
      case 'streak':
        sortField = { 'ranking.bestWinStreak': -1 };
        break;
      default:
        sortField = { 'ranking.points': -1 };
    }

    if (isMongoConnected) {
      const users = await User.find()
        .sort(sortField)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .select('username avatar stats ranking');

      const leaderboard = users.map((user, index) => ({
        rank: parseInt(offset) + index + 1,
        username: user.username,
        avatar: user.avatar,
        points: user.ranking.points,
        tier: user.ranking.tier,
        gamesPlayed: user.stats.gamesPlayed,
        gamesWon: user.stats.gamesWon,
        winRate: user.stats.gamesPlayed > 0 
          ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100) 
          : 0,
        winStreak: user.ranking.winStreak,
        bestWinStreak: user.ranking.bestWinStreak
      }));

      const total = await User.countDocuments();

      res.json({ leaderboard, total, limit: parseInt(limit), offset: parseInt(offset) });
    } else {
      // In-memory fallback
      const authRoutes = require('./auth');
      let users = [...authRoutes.inMemoryUsers.values()];
      
      // Sort
      users.sort((a, b) => {
        switch (sortBy) {
          case 'wins':
            return b.stats.gamesWon - a.stats.gamesWon;
          case 'streak':
            return b.ranking.bestWinStreak - a.ranking.bestWinStreak;
          default:
            return b.ranking.points - a.ranking.points;
        }
      });

      users = users.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      const leaderboard = users.map((user, index) => ({
        rank: parseInt(offset) + index + 1,
        username: user.username,
        avatar: user.avatar,
        points: user.ranking.points,
        tier: user.ranking.tier,
        gamesPlayed: user.stats.gamesPlayed,
        gamesWon: user.stats.gamesWon,
        winRate: user.stats.gamesPlayed > 0 
          ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100) 
          : 0,
        winStreak: user.ranking.winStreak,
        bestWinStreak: user.ranking.bestWinStreak
      }));

      res.json({ 
        leaderboard, 
        total: authRoutes.inMemoryUsers.size, 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      });
    }
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get user rank
router.get('/rank/:username', async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    if (isMongoConnected) {
      const user = await User.findOne({ username: req.params.username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const rank = await User.countDocuments({
        'ranking.points': { $gt: user.ranking.points }
      }) + 1;

      res.json({
        username: user.username,
        rank,
        points: user.ranking.points,
        tier: user.ranking.tier
      });
    } else {
      const authRoutes = require('./auth');
      const user = authRoutes.inMemoryUsers.get(req.params.username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const users = [...authRoutes.inMemoryUsers.values()];
      users.sort((a, b) => b.ranking.points - a.ranking.points);
      const rank = users.findIndex(u => u.username === req.params.username) + 1;

      res.json({
        username: user.username,
        rank,
        points: user.ranking.points,
        tier: user.ranking.tier
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tier distribution
router.get('/tiers', async (req, res) => {
  try {
    const isMongoConnected = require('mongoose').connection.readyState === 1;

    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Legend'];
    const distribution = {};

    if (isMongoConnected) {
      for (const tier of tiers) {
        distribution[tier] = await User.countDocuments({ 'ranking.tier': tier });
      }
    } else {
      const authRoutes = require('./auth');
      const users = [...authRoutes.inMemoryUsers.values()];
      
      tiers.forEach(tier => {
        distribution[tier] = users.filter(u => u.ranking.tier === tier).length;
      });
    }

    res.json({ distribution });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
