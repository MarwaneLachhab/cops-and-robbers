import React, { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socket';
import './OnlineGame.css';

// Game constants
const CELL_SIZE = 30;
const POWER_UP_DURATION = 5000;

const MAPS = {
  easy: {
    width: 20,
    height: 15,
    walls: [
      // Border walls
      ...Array.from({length: 20}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 20}, (_, i) => ({x: i, y: 14})),
      ...Array.from({length: 15}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 15}, (_, i) => ({x: 19, y: i})),
      // Inner walls
      {x: 5, y: 3}, {x: 5, y: 4}, {x: 5, y: 5},
      {x: 14, y: 3}, {x: 14, y: 4}, {x: 14, y: 5},
      {x: 5, y: 9}, {x: 5, y: 10}, {x: 5, y: 11},
      {x: 14, y: 9}, {x: 14, y: 10}, {x: 14, y: 11},
      {x: 8, y: 7}, {x: 9, y: 7}, {x: 10, y: 7}, {x: 11, y: 7},
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 17, y: 12}
  },
  medium: {
    width: 25,
    height: 18,
    walls: [
      ...Array.from({length: 25}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 25}, (_, i) => ({x: i, y: 17})),
      ...Array.from({length: 18}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 18}, (_, i) => ({x: 24, y: i})),
      // L-shapes and corridors
      {x: 6, y: 4}, {x: 7, y: 4}, {x: 8, y: 4}, {x: 8, y: 5}, {x: 8, y: 6},
      {x: 16, y: 4}, {x: 17, y: 4}, {x: 18, y: 4}, {x: 16, y: 5}, {x: 16, y: 6},
      {x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13},
      {x: 16, y: 11}, {x: 17, y: 11}, {x: 18, y: 11}, {x: 16, y: 12}, {x: 16, y: 13},
      {x: 11, y: 7}, {x: 12, y: 7}, {x: 13, y: 7}, {x: 11, y: 8}, {x: 13, y: 8},
      {x: 11, y: 9}, {x: 12, y: 9}, {x: 13, y: 9},
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 22, y: 15}
  },
  hard: {
    width: 30,
    height: 20,
    walls: [
      ...Array.from({length: 30}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 30}, (_, i) => ({x: i, y: 19})),
      ...Array.from({length: 20}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 20}, (_, i) => ({x: 29, y: i})),
      // Complex maze
      ...Array.from({length: 8}, (_, i) => ({x: 5, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 10, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 15, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 20, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 25, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 5, y: 11 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 10, y: 11 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 15, y: 11 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 20, y: 11 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 25, y: 11 + i})),
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 27, y: 17}
  }
};

function OnlineGame({ room, user, onLeaveRoom }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, countdown, playing, ended
  const [winner, setWinner] = useState(null);
  const [players, setPlayers] = useState(room.players || []);
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [myRole, setMyRole] = useState(null);
  
  const keysPressed = useRef({});
  const lastMoveTime = useRef(0);
  const MOVE_COOLDOWN = 80;

  // Determine player's role
  useEffect(() => {
    const me = room.players.find(p => p.oderId === user?._id || p.oderId === user?.id || p.username === user?.username);
    if (me) {
      setMyRole(me.role);
    }
  }, [room.players, user]);

  // Socket event handlers
  useEffect(() => {
    // Game state updates
    socketService.on('game-state', (state) => {
      setGameState(state);
      setGameStatus('playing');
    });

    socketService.on('countdown', (count) => {
      setCountdown(count);
      setGameStatus('countdown');
    });

    socketService.on('game-start', () => {
      setCountdown(null);
      setGameStatus('playing');
    });

    socketService.on('game-end', ({ winner: winnerData, stats }) => {
      setWinner(winnerData);
      setGameStatus('ended');
    });

    socketService.on('player-joined', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    });

    socketService.on('player-left', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    });

    socketService.on('player-ready', ({ playerId, ready }) => {
      setPlayers(prev => prev.map(p => 
        p.userId === playerId ? { ...p, isReady: ready } : p
      ));
    });

    socketService.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socketService.off('game-state');
      socketService.off('countdown');
      socketService.off('game-start');
      socketService.off('game-end');
      socketService.off('player-joined');
      socketService.off('player-left');
      socketService.off('player-ready');
      socketService.off('chat-message');
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStatus !== 'playing') return;
      
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      
      // Prevent default for arrow keys
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'z', 'q'].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus]);

  // Game loop for sending moves
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const gameLoop = setInterval(() => {
      const now = Date.now();
      if (now - lastMoveTime.current < MOVE_COOLDOWN) return;

      let dx = 0, dy = 0;
      const keys = keysPressed.current;

      // Arrow keys or WASD/ZQSD
      if (keys['arrowup'] || keys['w'] || keys['z']) dy = -1;
      if (keys['arrowdown'] || keys['s']) dy = 1;
      if (keys['arrowleft'] || keys['a'] || keys['q']) dx = -1;
      if (keys['arrowright'] || keys['d']) dx = 1;

      if (dx !== 0 || dy !== 0) {
        socketService.emit('player-move', {
          roomId: room.roomId,
          dx,
          dy
        });
        lastMoveTime.current = now;
      }
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameStatus, room.roomId]);

  // Render game
  useEffect(() => {
    if (!canvasRef.current || !gameState) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const map = MAPS[room.map || 'easy'];

    canvas.width = map.width * CELL_SIZE;
    canvas.height = map.height * CELL_SIZE;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 0; x <= map.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= map.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(canvas.width, y * CELL_SIZE);
      ctx.stroke();
    }

    // Draw walls
    ctx.fillStyle = '#333355';
    map.walls.forEach(wall => {
      ctx.fillRect(wall.x * CELL_SIZE, wall.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      // Add 3D effect
      ctx.fillStyle = '#444466';
      ctx.fillRect(wall.x * CELL_SIZE, wall.y * CELL_SIZE, CELL_SIZE - 2, 2);
      ctx.fillRect(wall.x * CELL_SIZE, wall.y * CELL_SIZE, 2, CELL_SIZE - 2);
      ctx.fillStyle = '#222244';
      ctx.fillRect(wall.x * CELL_SIZE + CELL_SIZE - 2, wall.y * CELL_SIZE, 2, CELL_SIZE);
      ctx.fillRect(wall.x * CELL_SIZE, wall.y * CELL_SIZE + CELL_SIZE - 2, CELL_SIZE, 2);
      ctx.fillStyle = '#333355';
    });

    // Draw coins
    if (gameState.coins) {
      gameState.coins.forEach(coin => {
        const centerX = coin.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = coin.y * CELL_SIZE + CELL_SIZE / 2;
        
        // Glow effect
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 15);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(coin.x * CELL_SIZE - 5, coin.y * CELL_SIZE - 5, CELL_SIZE + 10, CELL_SIZE + 10);
        
        // Coin
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffed4a';
        ctx.beginPath();
        ctx.arc(centerX - 2, centerY - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw power-ups
    if (gameState.powerUps) {
      gameState.powerUps.forEach(powerUp => {
        const centerX = powerUp.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = powerUp.y * CELL_SIZE + CELL_SIZE / 2;
        
        let color = '#00ff00';
        let icon = '?';
        
        switch (powerUp.type) {
          case 'speed':
            color = '#00ffff';
            icon = '⚡';
            break;
          case 'invisible':
            color = '#9966ff';
            icon = '👻';
            break;
          case 'freeze':
            color = '#00aaff';
            icon = '❄️';
            break;
          case 'taser':
            color = '#ffff00';
            icon = '⚡';
            break;
        }
        
        // Glow
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 18);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, centerX, centerY);
      });
    }

    // Draw players
    if (gameState.criminal) {
      const criminal = gameState.criminal;
      const centerX = criminal.x * CELL_SIZE + CELL_SIZE / 2;
      const centerY = criminal.y * CELL_SIZE + CELL_SIZE / 2;
      
      // Skip if invisible (but show to criminal player)
      if (!criminal.invisible || myRole === 'criminal') {
        // Glow
        ctx.fillStyle = criminal.invisible ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 68, 68, 0.5)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = criminal.invisible ? 'rgba(255, 68, 68, 0.5)' : '#ff4444';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦹', centerX, centerY);
        
        // Name tag
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(criminal.username || 'Criminal', centerX, centerY - 20);
      }
    }

    if (gameState.cop) {
      const cop = gameState.cop;
      const centerX = cop.x * CELL_SIZE + CELL_SIZE / 2;
      const centerY = cop.y * CELL_SIZE + CELL_SIZE / 2;
      
      // Glow
      ctx.fillStyle = 'rgba(68, 136, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
      ctx.fill();
      
      // Body
      ctx.fillStyle = cop.frozen ? '#88bbff' : '#4488ff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Icon
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cop.frozen ? '🥶' : '👮', centerX, centerY);
      
      // Name tag
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.fillText(cop.username || 'Cop', centerX, centerY - 20);
    }

  }, [gameState, room.map, myRole]);

  const handleReady = () => {
    setIsReady(!isReady);
    socketService.emit('player-ready', {
      roomId: room.roomId,
      ready: !isReady
    });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    socketService.emit('chat-message', {
      roomId: room.roomId,
      message: chatInput
    });
    setChatInput('');
  };

  const handleLeave = () => {
    socketService.emit('leave-room', { roomId: room.roomId });
    onLeaveRoom();
  };

  const handlePlayAgain = () => {
    setGameStatus('waiting');
    setWinner(null);
    setIsReady(false);
  };

  return (
    <div className="online-game-container">
      {/* Header */}
      <header className="game-header">
        <div className="room-info">
          <h2>{room.name}</h2>
          <span className="map-badge">🗺️ {room.map}</span>
        </div>
        <button className="leave-btn" onClick={handleLeave}>
          🚪 Leave Room
        </button>
      </header>

      <div className="game-content">
        {/* Main Game Area */}
        <div className="game-area">
          {/* Waiting Screen */}
          {gameStatus === 'waiting' && (
            <div className="waiting-screen">
              <h2>⏳ Waiting for Players</h2>
              <div className="players-list">
                {players.map((player, index) => (
                  <div key={player.oderId || player.oderId || index} className={`player-item ${player.role}`}>
                    <span className="role-icon">
                      {player.role === 'criminal' ? '🦹' : '👮'}
                    </span>
                    <span className="player-name">{player.username}</span>
                    <span className={`ready-status ${player.isReady ? 'ready' : ''}`}>
                      {player.isReady ? '✅ Ready' : '⏳ Not Ready'}
                    </span>
                  </div>
                ))}
                {players.length < 2 && (
                  <div className="player-item empty">
                    <span>Waiting for opponent...</span>
                  </div>
                )}
              </div>
              
              <button 
                className={`ready-btn ${isReady ? 'ready' : ''}`}
                onClick={handleReady}
              >
                {isReady ? '❌ Cancel Ready' : '✅ Ready'}
              </button>
              
              <p className="hint">
                Both players must be ready to start the game
              </p>
            </div>
          )}

          {/* Countdown Screen */}
          {gameStatus === 'countdown' && (
            <div className="countdown-screen">
              <div className="countdown-number">{countdown}</div>
              <p>Get Ready!</p>
            </div>
          )}

          {/* Game Canvas */}
          {(gameStatus === 'playing' || gameStatus === 'ended') && (
            <div className="canvas-container">
              <canvas ref={canvasRef} />
              
              {/* Game Stats Overlay */}
              {gameState && (
                <div className="game-stats-overlay">
                  <div className="stat-item">
                    <span>💰 Coins: {gameState.criminal?.coins || 0}/{gameState.totalCoins || 10}</span>
                  </div>
                  <div className="stat-item">
                    <span>⏱️ Time: {gameState.timeRemaining || 60}s</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Game Over Screen */}
          {gameStatus === 'ended' && winner && (
            <div className="game-over-overlay">
              <div className="game-over-content">
                <h2>{winner.role === myRole ? '🎉 Victory!' : '😢 Defeat'}</h2>
                <p>
                  {winner.role === 'criminal' 
                    ? '🦹 Criminal escaped with the loot!' 
                    : '👮 Cop caught the criminal!'}
                </p>
                <p className="winner-name">Winner: {winner.username}</p>
                
                <div className="end-stats">
                  <p>Coins Collected: {gameState?.criminal?.coins || 0}</p>
                  <p>Time Remaining: {gameState?.timeRemaining || 0}s</p>
                </div>
                
                <div className="end-actions">
                  <button onClick={handlePlayAgain}>🔄 Play Again</button>
                  <button onClick={handleLeave}>🚪 Leave</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          <h3>💬 Chat</h3>
          <div className="messages-list">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.userId === user._id ? 'own' : ''}`}>
                <span className="sender">{msg.username}:</span>
                <span className="text">{msg.message}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="chat-input">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={100}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>

      {/* Controls Info */}
      <div className="controls-info">
        <p>Use <strong>Arrow Keys</strong> or <strong>WASD/ZQSD</strong> to move</p>
      </div>
    </div>
  );
}

export default OnlineGame;
