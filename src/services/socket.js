import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) return;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to server');
      if (token) {
        this.authenticate(token);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.log('🔌 Connection error:', error.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  authenticate(token) {
    if (this.socket) {
      this.socket.emit('authenticate', token);
    }
  }

  // Room events
  createRoom(data) {
    this.socket?.emit('create-room', data);
  }

  joinRoom(roomId, password = null) {
    this.socket?.emit('join-room', { roomId, password });
  }

  leaveRoom() {
    this.socket?.emit('leave-room');
  }

  selectRole(role) {
    this.socket?.emit('select-role', { role });
  }

  toggleReady() {
    this.socket?.emit('toggle-ready');
  }

  startGame() {
    this.socket?.emit('start-game');
  }

  getRooms() {
    this.socket?.emit('get-rooms');
  }

  // Game events
  sendPlayerInput(x, y) {
    this.socket?.emit('player-input', { x, y });
  }

  collectCoin(coinIndex) {
    this.socket?.emit('collect-coin', { coinIndex });
  }

  collectPowerup(powerupIndex, powerupType, duration) {
    this.socket?.emit('collect-powerup', { powerupIndex, powerupType, duration });
  }

  useTeleporter(targetX, targetY) {
    this.socket?.emit('use-teleporter', { targetX, targetY });
  }

  playerCaught() {
    this.socket?.emit('player-caught');
  }

  playerEscaped() {
    this.socket?.emit('player-escaped');
  }

  // Chat
  sendChat(message) {
    this.socket?.emit('room-chat', message);
  }

  // Generic emit method
  emit(event, data) {
    this.socket?.emit(event, data);
  }

  // Event listeners
  on(event, callback) {
    this.socket?.on(event, callback);
    this.listeners.set(event, callback);
  }

  off(event) {
    const callback = this.listeners.get(event);
    if (callback) {
      this.socket?.off(event, callback);
      this.listeners.delete(event);
    }
  }

  offAll() {
    this.listeners.forEach((callback, event) => {
      this.socket?.off(event, callback);
    });
    this.listeners.clear();
  }
}

export const socketService = new SocketService();
export default socketService;
