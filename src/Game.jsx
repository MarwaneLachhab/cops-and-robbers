import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Game.css';

// Game constants
const PLAYER_SIZE = 28;
const PLAYER_SPEED = 4;
const COP_SPEED = 3.8;

// Power-up types for CRIMINAL ONLY
const CRIMINAL_POWERUPS = {
  SPEED: { color: '#00ff88', icon: '⚡', duration: 5000, name: 'SPEED BOOST', desc: '+60% speed for 5s' },
  INVISIBILITY: { color: '#aa44ff', icon: '👻', duration: 3000, name: 'INVISIBILITY', desc: 'Invisible for 3s' },
  FREEZE: { color: '#00ffff', icon: '❄️', duration: 2000, name: 'FREEZE COP', desc: 'Freeze cop for 2s' },
};

// Power-up types for COP ONLY
const COP_POWERUPS = {
  TASER: { color: '#ff0000', icon: '⚡', duration: 3000, name: 'TASER MODE', desc: 'Can catch invisible!' },
  SPEED: { color: '#ffaa00', icon: '🏃', duration: 4000, name: 'SPEED BOOST', desc: '+50% speed for 4s' },
};

// ALL GAME ITEMS for legend
const ALL_ITEMS = {
  coin: { icon: '💰', name: 'COIN', desc: 'Collect all to unlock exit', color: '#ffd700' },
  teleporter: { icon: '🌀', name: 'TELEPORTER', desc: 'Instant teleport!', color: '#ff00ff' },
  exit: { icon: '🚪', name: 'EXIT', desc: 'Escape after all coins!', color: '#00ff64' },
};

// ===== SOUND SYSTEM =====
class SoundManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.log('Audio not supported');
    }
  }

  play(type) {
    if (!this.initialized || !this.audioContext) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    try {
      switch(type) {
        case 'coin': {
          // Cheerful coin sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }
        case 'powerup': {
          // Power-up collect sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
          osc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }
        case 'teleport': {
          // Teleport whoosh
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }
        case 'catch': {
          // Caught sound - alarm
          for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(600 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
          }
          break;
        }
        case 'win': {
          // Victory fanfare
          const notes = [523, 659, 784, 1047];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            gain.gain.setValueAtTime(0.25, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.3);
          });
          break;
        }
        case 'freeze': {
          // Ice/freeze sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2000, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        }
        case 'tick': {
          // Timer warning tick
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }
        case 'start': {
          // Game start
          const notes = [262, 330, 392, 523];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
          });
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.log('Sound error:', e);
    }
  }
}

const soundManager = new SoundManager();

// MAP DEFINITIONS - Simplified for performance
const MAPS = {
  easy: {
    name: 'Training Ground',
    description: 'Small map, few obstacles. Perfect for beginners!',
    difficulty: 1,
    width: 900,
    height: 700,
    timeLimit: 90,
    walls: [
      { x: 100, y: 100, width: 200, height: 15 },
      { x: 400, y: 100, width: 200, height: 15 },
      { x: 600, y: 100, width: 15, height: 200 },
      { x: 200, y: 200, width: 15, height: 200 },
      { x: 100, y: 300, width: 200, height: 15 },
      { x: 400, y: 300, width: 250, height: 15 },
      { x: 500, y: 400, width: 15, height: 200 },
      { x: 150, y: 450, width: 200, height: 15 },
      { x: 600, y: 500, width: 200, height: 15 },
      { x: 300, y: 550, width: 15, height: 100 },
    ],
    coins: [
      { x: 50, y: 50 }, { x: 850, y: 50 }, { x: 50, y: 650 }, { x: 850, y: 650 },
      { x: 450, y: 350 }, { x: 250, y: 250 }, { x: 700, y: 400 }, { x: 150, y: 550 },
    ],
    criminalPowerups: [
      { x: 450, y: 150, type: 'SPEED' },
      { x: 150, y: 400, type: 'INVISIBILITY' },
    ],
    copPowerups: [
      { x: 750, y: 250, type: 'TASER' },
    ],
    teleporters: [
      { x: 100, y: 600, targetX: 800, targetY: 100, color: '#ff00ff' },
      { x: 800, y: 100, targetX: 100, targetY: 600, color: '#ff00ff' },
    ],
    copSpawn: { x: 50, y: 350 },
    criminalSpawn: { x: 800, y: 350 },
    exitZone: { x: 400, y: 650, width: 100, height: 50 },
  },
  medium: {
    name: 'City Streets',
    description: 'Medium complexity with more obstacles and power-ups.',
    difficulty: 2,
    width: 1000,
    height: 750,
    timeLimit: 120,
    walls: [
      { x: 100, y: 80, width: 250, height: 15 },
      { x: 450, y: 80, width: 250, height: 15 },
      { x: 700, y: 80, width: 15, height: 180 },
      { x: 150, y: 180, width: 15, height: 180 },
      { x: 150, y: 180, width: 180, height: 15 },
      { x: 400, y: 200, width: 180, height: 15 },
      { x: 580, y: 200, width: 15, height: 130 },
      { x: 250, y: 330, width: 350, height: 15 },
      { x: 250, y: 330, width: 15, height: 130 },
      { x: 500, y: 330, width: 15, height: 130 },
      { x: 700, y: 280, width: 180, height: 15 },
      { x: 100, y: 460, width: 220, height: 15 },
      { x: 100, y: 460, width: 15, height: 130 },
      { x: 380, y: 460, width: 250, height: 15 },
      { x: 630, y: 460, width: 15, height: 180 },
      { x: 750, y: 550, width: 150, height: 15 },
      { x: 200, y: 590, width: 350, height: 15 },
    ],
    coins: [
      { x: 50, y: 50 }, { x: 950, y: 50 }, { x: 50, y: 700 }, { x: 950, y: 700 },
      { x: 500, y: 380 }, { x: 280, y: 240 }, { x: 750, y: 400 }, { x: 380, y: 550 },
      { x: 180, y: 420 }, { x: 820, y: 180 }, { x: 550, y: 650 }, { x: 130, y: 700 },
    ],
    criminalPowerups: [
      { x: 380, y: 140, type: 'SPEED' },
      { x: 780, y: 380, type: 'INVISIBILITY' },
      { x: 280, y: 520, type: 'FREEZE' },
    ],
    copPowerups: [
      { x: 550, y: 260, type: 'TASER' },
      { x: 140, y: 580, type: 'SPEED' },
    ],
    teleporters: [
      { x: 80, y: 140, targetX: 900, targetY: 650, color: '#00ffff' },
      { x: 900, y: 650, targetX: 80, targetY: 140, color: '#00ffff' },
    ],
    copSpawn: { x: 50, y: 375 },
    criminalSpawn: { x: 900, y: 375 },
    exitZone: { x: 450, y: 700, width: 100, height: 50 },
  },
  hard: {
    name: 'Maximum Security',
    description: 'Complex maze with many dead ends. Experts only!',
    difficulty: 3,
    width: 1100,
    height: 850,
    timeLimit: 150,
    walls: [
      { x: 100, y: 60, width: 350, height: 15 },
      { x: 550, y: 60, width: 350, height: 15 },
      { x: 100, y: 60, width: 15, height: 130 },
      { x: 450, y: 60, width: 15, height: 90 },
      { x: 900, y: 60, width: 15, height: 130 },
      { x: 180, y: 140, width: 180, height: 15 },
      { x: 550, y: 140, width: 260, height: 15 },
      { x: 180, y: 140, width: 15, height: 90 },
      { x: 360, y: 140, width: 15, height: 130 },
      { x: 810, y: 140, width: 15, height: 90 },
      { x: 100, y: 230, width: 180, height: 15 },
      { x: 450, y: 230, width: 350, height: 15 },
      { x: 280, y: 230, width: 15, height: 130 },
      { x: 450, y: 230, width: 15, height: 90 },
      { x: 640, y: 230, width: 15, height: 130 },
      { x: 800, y: 230, width: 15, height: 90 },
      { x: 180, y: 360, width: 15, height: 180 },
      { x: 180, y: 360, width: 180, height: 15 },
      { x: 450, y: 360, width: 260, height: 15 },
      { x: 450, y: 360, width: 15, height: 130 },
      { x: 710, y: 360, width: 15, height: 180 },
      { x: 900, y: 360, width: 100, height: 15 },
      { x: 900, y: 360, width: 15, height: 180 },
      { x: 280, y: 460, width: 90, height: 15 },
      { x: 550, y: 460, width: 90, height: 15 },
      { x: 360, y: 460, width: 15, height: 90 },
      { x: 640, y: 460, width: 15, height: 130 },
      { x: 100, y: 540, width: 130, height: 15 },
      { x: 100, y: 540, width: 15, height: 180 },
      { x: 320, y: 540, width: 220, height: 15 },
      { x: 710, y: 540, width: 180, height: 15 },
      { x: 230, y: 590, width: 15, height: 130 },
      { x: 540, y: 590, width: 15, height: 90 },
      { x: 800, y: 590, width: 15, height: 130 },
      { x: 320, y: 680, width: 350, height: 15 },
      { x: 100, y: 720, width: 180, height: 15 },
      { x: 710, y: 720, width: 180, height: 15 },
    ],
    coins: [
      { x: 50, y: 50 }, { x: 1050, y: 50 }, { x: 50, y: 800 }, { x: 1050, y: 800 },
      { x: 550, y: 410 }, { x: 280, y: 280 }, { x: 820, y: 460 }, { x: 410, y: 640 },
      { x: 140, y: 460 }, { x: 960, y: 280 }, { x: 690, y: 690 }, { x: 180, y: 800 },
      { x: 500, y: 180 }, { x: 780, y: 140 }, { x: 320, y: 510 }, { x: 870, y: 640 },
    ],
    criminalPowerups: [
      { x: 280, y: 100, type: 'SPEED' },
      { x: 960, y: 460, type: 'INVISIBILITY' },
      { x: 410, y: 410, type: 'FREEZE' },
      { x: 690, y: 280, type: 'SPEED' },
    ],
    copPowerups: [
      { x: 550, y: 100, type: 'TASER' },
      { x: 140, y: 640, type: 'SPEED' },
      { x: 820, y: 510, type: 'TASER' },
    ],
    teleporters: [
      { x: 80, y: 110, targetX: 1000, targetY: 750, color: '#00ffff' },
      { x: 1000, y: 750, targetX: 80, targetY: 110, color: '#00ffff' },
      { x: 550, y: 280, targetX: 180, targetY: 690, color: '#ff00ff' },
      { x: 180, y: 690, targetX: 550, targetY: 280, color: '#ff00ff' },
    ],
    copSpawn: { x: 50, y: 425 },
    criminalSpawn: { x: 1000, y: 425 },
    exitZone: { x: 500, y: 800, width: 100, height: 50 },
  },
};

function Game() {
  const canvasRef = useRef(null);
  const [gameScreen, setGameScreen] = useState('menu');
  const [selectedMap, setSelectedMap] = useState(null);
  const [gameState, setGameState] = useState('playing');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [criminalPowerup, setCriminalPowerup] = useState(null);
  const [copPowerup, setCopPowerup] = useState(null);
  const [copFrozen, setCopFrozen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [particles, setParticles] = useState([]);
  const [screenShake, setScreenShake] = useState(0);
  
  const playersRef = useRef({ cop: { x: 50, y: 300 }, criminal: { x: 700, y: 300 } });
  const coinsRef = useRef([]);
  const criminalPowerupsRef = useRef([]);
  const copPowerupsRef = useRef([]);
  const teleportersRef = useRef([]);
  const keysRef = useRef({});
  const animationRef = useRef(0);
  const currentMapRef = useRef(null);
  const teleportCooldownRef = useRef({ cop: 0, criminal: 0 });
  const frameCountRef = useRef(0);
  const particlesRef = useRef([]);
  
  // Pre-rendered background canvas for optimization
  const bgCanvasRef = useRef(null);

  // Particle system for effects
  const addParticles = useCallback((x, y, color, count = 10, type = 'burst') => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = type === 'burst' ? 2 + Math.random() * 4 : 1 + Math.random() * 2;
      newParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        color,
        size: type === 'burst' ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
        type
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, []);

  const startGame = useCallback((mapKey) => {
    soundManager.init();
    soundManager.play('start');
    
    const map = MAPS[mapKey];
    currentMapRef.current = map;
    setSelectedMap(mapKey);
    
    playersRef.current = {
      cop: { ...map.copSpawn },
      criminal: { ...map.criminalSpawn }
    };
    
    coinsRef.current = map.coins.map(c => ({ ...c }));
    criminalPowerupsRef.current = map.criminalPowerups.map(p => ({ ...p }));
    copPowerupsRef.current = map.copPowerups.map(p => ({ ...p }));
    teleportersRef.current = map.teleporters.map(t => ({ ...t }));
    teleportCooldownRef.current = { cop: 0, criminal: 0 };
    bgCanvasRef.current = null;
    particlesRef.current = [];
    
    setScore(0);
    setTimeLeft(map.timeLimit);
    setCriminalPowerup(null);
    setCopPowerup(null);
    setCopFrozen(false);
    setIsPaused(false);
    setShowLegend(false);
    setGameState('playing');
    setGameScreen('playing');
  }, []);

  const resetGame = useCallback(() => {
    if (selectedMap) startGame(selectedMap);
  }, [selectedMap, startGame]);

  const returnToMenu = useCallback(() => {
    setGameScreen('menu');
    setIsPaused(false);
    setShowLegend(false);
    setGameState('playing');
  }, []);

  const togglePause = useCallback(() => {
    if (gameScreen === 'playing' && gameState === 'playing') {
      setIsPaused(prev => !prev);
    }
  }, [gameScreen, gameState]);

  const toggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  // Optimized collision check
  const checkWallCollision = useCallback((x, y, size, walls, w, h) => {
    if (x < 0 || x + size > w || y < 0 || y + size > h) return true;
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      if (x < wall.x + wall.width && x + size > wall.x &&
          y < wall.y + wall.height && y + size > wall.y) {
        return true;
      }
    }
    return false;
  }, []);

  const checkCatch = useCallback(() => {
    const { cop, criminal } = playersRef.current;
    const dx = cop.x - criminal.x;
    const dy = cop.y - criminal.y;
    return (dx * dx + dy * dy) < (PLAYER_SIZE * PLAYER_SIZE);
  }, []);

  const checkTeleporter = useCallback((player, playerType, teleporters) => {
    if (teleportCooldownRef.current[playerType] > 0) return null;
    const px = player.x + PLAYER_SIZE / 2;
    const py = player.y + PLAYER_SIZE / 2;
    for (let i = 0; i < teleporters.length; i++) {
      const tp = teleporters[i];
      const dx = tp.x - px;
      const dy = tp.y - py;
      if (dx * dx + dy * dy < 625) { // 25^2
        teleportCooldownRef.current[playerType] = 60;
        soundManager.play('teleport');
        addParticles(tp.x, tp.y, tp.color, 15, 'burst');
        addParticles(tp.targetX, tp.targetY, tp.color, 15, 'burst');
        return { targetX: tp.targetX - PLAYER_SIZE / 2, targetY: tp.targetY - PLAYER_SIZE / 2 };
      }
    }
    return null;
  }, [addParticles]);

  const checkExit = useCallback(() => {
    if (!currentMapRef.current || coinsRef.current.length > 0) return false;
    const { criminal } = playersRef.current;
    const exit = currentMapRef.current.exitZone;
    return criminal.x + PLAYER_SIZE > exit.x && criminal.x < exit.x + exit.width &&
           criminal.y + PLAYER_SIZE > exit.y && criminal.y < exit.y + exit.height;
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') togglePause();
      if (e.key.toLowerCase() === 'h') toggleLegend();
      keysRef.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'z', 's', 'q', 'd'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [togglePause, toggleLegend]);

  // Timer
  useEffect(() => {
    if (gameScreen !== 'playing' || gameState !== 'playing' || isPaused) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { 
          soundManager.play('catch');
          setGameState('cop-wins'); 
          return 0; 
        }
        if (prev <= 10) {
          soundManager.play('tick');
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameScreen, gameState, isPaused]);

  // OPTIMIZED Main game loop
  useEffect(() => {
    if (gameScreen !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = currentMapRef.current;
    if (!map) return;

    let animationId;
    
    // Pre-render static background (walls, grid) - MAJOR OPTIMIZATION
    const renderBackground = () => {
      if (bgCanvasRef.current) return bgCanvasRef.current;
      
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = map.width;
      bgCanvas.height = map.height;
      const bgCtx = bgCanvas.getContext('2d');
      
      // Background gradient
      const gradient = bgCtx.createLinearGradient(0, 0, map.width, map.height);
      gradient.addColorStop(0, '#0f0f23');
      gradient.addColorStop(0.5, '#151530');
      gradient.addColorStop(1, '#1a1a3e');
      bgCtx.fillStyle = gradient;
      bgCtx.fillRect(0, 0, map.width, map.height);
      
      // Grid
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      bgCtx.lineWidth = 1;
      for (let x = 0; x < map.width; x += 40) {
        bgCtx.beginPath();
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, map.height);
        bgCtx.stroke();
      }
      for (let y = 0; y < map.height; y += 40) {
        bgCtx.beginPath();
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(map.width, y);
        bgCtx.stroke();
      }
      
      // Walls
      for (const wall of map.walls) {
        bgCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        bgCtx.fillRect(wall.x + 3, wall.y + 3, wall.width, wall.height);
        bgCtx.fillStyle = '#4a4a7a';
        bgCtx.fillRect(wall.x, wall.y, wall.width, wall.height);
        bgCtx.strokeStyle = '#6a6a9a';
        bgCtx.lineWidth = 2;
        bgCtx.strokeRect(wall.x, wall.y, wall.width, wall.height);
      }
      
      bgCanvasRef.current = bgCanvas;
      return bgCanvas;
    };

    const gameLoop = () => {
      frameCountRef.current++;
      
      // Decrease cooldowns
      if (teleportCooldownRef.current.cop > 0) teleportCooldownRef.current.cop--;
      if (teleportCooldownRef.current.criminal > 0) teleportCooldownRef.current.criminal--;
      
      if (gameState === 'playing' && !isPaused) {
        const keys = keysRef.current;
        const players = playersRef.current;
        
        const criminalSpeed = criminalPowerup === 'SPEED' ? PLAYER_SPEED * 1.6 : PLAYER_SPEED;
        const copBaseSpeed = copPowerup === 'SPEED' ? COP_SPEED * 1.5 : COP_SPEED;
        const copSpeed = copFrozen ? 0 : copBaseSpeed;

        // Criminal movement (ZQSD)
        let ncx = players.criminal.x;
        let ncy = players.criminal.y;
        if (keys['z']) ncy -= criminalSpeed;
        if (keys['s']) ncy += criminalSpeed;
        if (keys['q']) ncx -= criminalSpeed;
        if (keys['d']) ncx += criminalSpeed;

        if (!checkWallCollision(ncx, ncy, PLAYER_SIZE, map.walls, map.width, map.height)) {
          players.criminal.x = ncx;
          players.criminal.y = ncy;
        } else {
          if (!checkWallCollision(ncx, players.criminal.y, PLAYER_SIZE, map.walls, map.width, map.height)) {
            players.criminal.x = ncx;
          }
          if (!checkWallCollision(players.criminal.x, ncy, PLAYER_SIZE, map.walls, map.width, map.height)) {
            players.criminal.y = ncy;
          }
        }

        // Cop movement
        let npx = players.cop.x;
        let npy = players.cop.y;
        if (keys['arrowup']) npy -= copSpeed;
        if (keys['arrowdown']) npy += copSpeed;
        if (keys['arrowleft']) npx -= copSpeed;
        if (keys['arrowright']) npx += copSpeed;

        if (!checkWallCollision(npx, npy, PLAYER_SIZE, map.walls, map.width, map.height)) {
          players.cop.x = npx;
          players.cop.y = npy;
        } else {
          if (!checkWallCollision(npx, players.cop.y, PLAYER_SIZE, map.walls, map.width, map.height)) {
            players.cop.x = npx;
          }
          if (!checkWallCollision(players.cop.x, npy, PLAYER_SIZE, map.walls, map.width, map.height)) {
            players.cop.y = npy;
          }
        }

        // Teleporters
        const crimTp = checkTeleporter(players.criminal, 'criminal', teleportersRef.current);
        if (crimTp) { players.criminal.x = crimTp.targetX; players.criminal.y = crimTp.targetY; }
        
        const copTp = checkTeleporter(players.cop, 'cop', teleportersRef.current);
        if (copTp) { players.cop.x = copTp.targetX; players.cop.y = copTp.targetY; }

        // Coin collection (CRIMINAL ONLY)
        const crimCenterX = players.criminal.x + PLAYER_SIZE / 2;
        const crimCenterY = players.criminal.y + PLAYER_SIZE / 2;
        coinsRef.current = coinsRef.current.filter(coin => {
          const dx = coin.x - crimCenterX;
          const dy = coin.y - crimCenterY;
          if (dx * dx + dy * dy < 625) {
            setScore(prev => prev + 1);
            soundManager.play('coin');
            addParticles(coin.x, coin.y, '#ffd700', 8, 'burst');
            return false;
          }
          return true;
        });

        // Criminal power-up collection (CRIMINAL ONLY)
        criminalPowerupsRef.current = criminalPowerupsRef.current.filter(powerup => {
          const dx = powerup.x - crimCenterX;
          const dy = powerup.y - crimCenterY;
          if (dx * dx + dy * dy < 625) {
            soundManager.play(powerup.type === 'FREEZE' ? 'freeze' : 'powerup');
            addParticles(powerup.x, powerup.y, CRIMINAL_POWERUPS[powerup.type].color, 12, 'burst');
            if (powerup.type === 'FREEZE') {
              setCopFrozen(true);
              setTimeout(() => setCopFrozen(false), CRIMINAL_POWERUPS.FREEZE.duration);
            } else {
              setCriminalPowerup(powerup.type);
              setTimeout(() => setCriminalPowerup(null), CRIMINAL_POWERUPS[powerup.type].duration);
            }
            return false;
          }
          return true;
        });

        // Cop power-up collection (COP ONLY)
        const copCenterX = players.cop.x + PLAYER_SIZE / 2;
        const copCenterY = players.cop.y + PLAYER_SIZE / 2;
        copPowerupsRef.current = copPowerupsRef.current.filter(powerup => {
          const dx = powerup.x - copCenterX;
          const dy = powerup.y - copCenterY;
          if (dx * dx + dy * dy < 625) {
            soundManager.play('powerup');
            addParticles(powerup.x, powerup.y, COP_POWERUPS[powerup.type].color, 12, 'burst');
            setCopPowerup(powerup.type);
            setTimeout(() => setCopPowerup(null), COP_POWERUPS[powerup.type].duration);
            return false;
          }
          return true;
        });

        // Check catch
        if (criminalPowerup !== 'INVISIBILITY' && checkCatch()) {
          soundManager.play('catch');
          setScreenShake(10);
          setGameState('cop-wins');
        }

        if (checkExit()) {
          soundManager.play('win');
          setGameState('criminal-wins');
        }
      }

      // ===== OPTIMIZED RENDERING =====
      animationRef.current += 0.08;
      
      // Draw cached background
      const bgCanvas = renderBackground();
      ctx.drawImage(bgCanvas, 0, 0);

      // Exit zone
      const exit = map.exitZone;
      const canExit = coinsRef.current.length === 0;
      ctx.fillStyle = canExit ? 'rgba(0, 255, 100, 0.4)' : 'rgba(255, 0, 0, 0.15)';
      ctx.fillRect(exit.x, exit.y, exit.width, exit.height);
      ctx.strokeStyle = canExit ? '#00ff64' : '#ff4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(exit.x, exit.y, exit.width, exit.height);
      ctx.fillStyle = canExit ? '#00ff64' : '#ff6666';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(canExit ? 'EXIT ✓' : '🔒 EXIT', exit.x + exit.width / 2, exit.y + exit.height / 2);

      // Teleporters (simplified - no shadow)
      const frame = frameCountRef.current;
      for (const tp of teleportersRef.current) {
        ctx.strokeStyle = tp.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const angle = frame * 0.05;
        ctx.arc(tp.x, tp.y, 18, angle, angle + Math.PI * 1.5);
        ctx.stroke();
        ctx.fillStyle = tp.color;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coins (simplified animation)
      ctx.fillStyle = '#ffd700';
      for (const coin of coinsRef.current) {
        const pulse = Math.sin(frame * 0.05 + coin.x * 0.01) * 2;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 12 + pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#aa8800';
      ctx.font = 'bold 10px Arial';
      for (const coin of coinsRef.current) {
        ctx.fillText('$', coin.x, coin.y + 1);
      }

      // Criminal power-ups (HEXAGON - for Criminal only)
      for (const powerup of criminalPowerupsRef.current) {
        const type = CRIMINAL_POWERUPS[powerup.type];
        ctx.fillStyle = type.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = powerup.x + 16 * Math.cos(angle);
          const py = powerup.y + 16 * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText(type.icon, powerup.x, powerup.y + 1);
      }

      // Cop power-ups (DIAMOND - for Cop only)
      for (const powerup of copPowerupsRef.current) {
        const type = COP_POWERUPS[powerup.type];
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.moveTo(powerup.x, powerup.y - 18);
        ctx.lineTo(powerup.x + 18, powerup.y);
        ctx.lineTo(powerup.x, powerup.y + 18);
        ctx.lineTo(powerup.x - 18, powerup.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(type.icon, powerup.x, powerup.y + 1);
      }

      const players = playersRef.current;

      // Draw Criminal
      ctx.globalAlpha = criminalPowerup === 'INVISIBILITY' ? 0.35 : 1;
      
      // Body
      ctx.fillStyle = criminalPowerup === 'SPEED' ? '#00ff88' : '#ff4444';
      ctx.beginPath();
      ctx.arc(players.criminal.x + PLAYER_SIZE / 2, players.criminal.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Mask
      ctx.fillStyle = '#222';
      ctx.fillRect(players.criminal.x + 4, players.criminal.y + 7, 20, 7);
      
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(players.criminal.x + 9, players.criminal.y + 10, 2, 0, Math.PI * 2);
      ctx.arc(players.criminal.x + 19, players.criminal.y + 10, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 1;

      // Draw Cop
      ctx.globalAlpha = copFrozen ? 0.5 : 1;
      
      // Body
      ctx.fillStyle = copPowerup === 'TASER' ? '#ff4444' : '#4488ff';
      ctx.beginPath();
      ctx.arc(players.cop.x + PLAYER_SIZE / 2, players.cop.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Hat
      ctx.fillStyle = '#223388';
      ctx.fillRect(players.cop.x + 2, players.cop.y - 6, 24, 8);
      
      // Badge
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(players.cop.x + 14, players.cop.y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(players.cop.x + 9, players.cop.y + 10, 2, 0, Math.PI * 2);
      ctx.arc(players.cop.x + 19, players.cop.y + 10, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Taser effect (only when cop has taser)
      if (copPowerup === 'TASER') {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i + frame * 0.1;
          ctx.beginPath();
          ctx.moveTo(players.cop.x + PLAYER_SIZE / 2 + 16 * Math.cos(angle),
                     players.cop.y + PLAYER_SIZE / 2 + 16 * Math.sin(angle));
          ctx.lineTo(players.cop.x + PLAYER_SIZE / 2 + 24 * Math.cos(angle),
                     players.cop.y + PLAYER_SIZE / 2 + 24 * Math.sin(angle));
          ctx.stroke();
        }
      }
      
      // Frozen effect
      if (copFrozen) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + frame * 0.05;
          ctx.beginPath();
          ctx.moveTo(players.cop.x + PLAYER_SIZE / 2 + 18 * Math.cos(angle),
                     players.cop.y + PLAYER_SIZE / 2 + 18 * Math.sin(angle));
          ctx.lineTo(players.cop.x + PLAYER_SIZE / 2 + 26 * Math.cos(angle),
                     players.cop.y + PLAYER_SIZE / 2 + 26 * Math.sin(angle));
          ctx.stroke();
        }
      }
      
      ctx.globalAlpha = 1;

      // Labels
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.fillText('CRIMINAL', players.criminal.x + PLAYER_SIZE / 2, players.criminal.y - 10);
      ctx.fillStyle = copPowerup === 'TASER' ? '#ff0000' : '#4488ff';
      ctx.fillText(copPowerup === 'TASER' ? 'COP ⚡' : 'COP', players.cop.x + PLAYER_SIZE / 2, players.cop.y - 16);

      // ===== PARTICLE SYSTEM =====
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.vx *= 0.98;
        p.vy *= 0.98;
        
        if (p.life > 0) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          return true;
        }
        return false;
      });
      ctx.globalAlpha = 1;

      // Pause overlay
      if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, map.width, map.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('⏸ PAUSED', map.width / 2, map.height / 2 - 40);
        ctx.font = '18px Arial';
        ctx.fillText('Press ESC to resume', map.width / 2, map.height / 2 + 10);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameScreen, gameState, isPaused, checkWallCollision, checkCatch, checkTeleporter, checkExit, criminalPowerup, copPowerup, copFrozen, addParticles]);

  // Menu screen
  if (gameScreen === 'menu') {
    return (
      <div className="menu-container">
        <h1>🚔 COPS & ROBBERS 💰</h1>
        <p className="subtitle">Choose Your Battleground</p>
        
        <div className="map-selection">
          {Object.entries(MAPS).map(([key, map]) => (
            <div key={key} className={`map-card difficulty-${map.difficulty}`} onClick={() => startGame(key)}>
              <h2>{map.name}</h2>
              <div className="difficulty-stars">{'⭐'.repeat(map.difficulty)}</div>
              <p>{map.description}</p>
              <div className="map-stats">
                <span>🗺️ {map.width}x{map.height}</span>
                <span>⏱️ {map.timeLimit}s</span>
                <span>💰 {map.coins.length}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="menu-instructions">
          <h3>How to Play</h3>
          <div className="control-grid">
            <div className="control-box criminal">
              <span className="role">🔴 CRIMINAL</span>
              <span className="keys">Z Q S D</span>
              <span className="goal">Collect coins & reach EXIT!</span>
            </div>
            <div className="control-box cop">
              <span className="role">🔵 COP</span>
              <span className="keys">↑ ← ↓ →</span>
              <span className="goal">Catch the criminal!</span>
            </div>
          </div>
          <div className="powerup-legend">
            <h4>Power-ups</h4>
            <div className="powerup-row">
              <span>🔴 Criminal (⬡):</span>
              <span>⚡Speed 👻Invisible ❄️Freeze</span>
            </div>
            <div className="powerup-row">
              <span>🔵 Cop (◇):</span>
              <span>⚡TASER (3s kill!) 🏃Speed</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const map = currentMapRef.current;
  const totalCoins = map ? map.coins.length : 0;

  return (
    <div className="game-container">
      <h1>🚔 {map?.name || 'COPS & ROBBERS'} 💰</h1>
      
      <div className="game-info">
        <div className="score-board">
          <span className="criminal-score">💰 {score}/{totalCoins}</span>
          {coinsRef.current.length === 0 && <span className="exit-ready">🚪 EXIT!</span>}
        </div>
        <div className={`timer ${timeLeft <= 10 ? 'warning' : ''}`} style={{ color: timeLeft <= 15 ? '#ff4444' : '#00ff88' }}>
          ⏱️ {timeLeft}s
        </div>
        <button className="legend-toggle" onClick={toggleLegend}>
          📋 {showLegend ? 'Hide' : 'Items'} (H)
        </button>
      </div>

      <div className="controls-info">
        <div className="player-controls criminal"><span>🔴 ZQSD</span></div>
        <div className="game-controls"><span>ESC = Pause | H = Legend</span></div>
        <div className="player-controls cop"><span>🔵 ↑↓←→</span></div>
      </div>

      {criminalPowerup && (
        <div className="active-powerup criminal-active">
          {CRIMINAL_POWERUPS[criminalPowerup].icon} {CRIMINAL_POWERUPS[criminalPowerup].name}
          <div className="powerup-timer"></div>
        </div>
      )}

      {copPowerup && (
        <div className="active-powerup cop-active">
          {COP_POWERUPS[copPowerup].icon} {COP_POWERUPS[copPowerup].name}
          <div className="powerup-timer"></div>
        </div>
      )}

      {copFrozen && (
        <div className="frozen-indicator">
          ❄️ COP FROZEN! ❄️
        </div>
      )}

      <canvas ref={canvasRef} width={map?.width || 900} height={map?.height || 700} className="game-canvas" />

      {/* ITEMS LEGEND PANEL */}
      {showLegend && (
        <div className="legend-panel">
          <div className="legend-header">
            <h3>📋 GAME ITEMS</h3>
            <button onClick={toggleLegend}>✕</button>
          </div>
          
          <div className="legend-section">
            <h4>🎯 Collectibles</h4>
            <div className="legend-item">
              <span className="item-icon" style={{color: '#ffd700'}}>💰</span>
              <div className="item-info">
                <span className="item-name">COIN</span>
                <span className="item-desc">Collect all to unlock exit</span>
              </div>
            </div>
            <div className="legend-item">
              <span className="item-icon" style={{color: '#00ff64'}}>🚪</span>
              <div className="item-info">
                <span className="item-name">EXIT ZONE</span>
                <span className="item-desc">Escape here after all coins!</span>
              </div>
            </div>
            <div className="legend-item">
              <span className="item-icon" style={{color: '#ff00ff'}}>🌀</span>
              <div className="item-info">
                <span className="item-name">TELEPORTER</span>
                <span className="item-desc">Instant teleport to linked spot!</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <h4>🔴 Criminal Power-ups (⬡ Hexagon)</h4>
            {Object.entries(CRIMINAL_POWERUPS).map(([key, pw]) => (
              <div key={key} className="legend-item">
                <span className="item-icon powerup-hex" style={{background: pw.color}}>{pw.icon}</span>
                <div className="item-info">
                  <span className="item-name">{pw.name}</span>
                  <span className="item-desc">{pw.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="legend-section">
            <h4>🔵 Cop Power-ups (◇ Diamond)</h4>
            {Object.entries(COP_POWERUPS).map(([key, pw]) => (
              <div key={key} className="legend-item">
                <span className="item-icon powerup-diamond" style={{background: pw.color}}>{pw.icon}</span>
                <div className="item-info">
                  <span className="item-name">{pw.name}</span>
                  <span className="item-desc">{pw.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPaused && (
        <div className="pause-menu">
          <h2>⏸️ PAUSED</h2>
          <button onClick={togglePause}>▶️ Resume</button>
          <button onClick={resetGame}>🔄 Restart</button>
          <button onClick={returnToMenu}>🏠 Menu</button>
        </div>
      )}

      {gameState !== 'playing' && (
        <div className={`game-over ${gameState === 'criminal-wins' ? 'winner-criminal' : 'winner-cop'}`}>
          <h2>{gameState === 'cop-wins' ? '🚔 COP WINS!' : '💰 ESCAPED!'}</h2>
          <p>{gameState === 'cop-wins' ? 'Criminal caught!' : 'All coins collected & escaped!'}</p>
          <div className="final-stats">
            <span>💰 Coins: {score}/{totalCoins}</span>
            <span>⏱️ Time: {map.timeLimit - timeLeft}s</span>
          </div>
          <div className="game-over-buttons">
            <button onClick={resetGame}>🔄 Play Again</button>
            <button onClick={returnToMenu}>🏠 Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
