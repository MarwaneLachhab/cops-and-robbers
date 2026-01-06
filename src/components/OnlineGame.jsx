import React, { useState, useEffect, useRef } from 'react';
import realtimeService from '../services/realtime';
import { parsePlayers } from '../utils/parsers';
import './OnlineGame.css';

// Game constants
const CELL_SIZE = 30;
const GAME_TICK = 50;

const MAPS = {
  easy: {
    width: 20,
    height: 15,
    walls: [
      ...Array.from({length: 20}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 20}, (_, i) => ({x: i, y: 14})),
      ...Array.from({length: 15}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 15}, (_, i) => ({x: 19, y: i})),
      {x: 5, y: 3}, {x: 5, y: 4}, {x: 5, y: 5},
      {x: 14, y: 3}, {x: 14, y: 4}, {x: 14, y: 5},
      {x: 5, y: 9}, {x: 5, y: 10}, {x: 5, y: 11},
      {x: 14, y: 9}, {x: 14, y: 10}, {x: 14, y: 11},
      {x: 8, y: 7}, {x: 9, y: 7}, {x: 10, y: 7}, {x: 11, y: 7},
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 17, y: 12},
    coins: [{x: 3, y: 7}, {x: 10, y: 3}, {x: 16, y: 7}, {x: 10, y: 11}, {x: 7, y: 5}]
  },
  medium: {
    width: 25,
    height: 18,
    walls: [
      ...Array.from({length: 25}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 25}, (_, i) => ({x: i, y: 17})),
      ...Array.from({length: 18}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 18}, (_, i) => ({x: 24, y: i})),
      {x: 6, y: 4}, {x: 7, y: 4}, {x: 8, y: 4}, {x: 8, y: 5}, {x: 8, y: 6},
      {x: 16, y: 4}, {x: 17, y: 4}, {x: 18, y: 4}, {x: 16, y: 5}, {x: 16, y: 6},
      {x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13},
      {x: 16, y: 11}, {x: 17, y: 11}, {x: 18, y: 11}, {x: 16, y: 12}, {x: 16, y: 13},
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 22, y: 15},
    coins: [{x: 4, y: 8}, {x: 12, y: 4}, {x: 20, y: 8}, {x: 12, y: 14}, {x: 4, y: 14}, {x: 20, y: 4}]
  },
  hard: {
    width: 30,
    height: 20,
    walls: [
      ...Array.from({length: 30}, (_, i) => ({x: i, y: 0})),
      ...Array.from({length: 30}, (_, i) => ({x: i, y: 19})),
      ...Array.from({length: 20}, (_, i) => ({x: 0, y: i})),
      ...Array.from({length: 20}, (_, i) => ({x: 29, y: i})),
      ...Array.from({length: 8}, (_, i) => ({x: 5, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 10, y: 10 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 15, y: 2 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 20, y: 10 + i})),
      ...Array.from({length: 8}, (_, i) => ({x: 25, y: 2 + i})),
    ],
    criminalStart: {x: 2, y: 2},
    copStart: {x: 27, y: 17},
    coins: [{x: 3, y: 10}, {x: 8, y: 5}, {x: 13, y: 10}, {x: 18, y: 5}, {x: 23, y: 10}, {x: 27, y: 5}, {x: 13, y: 15}]
  }
};

function OnlineGame({ room, user, onLeaveRoom }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [winner, setWinner] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [isHost, setIsHost] = useState(false);
  
  const keysPressed = useRef({});
  const gameLoopRef = useRef(null);
  const localGameState = useRef(null);

  const roomId = room.id;
  const mapName = room.map_name || 'easy';
  const map = MAPS[mapName] || MAPS.easy;

  // Initialize
  useEffect(() => {
    const roomPlayers = parsePlayers(room.players);
    setPlayers(roomPlayers);
    setIsHost(user.id === room.host_id);
    
    const me = roomPlayers.find(p => p.id === user.id);
    if (me?.role) setMyRole(me.role);

    realtimeService.subscribeRoom(roomId, {
      onRoomUpdate: (updatedRoom) => {
        const updatedPlayers = parsePlayers(updatedRoom.players);
        setPlayers(updatedPlayers);
        
        const me = updatedPlayers.find(p => p.id === user.id);
        if (me?.role) setMyRole(me.role);
        
        if (updatedRoom.status === 'playing' && gameStatus === 'waiting') {
          startGameCountdown();
        }
      },
      onRoomDeleted: () => {
        realtimeService.clearCurrentRoom();
        alert('Room was closed');
        onLeaveRoom();
      },
      onGameState: (state) => {
        setGameState(state);
        localGameState.current = state;
      },
      onGameStart: () => {
        console.log('onGameStart received');
        setCountdown(null);
        setGameStatus('playing');
      },
      onGameEnd: (data) => {
        console.log('onGameEnd received:', data);
        setWinner(data);
        setGameStatus('ended');
      },
      onPlayerInput: (input) => {
        if (isHost && localGameState.current) {
          processPlayerInput(input);
        }
      }
    });

    return () => {
      realtimeService.unsubscribeRoom();
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [roomId, user.id]);

  const handleReady = async () => {
    const newReady = !isReady;
    console.log('handleReady called, newReady:', newReady);
    setIsReady(newReady);
    
    // Update player ready status in DB
    await realtimeService.updatePlayer(roomId, user.id, { ready: newReady });
    
    // Fetch the latest room data to check if both players are ready
    const updatedRoom = await realtimeService.getRoom(roomId);
    if (!updatedRoom) {
      console.log('Failed to fetch room after ready update');
      return;
    }
    
    const updatedPlayers = parsePlayers(updatedRoom.players);
    console.log('After ready update, players:', updatedPlayers);
    
    if (updatedPlayers.length === 2 && updatedPlayers.every(p => p.ready)) {
      console.log('Both players ready!');
      
      // Assign roles if not already assigned
      if (!updatedPlayers[0].role) {
        console.log('Assigning roles...');
        const roles = Math.random() > 0.5 ? ['cop', 'criminal'] : ['criminal', 'cop'];
        await realtimeService.updatePlayer(roomId, updatedPlayers[0].id, { role: roles[0] });
        await realtimeService.updatePlayer(roomId, updatedPlayers[1].id, { role: roles[1] });
      }
      
      // Only host starts the game
      if (isHost) {
        console.log('Host starting game...');
        await realtimeService.startGame(roomId);
        startGameCountdown();
      } else {
        console.log('Not host, waiting for host to start game');
      }
    } else {
      console.log('Not both ready yet', { total: updatedPlayers.length, readyCount: updatedPlayers.filter(p => p.ready).length });
    }
  };

  const startGameCountdown = () => {
    setGameStatus('countdown');
    let count = 3;
    setCountdown(count);
    
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        setGameStatus('playing');
        if (isHost) initializeGame();
      }
    }, 1000);
  };

  const initializeGame = () => {
    const state = {
      criminal: { x: map.criminalStart.x, y: map.criminalStart.y, coins: 0,
        username: players.find(p => p.role === 'criminal')?.username || 'Criminal' },
      cop: { x: map.copStart.x, y: map.copStart.y,
        username: players.find(p => p.role === 'cop')?.username || 'Cop' },
      coins: [...map.coins],
      totalCoins: map.coins.length,
      timeRemaining: 60,
      status: 'playing'
    };
    
    localGameState.current = state;
    setGameState(state);
    realtimeService.broadcastGameState(state);
    
    gameLoopRef.current = setInterval(() => {
      if (localGameState.current?.status === 'playing') {
        localGameState.current.timeRemaining -= 0.05;
        checkWinConditions();
        realtimeService.broadcastGameState(localGameState.current);
      }
    }, GAME_TICK);
  };

  const processPlayerInput = (input) => {
    if (!localGameState.current) return;
    const { playerId, dx, dy } = input;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const entity = player.role === 'cop' ? localGameState.current.cop : localGameState.current.criminal;
    const newX = entity.x + dx;
    const newY = entity.y + dy;
    
    const isWall = map.walls.some(w => w.x === newX && w.y === newY);
    if (!isWall && newX >= 0 && newX < map.width && newY >= 0 && newY < map.height) {
      entity.x = newX;
      entity.y = newY;
      
      if (player.role === 'criminal') {
        const coinIdx = localGameState.current.coins.findIndex(c => c.x === newX && c.y === newY);
        if (coinIdx !== -1) {
          localGameState.current.coins.splice(coinIdx, 1);
          localGameState.current.criminal.coins++;
        }
      }
    }
  };

  const checkWinConditions = () => {
    if (!localGameState.current) return;
    const { cop, criminal, coins, timeRemaining } = localGameState.current;
    
    if (cop.x === criminal.x && cop.y === criminal.y) { endGame('cop'); return; }
    if (coins.length === 0) { endGame('criminal'); return; }
    if (timeRemaining <= 0) { endGame('cop'); return; }
  };

  const endGame = async (winnerRole) => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    localGameState.current.status = 'ended';
    
    const winnerPlayer = players.find(p => p.role === winnerRole);
    const winnerData = { role: winnerRole, username: winnerPlayer?.username || winnerRole };
    
    setWinner(winnerData);
    setGameStatus('ended');
    await realtimeService.endGame(roomId, winnerPlayer?.id, winnerRole);
  };

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStatus !== 'playing') return;
      const key = e.key.toLowerCase();
      if (!keysPressed.current[key]) {
        keysPressed.current[key] = true;
        let dx = 0, dy = 0;
        if (key === 'arrowup' || key === 'w' || key === 'z') dy = -1;
        if (key === 'arrowdown' || key === 's') dy = 1;
        if (key === 'arrowleft' || key === 'a' || key === 'q') dx = -1;
        if (key === 'arrowright' || key === 'd') dx = 1;
        
        if (dx !== 0 || dy !== 0) {
          realtimeService.sendPlayerInput({ playerId: user.id, dx, dy });
        }
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
    };
    const handleKeyUp = (e) => { keysPressed.current[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus, user.id]);

  // Render
  useEffect(() => {
    if (!canvasRef.current || !gameState) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = map.width * CELL_SIZE;
    canvas.height = map.height * CELL_SIZE;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Walls
    ctx.fillStyle = '#333355';
    map.walls.forEach(w => ctx.fillRect(w.x * CELL_SIZE, w.y * CELL_SIZE, CELL_SIZE, CELL_SIZE));
    
    // Coins
    if (gameState.coins) {
      gameState.coins.forEach(coin => {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(coin.x * CELL_SIZE + CELL_SIZE/2, coin.y * CELL_SIZE + CELL_SIZE/2, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // Criminal
    if (gameState.criminal) {
      const c = gameState.criminal;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE + CELL_SIZE/2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('🦹', c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE + CELL_SIZE/2 + 5);
      ctx.fillStyle = 'white'; ctx.font = '10px Arial';
      ctx.fillText(c.username, c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE - 10);
    }
    
    // Cop
    if (gameState.cop) {
      const c = gameState.cop;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.arc(c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE + CELL_SIZE/2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('👮', c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE + CELL_SIZE/2 + 5);
      ctx.fillStyle = 'white'; ctx.font = '10px Arial';
      ctx.fillText(c.username, c.x * CELL_SIZE + CELL_SIZE/2, c.y * CELL_SIZE - 10);
    }
  }, [gameState, map]);

  const handleLeave = async () => {
    await realtimeService.leaveRoom(roomId, user.id);
    realtimeService.clearCurrentRoom(); // Clear stored room
    onLeaveRoom();
  };

  const handlePlayAgain = () => {
    setGameStatus('waiting');
    setWinner(null);
    setIsReady(false);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
  };

  return (
    <div className="online-game-container">
      <header className="game-header">
        <div className="room-info">
          <h2>{room.name}</h2>
          <span className="map-badge">🗺️ {mapName}</span>
        </div>
        <button className="leave-btn" onClick={handleLeave}>🚪 Leave</button>
      </header>

      <div className="game-content">
        <div className="game-area">
          {gameStatus === 'waiting' && (
            <div className="waiting-screen">
              <h2>⏳ Waiting for Players</h2>
              <div className="players-list">
                {players.map((player, i) => (
                  <div key={player.id || i} className={`player-item ${player.role || ''}`}>
                    <span>{player.role === 'criminal' ? '🦹' : player.role === 'cop' ? '👮' : '❓'}</span>
                    <span>{player.username} {player.id === user.id && '(You)'}</span>
                    <span>{player.ready ? '✅' : '⏳'}</span>
                  </div>
                ))}
                {players.length < 2 && <div className="player-item empty">Waiting for opponent...</div>}
              </div>
              {players.length === 2 && (
                <button className={`ready-btn ${isReady ? 'ready' : ''}`} onClick={handleReady}>
                  {isReady ? '❌ Cancel' : '✅ Ready'}
                </button>
              )}
            </div>
          )}

          {gameStatus === 'countdown' && (
            <div className="countdown-screen">
              <div className="countdown-number">{countdown}</div>
              <p>Get Ready!</p>
            </div>
          )}

          {(gameStatus === 'playing' || gameStatus === 'ended') && (
            <div className="canvas-container">
              <canvas ref={canvasRef} />
              {gameState && (
                <div className="game-stats-overlay">
                  <span>💰 {gameState.criminal?.coins || 0}/{gameState.totalCoins}</span>
                  <span>⏱️ {Math.ceil(gameState.timeRemaining || 0)}s</span>
                  <span>You: {myRole === 'cop' ? '👮' : '🦹'}</span>
                </div>
              )}
            </div>
          )}

          {gameStatus === 'ended' && winner && (
            <div className="game-over-overlay">
              <div className="game-over-content">
                <h2>{winner.role === myRole ? '🎉 Victory!' : '😢 Defeat'}</h2>
                <p>Winner: {winner.username}</p>
                <div className="end-actions">
                  <button onClick={handlePlayAgain}>🔄 Again</button>
                  <button onClick={handleLeave}>🚪 Leave</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="controls-info">
        <p>Use <strong>Arrow Keys</strong> or <strong>WASD</strong> to move</p>
      </div>
    </div>
  );
}

export default OnlineGame;
