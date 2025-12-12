const mongoose = require('mongoose');

// ELO-based ranking system
class RankingSystem {
  constructor() {
    this.K_FACTOR = 32; // How much points can change per game
    this.BASE_POINTS = 25;
  }

  // Calculate expected score (ELO formula)
  getExpectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  // Calculate points change for a player
  calculatePointsChange(playerRating, opponentRating, won, bonuses = {}) {
    const expected = this.getExpectedScore(playerRating, opponentRating);
    const actual = won ? 1 : 0;
    
    let change = Math.round(this.K_FACTOR * (actual - expected));
    
    // Apply bonuses
    if (won) {
      // Fast win bonus
      if (bonuses.fastWin) {
        change += Math.round(change * 0.2);
      }
      // Perfect game bonus (criminal collected all coins fast)
      if (bonuses.perfectGame) {
        change += 10;
      }
      // Win streak bonus
      if (bonuses.winStreak && bonuses.winStreak >= 3) {
        change += Math.min(bonuses.winStreak * 2, 20);
      }
      // Underdog bonus (beating higher ranked player)
      if (opponentRating - playerRating > 100) {
        change += Math.round((opponentRating - playerRating) / 50);
      }
    } else {
      // Minimum loss
      change = Math.min(change, -5);
      // Reduce loss for close games
      if (bonuses.closeGame) {
        change = Math.round(change * 0.7);
      }
    }

    // Ensure minimum change
    if (won && change < this.BASE_POINTS / 2) {
      change = Math.round(this.BASE_POINTS / 2);
    }

    return change;
  }

  // Get tier from points
  getTier(points) {
    if (points >= 3000) return 'Legend';
    if (points >= 2500) return 'Master';
    if (points >= 2000) return 'Diamond';
    if (points >= 1500) return 'Platinum';
    if (points >= 1200) return 'Gold';
    if (points >= 1000) return 'Silver';
    return 'Bronze';
  }

  // Calculate game result and update rankings
  async calculateGameResult(criminal, cop, winner, gameData) {
    const isMongoConnected = mongoose.connection.readyState === 1;
    const User = require('../models/User');
    const authRoutes = require('../routes/auth');

    let criminalData, copData;

    // Get player data
    if (isMongoConnected) {
      criminalData = await User.findById(criminal.userId);
      copData = await User.findById(cop.userId);
    } else {
      criminalData = [...authRoutes.inMemoryUsers.values()].find(u => u.id === criminal.userId);
      copData = [...authRoutes.inMemoryUsers.values()].find(u => u.id === cop.userId);
    }

    if (!criminalData || !copData) {
      console.log('Could not find player data for ranking update');
      return null;
    }

    const criminalRating = criminalData.ranking?.points || 1000;
    const copRating = copData.ranking?.points || 1000;

    // Determine bonuses
    const bonuses = {
      fastWin: gameData.gameTime < gameData.timeLimit * 0.5,
      perfectGame: winner === 'criminal' && gameData.coinsCollected === gameData.totalCoins && gameData.gameTime < 60,
      closeGame: gameData.gameTime > gameData.timeLimit * 0.8
    };

    // Calculate points changes
    const criminalWon = winner === 'criminal';
    const criminalChange = this.calculatePointsChange(
      criminalRating, 
      copRating, 
      criminalWon, 
      { ...bonuses, winStreak: criminalWon ? (criminalData.ranking?.winStreak || 0) + 1 : 0 }
    );
    const copChange = this.calculatePointsChange(
      copRating, 
      criminalRating, 
      !criminalWon,
      { ...bonuses, winStreak: !criminalWon ? (copData.ranking?.winStreak || 0) + 1 : 0 }
    );

    // Update player stats
    const criminalNewPoints = Math.max(0, criminalRating + criminalChange);
    const copNewPoints = Math.max(0, copRating + copChange);

    if (isMongoConnected) {
      // Update criminal
      await User.findByIdAndUpdate(criminal.userId, {
        $inc: {
          'stats.gamesPlayed': 1,
          'stats.gamesWon': criminalWon ? 1 : 0,
          'stats.gamesLost': criminalWon ? 0 : 1,
          'stats.criminalGames': 1,
          'stats.criminalWins': criminalWon ? 1 : 0,
          'stats.totalCoinsCollected': gameData.coinsCollected,
          'stats.totalEscapes': criminalWon ? 1 : 0,
          'ranking.seasonWins': criminalWon ? 1 : 0
        },
        $set: {
          'ranking.points': criminalNewPoints,
          'ranking.tier': this.getTier(criminalNewPoints),
          'ranking.winStreak': criminalWon ? (criminalData.ranking?.winStreak || 0) + 1 : 0,
          'ranking.bestWinStreak': criminalWon 
            ? Math.max((criminalData.ranking?.bestWinStreak || 0), (criminalData.ranking?.winStreak || 0) + 1)
            : criminalData.ranking?.bestWinStreak || 0
        }
      });

      // Update cop
      await User.findByIdAndUpdate(cop.userId, {
        $inc: {
          'stats.gamesPlayed': 1,
          'stats.gamesWon': criminalWon ? 0 : 1,
          'stats.gamesLost': criminalWon ? 1 : 0,
          'stats.copGames': 1,
          'stats.copWins': criminalWon ? 0 : 1,
          'stats.totalCatches': criminalWon ? 0 : 1,
          'ranking.seasonWins': criminalWon ? 0 : 1
        },
        $set: {
          'ranking.points': copNewPoints,
          'ranking.tier': this.getTier(copNewPoints),
          'ranking.winStreak': !criminalWon ? (copData.ranking?.winStreak || 0) + 1 : 0,
          'ranking.bestWinStreak': !criminalWon 
            ? Math.max((copData.ranking?.bestWinStreak || 0), (copData.ranking?.winStreak || 0) + 1)
            : copData.ranking?.bestWinStreak || 0
        }
      });
    } else {
      // Update in-memory
      if (criminalData) {
        criminalData.stats.gamesPlayed++;
        criminalData.stats.criminalGames++;
        criminalData.stats.totalCoinsCollected += gameData.coinsCollected;
        if (criminalWon) {
          criminalData.stats.gamesWon++;
          criminalData.stats.criminalWins++;
          criminalData.stats.totalEscapes++;
          criminalData.ranking.winStreak++;
          criminalData.ranking.bestWinStreak = Math.max(criminalData.ranking.bestWinStreak, criminalData.ranking.winStreak);
        } else {
          criminalData.stats.gamesLost++;
          criminalData.ranking.winStreak = 0;
        }
        criminalData.ranking.points = criminalNewPoints;
        criminalData.ranking.tier = this.getTier(criminalNewPoints);
      }

      if (copData) {
        copData.stats.gamesPlayed++;
        copData.stats.copGames++;
        if (!criminalWon) {
          copData.stats.gamesWon++;
          copData.stats.copWins++;
          copData.stats.totalCatches++;
          copData.ranking.winStreak++;
          copData.ranking.bestWinStreak = Math.max(copData.ranking.bestWinStreak, copData.ranking.winStreak);
        } else {
          copData.stats.gamesLost++;
          copData.ranking.winStreak = 0;
        }
        copData.ranking.points = copNewPoints;
        copData.ranking.tier = this.getTier(copNewPoints);
      }
    }

    return {
      criminal: {
        username: criminal.username,
        pointsChange: criminalChange,
        newPoints: criminalNewPoints,
        newTier: this.getTier(criminalNewPoints),
        won: criminalWon
      },
      cop: {
        username: cop.username,
        pointsChange: copChange,
        newPoints: copNewPoints,
        newTier: this.getTier(copNewPoints),
        won: !criminalWon
      }
    };
  }
}

module.exports = RankingSystem;
