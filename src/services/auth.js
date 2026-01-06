import { supabaseAuth, supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_SUPABASE = !!supabase;

class AuthService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this._authListenerSetup = false;
    
    // Listen for Supabase auth changes - but don't cause side effects that trigger re-renders
    // The main App component handles auth state changes for UI updates
    if (USE_SUPABASE && !this._authListenerSetup) {
      this._authListenerSetup = true;
      supabaseAuth.onAuthStateChange((event, session) => {
        // Only sync token, don't trigger other side effects
        if (event === 'SIGNED_IN' && session) {
          this.token = session.access_token;
          localStorage.setItem('token', session.access_token);
        } else if (event === 'SIGNED_OUT') {
          // Just clear local data, don't trigger UI updates from here
          this.token = null;
          this.user = null;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      });
    }
  }

  async register(username, email, password) {
    if (USE_SUPABASE) {
      try {
        const data = await supabaseAuth.signUp(email, password, username);
        
        // IMPORTANT: Only proceed if we have a valid session
        if (!data.session) {
          throw new Error('📧 Check your email! Click the confirmation link we sent, then come back and log in.');
        }
        
        if (data.user && data.session) {
          const user = {
            id: data.user.id,
            username,
            email,
            ranking: { points: 1000, tier: 'Bronze', winStreak: 0, bestWinStreak: 0 },
            stats: {
              gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
              criminalGames: 0, criminalWins: 0, totalCoinsCollected: 0, totalEscapes: 0,
              copGames: 0, copWins: 0, totalCatches: 0
            }
          };
          
          // Save token - we know session exists here
          const token = data.session.access_token;
          console.log('Register - saving auth with valid session');
          this.setAuth(token, user);
          return { user, token };
        }
        throw new Error('Registration failed - no session received');
      } catch (error) {
        throw new Error(error.message || 'Registration failed');
      }
    }

    // Fallback to API
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    this.setAuth(data.token, data.user);
    return data;
  }

  async login(username, password) {
    if (USE_SUPABASE) {
      try {
        console.log('Starting login for:', username);
        
        // Call signIn directly - Supabase should handle timeouts internally
        console.log('Calling supabaseAuth.signIn...');
        const data = await supabaseAuth.signIn(username, password);
        console.log('signIn complete, user:', data.user?.id);
        
        if (data.user) {
          // Build user object directly from auth response for speed
          const fullUser = {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username || data.user.email?.split('@')[0],
            ranking: { points: 1000, tier: 'Bronze', winStreak: 0, bestWinStreak: 0 },
            stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 }
          };
          
          // Try to get full profile in background (don't block login)
          supabaseAuth.getCurrentUser().then(profile => {
            if (profile) {
              // Update stored user with full profile
              const updatedUser = { ...fullUser, ...profile };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              console.log('Profile loaded in background:', profile.username);
            }
          }).catch(err => console.warn('Background profile fetch failed:', err.message));
          
          this.setAuth(data.session?.access_token || '', fullUser);
          console.log('Login complete!');
          return { user: fullUser, token: data.session?.access_token };
        }
        throw new Error('Login failed');
      } catch (error) {
        console.error('Login error:', error.message);
        throw new Error(error.message || 'Invalid credentials');
      }
    }

    // Fallback to API
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    this.setAuth(data.token, data.user);
    return data;
  }

  async logout() {
    if (USE_SUPABASE) {
      try {
        await supabaseAuth.signOut();
      } catch (e) {
        // Ignore errors
      }
    } else {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          }
        });
      } catch (e) {
        // Ignore errors
      }
    }
    
    this.clearAuth();
  }

  async getProfile() {
    if (USE_SUPABASE) {
      try {
        const user = await supabaseAuth.getCurrentUser();
        if (user) {
          this.user = user;
          localStorage.setItem('user', JSON.stringify(user));
          return user;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    // Fallback to API
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (!response.ok) {
        this.clearAuth();
        return null;
      }

      const data = await response.json();
      this.user = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (e) {
      return null;
    }
  }

  // Alias for getProfile
  async getMe() {
    return this.getProfile();
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!this.token || !!this.user;
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }
}

export const authService = new AuthService();
export default authService;
