-- =============================================
-- COPS AND ROBBERS DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. PROFILES TABLE (User profiles with rankings and stats)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  ranking JSONB DEFAULT '{
    "points": 1000,
    "tier": "Bronze",
    "winStreak": 0,
    "bestWinStreak": 0
  }'::jsonb,
  stats JSONB DEFAULT '{
    "gamesPlayed": 0,
    "gamesWon": 0,
    "gamesLost": 0,
    "criminalGames": 0,
    "criminalWins": 0,
    "totalCoinsCollected": 0,
    "totalEscapes": 0,
    "copGames": 0,
    "copWins": 0,
    "totalCatches": 0
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GAME HISTORY TABLE (Track all games played)
CREATE TABLE IF NOT EXISTS game_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT,
  cop_id UUID REFERENCES profiles(id),
  criminal_id UUID REFERENCES profiles(id),
  winner_id UUID REFERENCES profiles(id),
  winner_role TEXT CHECK (winner_role IN ('cop', 'criminal')),
  map_name TEXT,
  duration_seconds INTEGER,
  cop_points_change INTEGER DEFAULT 0,
  criminal_points_change INTEGER DEFAULT 0,
  game_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROOMS TABLE (Active game rooms)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host_id UUID REFERENCES profiles(id),
  map_name TEXT DEFAULT 'classic',
  is_private BOOLEAN DEFAULT FALSE,
  password TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  max_players INTEGER DEFAULT 2,
  players JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FRIENDSHIPS TABLE (Friend system)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
CREATE INDEX IF NOT EXISTS profiles_ranking_points_idx ON profiles((ranking->>'points'));
CREATE INDEX IF NOT EXISTS game_history_cop_id_idx ON game_history(cop_id);
CREATE INDEX IF NOT EXISTS game_history_criminal_id_idx ON game_history(criminal_id);
CREATE INDEX IF NOT EXISTS game_history_created_at_idx ON game_history(created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_status_idx ON rooms(status);
CREATE INDEX IF NOT EXISTS rooms_host_id_idx ON rooms(host_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- GAME HISTORY POLICIES
CREATE POLICY "Game history is viewable by everyone" ON game_history
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert game history" ON game_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ROOMS POLICIES
CREATE POLICY "Rooms are viewable by everyone" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Room hosts can update their rooms" ON rooms
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Room hosts can delete their rooms" ON rooms
  FOR DELETE USING (auth.uid() = host_id);

-- FRIENDSHIPS POLICIES
CREATE POLICY "Users can view their friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
