import React, { useState, useEffect, useRef } from 'react';
import realtimeService from '../services/realtime';
import apiService from '../services/api';
import Social from './Social';
import './Lobby.css';

function Lobby({ user, onJoinRoom, onCreateRoom, onLogout, onPlayLocal }) {
  const [rooms, setRooms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMap, setNewRoomMap] = useState('easy');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [activeTab, setActiveTab] = useState('rooms');
  const [loading, setLoading] = useState(true);
  const [showSocial, setShowSocial] = useState(false);
  
  // Refs to prevent duplicate subscriptions
  const subscriptionDone = useRef(false);

  useEffect(() => {
    // Prevent duplicate subscriptions
    if (subscriptionDone.current) return;
    subscriptionDone.current = true;
    
    // Subscribe to lobby updates via Supabase Realtime
    realtimeService.subscribeLobby((roomsList) => {
      // Transform rooms to expected format
      const formattedRooms = roomsList.map(room => ({
        id: room.id,
        name: room.name,
        hostId: room.host_id,
        mapName: room.map_name,
        isPrivate: room.is_private,
        status: room.status,
        players: JSON.parse(room.players || '[]'),
        playerCount: JSON.parse(room.players || '[]').length
      }));
      setRooms(formattedRooms);
      setLoading(false);
    });
    
    loadLeaderboard();

    return () => {
      realtimeService.unsubscribeLobby();
      subscriptionDone.current = false;
    };
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await apiService.getLeaderboard(10);
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.log('Could not load leaderboard');
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    const room = await realtimeService.createRoom(
      user.id,
      user.username,
      newRoomName,
      newRoomMap,
      newRoomPrivate,
      newRoomPrivate ? newRoomPassword : null
    );

    if (room) {
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomPassword('');
      onJoinRoom(room);
    } else {
      alert('Failed to create room');
    }
  };

  const handleJoinRoom = async (room) => {
    if (room.isPrivate) {
      setJoiningRoom(room);
    } else {
      const result = await realtimeService.joinRoom(room.id, user.id, user.username);
      if (result.success) {
        onJoinRoom(result.room);
      } else {
        alert(result.error);
      }
    }
  };

  const confirmJoinPrivateRoom = async () => {
    const result = await realtimeService.joinRoom(
      joiningRoom.id, 
      user.id, 
      user.username, 
      joinPassword
    );
    
    if (result.success) {
      onJoinRoom(result.room);
    } else {
      alert(result.error);
    }
    
    setJoiningRoom(null);
    setJoinPassword('');
  };

  const getTierColor = (tier) => {
    const colors = {
      'Bronze': '#cd7f32',
      'Silver': '#c0c0c0',
      'Gold': '#ffd700',
      'Platinum': '#e5e4e2',
      'Diamond': '#b9f2ff',
      'Master': '#ff6b6b',
      'Legend': '#ff00ff'
    };
    return colors[tier] || '#fff';
  };

  const getTierIcon = (tier) => {
    const icons = {
      'Bronze': '🥉',
      'Silver': '🥈',
      'Gold': '🥇',
      'Platinum': '💎',
      'Diamond': '💠',
      'Master': '👑',
      'Legend': '🏆'
    };
    return icons[tier] || '🎮';
  };

  return (
    <div className="lobby-container">
      {/* Header */}
      <header className="lobby-header">
        <h1>🚔 COPS & ROBBERS 💰</h1>
        <div className="user-info">
          <div className="user-stats">
            <span className="username">{user?.username || 'Guest'}</span>
            <span className="tier" style={{ color: getTierColor(user?.ranking?.tier) }}>
              {getTierIcon(user?.ranking?.tier)} {user?.ranking?.tier || 'Bronze'}
            </span>
            <span className="points">{user?.ranking?.points || 1000} pts</span>
          </div>
          <button className="social-btn" onClick={() => setShowSocial(true)}>👥 Friends</button>
          <button className="logout-btn" onClick={onLogout}>🚪 Logout</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="lobby-content">
        {/* Tabs */}
        <div className="lobby-tabs">
          <button 
            className={activeTab === 'rooms' ? 'active' : ''} 
            onClick={() => setActiveTab('rooms')}
          >
            🎮 Game Rooms
          </button>
          <button 
            className={activeTab === 'leaderboard' ? 'active' : ''} 
            onClick={() => { setActiveTab('leaderboard'); loadLeaderboard(); }}
          >
            🏆 Leaderboard
          </button>
          <button 
            className={activeTab === 'profile' ? 'active' : ''} 
            onClick={() => setActiveTab('profile')}
          >
            👤 My Profile
          </button>
        </div>

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="rooms-section">
            <div className="rooms-header">
              <h2>🎮 Available Rooms</h2>
              <div className="rooms-actions">
                <button className="create-room-btn" onClick={() => setShowCreateModal(true)}>
                  ➕ Create Room
                </button>
                <button className="play-local-btn" onClick={onPlayLocal}>
                  🎮 Play Offline
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="no-rooms">
                <p>No rooms available</p>
                <p>Create one to start playing!</p>
              </div>
            ) : (
              <div className="rooms-list">
                {rooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-info">
                      <h3>{room.name}</h3>
                      <div className="room-details">
                        <span>🗺️ {room.mapName || 'easy'}</span>
                        <span>👥 {room.playerCount}/2</span>
                        {room.isPrivate && <span>🔒</span>}
                        <span className={`status-${room.status}`}>
                          {room.status === 'waiting' ? '⏳ Waiting' : '🎮 Playing'}
                        </span>
                      </div>
                      <p className="room-host">Host: {room.players[0]?.username || 'Unknown'}</p>
                    </div>
                    <button 
                      className="join-btn"
                      onClick={() => handleJoinRoom(room)}
                      disabled={room.playerCount >= 2 || room.status === 'playing'}
                    >
                      {room.playerCount >= 2 ? 'Full' : room.status === 'playing' ? 'In Game' : 'Join'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="leaderboard-section">
            <h2>🏆 Top Players</h2>
            <div className="leaderboard-list">
              {leaderboard.map((player, index) => (
                <div key={player.username} className={`leaderboard-item rank-${index + 1}`}>
                  <span className="rank">#{player.rank}</span>
                  <span className="player-name">{player.username}</span>
                  <span className="tier-badge" style={{ color: getTierColor(player.tier) }}>
                    {getTierIcon(player.tier)} {player.tier}
                  </span>
                  <span className="points">{player.points} pts</span>
                  <span className="wins">{player.gamesWon}W</span>
                  <span className="winrate">{player.winRate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="profile-section">
            <h2>👤 My Profile</h2>
            <div className="profile-card">
              <div className="profile-header">
                <div className="avatar">👤</div>
                <div className="profile-info">
                  <h3>{user?.username || 'Guest'}</h3>
                  <span className="tier-large" style={{ color: getTierColor(user?.ranking?.tier) }}>
                    {getTierIcon(user?.ranking?.tier)} {user?.ranking?.tier || 'Bronze'}
                  </span>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-value">{user?.ranking?.points || 1000}</span>
                  <span className="stat-label">Points</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{user?.stats?.gamesPlayed || 0}</span>
                  <span className="stat-label">Games</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{user?.stats?.gamesWon || 0}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">
                    {user?.stats?.gamesPlayed > 0 
                      ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100) 
                      : 0}%
                  </span>
                  <span className="stat-label">Win Rate</span>
                </div>
              </div>

              <div className="role-stats">
                <div className="role-stat criminal">
                  <h4>🔴 As Criminal</h4>
                  <p>Games: {user?.stats?.criminalGames || 0}</p>
                  <p>Wins: {user?.stats?.criminalWins || 0}</p>
                  <p>Escapes: {user?.stats?.totalEscapes || 0}</p>
                  <p>Coins: {user?.stats?.totalCoinsCollected || 0}</p>
                </div>
                <div className="role-stat cop">
                  <h4>🔵 As Cop</h4>
                  <p>Games: {user?.stats?.copGames || 0}</p>
                  <p>Wins: {user?.stats?.copWins || 0}</p>
                  <p>Catches: {user?.stats?.totalCatches || 0}</p>
                </div>
              </div>

              <div className="streak-info">
                <p>🔥 Current Streak: {user?.ranking?.winStreak || 0}</p>
                <p>⭐ Best Streak: {user?.ranking?.bestWinStreak || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Create Room</h2>
            
            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label>Map</label>
              <select value={newRoomMap} onChange={(e) => setNewRoomMap(e.target.value)}>
                <option value="easy">⭐ Training Ground</option>
                <option value="medium">⭐⭐ City Streets</option>
                <option value="hard">⭐⭐⭐ Maximum Security</option>
              </select>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={newRoomPrivate}
                  onChange={(e) => setNewRoomPrivate(e.target.checked)}
                />
                Private Room
              </label>
            </div>

            {newRoomPrivate && (
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            )}

            <div className="modal-actions">
              <button onClick={handleCreateRoom}>Create</button>
              <button onClick={() => setShowCreateModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Join Private Room Modal */}
      {joiningRoom && (
        <div className="modal-overlay" onClick={() => setJoiningRoom(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🔒 Enter Password</h2>
            
            <div className="form-group">
              <input
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Room password"
              />
            </div>

            <div className="modal-actions">
              <button onClick={confirmJoinPrivateRoom}>Join</button>
              <button onClick={() => setJoiningRoom(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Social/Friends Modal */}
      {showSocial && (
        <Social user={user} onClose={() => setShowSocial(false)} />
      )}
    </div>
  );
}

export default Lobby;
