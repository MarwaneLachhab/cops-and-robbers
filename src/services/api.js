const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
    };
  }

  setToken(token) {
    this.token = token;
  }

  // Rooms
  async getRooms() {
    const response = await fetch(`${API_URL}/rooms`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async createRoom(name, map, isPrivate, password) {
    const response = await fetch(`${API_URL}/rooms/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, map, isPrivate, password })
    });
    return response.json();
  }

  async joinRoom(roomId, password) {
    const response = await fetch(`${API_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ password })
    });
    return response.json();
  }

  async leaveRoom(roomId) {
    const response = await fetch(`${API_URL}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return response.json();
  }

  // Users
  async getUserProfile(username) {
    const response = await fetch(`${API_URL}/users/profile/${username}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async getUserStats(username) {
    const response = await fetch(`${API_URL}/users/stats/${username}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async searchUsers(query) {
    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  // Leaderboard
  async getLeaderboard(limit = 50, offset = 0, sortBy = 'points') {
    const response = await fetch(
      `${API_URL}/leaderboard?limit=${limit}&offset=${offset}&sortBy=${sortBy}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }

  async getUserRank(username) {
    const response = await fetch(`${API_URL}/leaderboard/rank/${username}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async getTierDistribution() {
    const response = await fetch(`${API_URL}/leaderboard/tiers`, {
      headers: this.getHeaders()
    });
    return response.json();
  }
}

export const apiService = new ApiService();
export default apiService;
