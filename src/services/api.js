import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const IS_PRODUCTION = import.meta.env.PROD;
const USE_SUPABASE = !!supabase;

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

  // Rooms - these still use the socket server when available (only in dev)
  async getRooms() {
    if (IS_PRODUCTION) return []; // No backend in production yet
    try {
      const response = await fetch(`${API_URL}/rooms`, {
        headers: this.getHeaders()
      });
      if (!response.ok) return [];
      return response.json();
    } catch (e) {
      return [];
    }
  }

  async createRoom(name, map, isPrivate, password) {
    if (IS_PRODUCTION) return { error: 'Online rooms coming soon!' };
    try {
      const response = await fetch(`${API_URL}/rooms/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, map, isPrivate, password })
      });
      return response.json();
    } catch (e) {
      return { error: 'Server unavailable' };
    }
  }

  async joinRoom(roomId, password) {
    if (IS_PRODUCTION) return { error: 'Online rooms coming soon!' };
    try {
      const response = await fetch(`${API_URL}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ password })
      });
      return response.json();
    } catch (e) {
      return { error: 'Server unavailable' };
    }
  }

  async leaveRoom(roomId) {
    if (IS_PRODUCTION) return { error: 'Server unavailable' };
    try {
      const response = await fetch(`${API_URL}/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return { error: 'Server unavailable' };
    }
  }

  // Users
  async getUserProfile(username) {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();
        if (error) return null;
        return data;
      } catch (e) {
        return null;
      }
    }
    
    try {
      const response = await fetch(`${API_URL}/users/profile/${username}`, {
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return null;
    }
  }

  async getUserStats(username) {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('stats, ranking')
          .eq('username', username)
          .maybeSingle();
        if (error) return null;
        return data;
      } catch (e) {
        return null;
      }
    }

    try {
      const response = await fetch(`${API_URL}/users/stats/${username}`, {
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return null;
    }
  }

  async searchUsers(query) {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, ranking')
          .ilike('username', `%${query}%`)
          .limit(10);
        if (error) return [];
        return data || [];
      } catch (e) {
        return [];
      }
    }

    try {
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return [];
    }
  }

  // Leaderboard
  async getLeaderboard(limit = 50, offset = 0, sortBy = 'points') {
    // Always use Supabase in production or when available
    if (USE_SUPABASE || IS_PRODUCTION) {
      try {
        if (!supabase) {
          console.log('Supabase not configured');
          return { leaderboard: [] };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, ranking, stats')
          .order('ranking->points', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (error) {
          console.log('Supabase leaderboard error:', error.message);
          return { leaderboard: [] };
        }
        
        // Format data to match expected structure
        const leaderboard = (data || []).map((player, index) => ({
          rank: offset + index + 1,
          username: player.username,
          points: player.ranking?.points || 1000,
          tier: player.ranking?.tier || 'Bronze',
          gamesWon: player.stats?.gamesWon || 0,
          gamesPlayed: player.stats?.gamesPlayed || 0,
          winRate: player.stats?.gamesPlayed > 0 
            ? Math.round((player.stats.gamesWon / player.stats.gamesPlayed) * 100) 
            : 0
        }));
        
        return { leaderboard };
      } catch (e) {
        console.log('Leaderboard fetch error:', e);
        return { leaderboard: [] };
      }
    }

    // Only use localhost API in development
    if (!IS_PRODUCTION) {
      try {
        const response = await fetch(
          `${API_URL}/leaderboard?limit=${limit}&offset=${offset}&sortBy=${sortBy}`,
          { headers: this.getHeaders() }
        );
        if (!response.ok) return { leaderboard: [] };
        return response.json();
      } catch (e) {
        console.log('Could not load leaderboard');
        return { leaderboard: [] };
      }
    }
    
    return { leaderboard: [] };
  }

  async getUserRank(username) {
    if (USE_SUPABASE) {
      try {
        // Get user's points
        const { data: user } = await supabase
          .from('profiles')
          .select('ranking')
          .eq('username', username)
          .maybeSingle();
        
        if (!user) return { rank: 0 };
        
        // Count users with more points
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gt('ranking->points', user.ranking?.points || 0);
        
        return { rank: (count || 0) + 1 };
      } catch (e) {
        return { rank: 0 };
      }
    }

    try {
      const response = await fetch(`${API_URL}/leaderboard/rank/${username}`, {
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return { rank: 0 };
    }
  }

  async getTierDistribution() {
    if (USE_SUPABASE) {
      // Return mock data for now
      return {
        Bronze: 0,
        Silver: 0,
        Gold: 0,
        Platinum: 0,
        Diamond: 0,
        Master: 0,
        Legend: 0
      };
    }

    try {
      const response = await fetch(`${API_URL}/leaderboard/tiers`, {
        headers: this.getHeaders()
      });
      return response.json();
    } catch (e) {
      return {};
    }
  }
}

export const apiService = new ApiService();
export default apiService;
