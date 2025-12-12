import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using fallback mode.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Helper functions for Supabase operations
export const supabaseAuth = {
  // Sign up with email and password
  async signUp(email, password, username) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username
        }
      }
    });
    
    if (error) throw error;
    
    // Create user profile in database
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        email,
        ranking: { points: 1000, tier: 'Bronze', winStreak: 0, bestWinStreak: 0 },
        stats: {
          gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
          criminalGames: 0, criminalWins: 0, totalCoinsCollected: 0, totalEscapes: 0,
          copGames: 0, copWins: 0, totalCatches: 0
        },
        created_at: new Date().toISOString()
      });
    }
    
    return data;
  },

  // Sign in with email/username and password
  async signIn(identifier, password) {
    if (!supabase) throw new Error('Supabase not configured');
    
    // Check if identifier is email or username
    let email = identifier;
    if (!identifier.includes('@')) {
      // It's a username, find the email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', identifier)
        .single();
      
      if (profile) {
        email = profile.email;
      } else {
        throw new Error('User not found');
      }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  async getSession() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Get current user with profile
  async getCurrentUser() {
    if (!supabase) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email,
      username: profile?.username || user.user_metadata?.username,
      ...profile
    };
  },

  // Update user profile
  async updateProfile(userId, updates) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) throw error;
    return data;
  },

  // Get leaderboard
  async getLeaderboard(limit = 50) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, ranking, stats')
      .order('ranking->points', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Listen for auth changes
  onAuthStateChange(callback) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(callback);
  }
};

export default supabase;
