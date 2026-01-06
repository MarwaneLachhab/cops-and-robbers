import { useState, useEffect, useRef, useCallback } from 'react';
import Game from './Game';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import OnlineGame from './components/OnlineGame';
import authService from './services/auth';
import realtimeService from './services/realtime';
import { parsePlayers } from './utils/parsers';
import { supabase } from './services/supabase';
import './App.css';

// App states
const SCREENS = {
  AUTH: 'auth',
  LOBBY: 'lobby',
  ONLINE_GAME: 'online_game',
  LOCAL_GAME: 'local_game'
};

function App() {
  const [screen, setScreen] = useState(SCREENS.AUTH);
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refs to prevent duplicate operations
  const authCheckDone = useRef(false);
  const authChangeProcessing = useRef(false);
  const subscriptionRef = useRef(null);
  const timeoutRef = useRef(null);

  // Check for existing session on mount
  useEffect(() => {
    // Prevent running multiple times
    if (authCheckDone.current) return;
    authCheckDone.current = true;
    
    let isMounted = true;
    
    const clearAuthTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    const checkAuth = async () => {
      // Set a timeout to prevent infinite loading
      timeoutRef.current = setTimeout(() => {
        if (isMounted && loading) {
          console.log('Auth check timeout - showing login');
          setLoading(false);
        }
      }, 8000);
      
      try {
        // First check Supabase session directly
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && isMounted) {
            console.log('Session found, building user...');
            
            // Build user directly from session (fast, no network call)
            const user = session.user;
            const userData = {
              id: user.id,
              email: user.email,
              username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
              ranking: { points: 1000, tier: 'Bronze', winStreak: 0, bestWinStreak: 0 },
              stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 }
            };
            
            console.log('User built, going to lobby');
            setUser(userData);
            clearAuthTimeout();
            setLoading(false);
            
            // Check if user was in a room before refresh
            const storedRoomId = realtimeService.getStoredRoomId();
            if (storedRoomId) {
              console.log('Found stored room, attempting to rejoin:', storedRoomId);
              const room = await realtimeService.getRoom(storedRoomId);
              if (room) {
                const players = parsePlayers(room.players);
                const isInRoom = players.some(p => p.id === userData.id);
                if (isInRoom && room.status !== 'ended') {
                  console.log('User still in room, restoring...');
                  setCurrentRoom(room);
                  setScreen(SCREENS.ONLINE_GAME);
                } else {
                  console.log('User not in room anymore, clearing stored room');
                  realtimeService.clearCurrentRoom();
                  setScreen(SCREENS.LOBBY);
                }
              } else {
                console.log('Room no longer exists, clearing stored room');
                realtimeService.clearCurrentRoom();
                setScreen(SCREENS.LOBBY);
              }
            } else {
              setScreen(SCREENS.LOBBY);
            }
            
            // Fetch full profile in background
            authService.getProfile().then(profile => {
              if (profile && isMounted) {
                console.log('Full profile loaded in background');
                setUser(profile);
              }
            }).catch(err => console.warn('Background profile fetch failed:', err));
            
            return;
          }
        }
        
        // Fallback to localStorage token
        const token = localStorage.getItem('token');
        if (token && isMounted) {
          try {
            const userData = await authService.getProfile();
            if (userData && isMounted) {
              setUser(userData);
              setScreen(SCREENS.LOBBY);
            } else {
              localStorage.removeItem('token');
            }
          } catch (e) {
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.log('Session check error:', error);
        localStorage.removeItem('token');
      }
      
      clearAuthTimeout();
      if (isMounted) setLoading(false);
    };

    checkAuth();
    
    // Listen for Supabase auth changes - only set up once
    if (supabase && !subscriptionRef.current) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        // Prevent duplicate processing
        if (authChangeProcessing.current) return;
        
        // Only handle specific events, ignore TOKEN_REFRESHED and INITIAL_SESSION to prevent loops
        if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') {
          return;
        }
        
        authChangeProcessing.current = true;
        
        // Clear the timeout since we got an auth event
        clearAuthTimeout();
        
        try {
          if (event === 'SIGNED_IN' && session && isMounted) {
            console.log('SIGNED_IN event, building user from session...');
            
            // Build user directly from session to avoid hanging on profile fetch
            const user = session.user;
            const userData = {
              id: user.id,
              email: user.email,
              username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
              ranking: { points: 1000, tier: 'Bronze', winStreak: 0, bestWinStreak: 0 },
              stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 }
            };
            
            console.log('User built from session:', userData.username);
            setUser(userData);
            setScreen(SCREENS.LOBBY);
            setLoading(false);
            
            // Fetch full profile in background (don't block)
            authService.getProfile().then(profile => {
              if (profile && isMounted) {
                console.log('Full profile loaded in background');
                setUser(profile);
              }
            }).catch(err => console.warn('Background profile fetch failed:', err));
            
          } else if (event === 'SIGNED_OUT' && isMounted) {
            setUser(null);
            setScreen(SCREENS.AUTH);
            setLoading(false);
          }
        } catch (e) {
          console.log('Profile error on auth change:', e);
        } finally {
          // Reset processing flag after a delay to debounce
          setTimeout(() => {
            authChangeProcessing.current = false;
          }, 1000);
        }
      });
      subscriptionRef.current = data.subscription;
    }
    
    return () => {
      isMounted = false;
      // Don't unsubscribe on every render, keep it alive
    };
  }, []);

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    // Supabase Realtime handles connections automatically
    setScreen(SCREENS.LOBBY);
  };

  // Handle logout
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setCurrentRoom(null);
    setScreen(SCREENS.AUTH);
  };

  // Handle joining a room
  const handleJoinRoom = (room) => {
    setCurrentRoom(room);
    setScreen(SCREENS.ONLINE_GAME);
  };

  // Handle leaving a room
  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setScreen(SCREENS.LOBBY);
  };

  // Handle playing local game
  const handlePlayLocal = () => {
    setScreen(SCREENS.LOCAL_GAME);
  };

  // Handle back to lobby from local game
  const handleBackToLobby = () => {
    setScreen(SCREENS.LOBBY);
  };

  // Loading screen
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>🚔 COPS & ROBBERS 💰</h1>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Render current screen
  switch (screen) {
    case SCREENS.AUTH:
      return <Auth onLoginSuccess={handleLoginSuccess} onPlayLocal={handlePlayLocal} />;

    case SCREENS.LOBBY:
      // Guard: if no user, go back to auth
      if (!user) {
        return <Auth onLoginSuccess={handleLoginSuccess} onPlayLocal={handlePlayLocal} />;
      }
      return (
        <Lobby 
          user={user}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={(room) => handleJoinRoom(room)}
          onLogout={handleLogout}
          onPlayLocal={handlePlayLocal}
        />
      );

    case SCREENS.ONLINE_GAME:
      return (
        <OnlineGame 
          room={currentRoom}
          user={user}
          onLeaveRoom={handleLeaveRoom}
        />
      );

    case SCREENS.LOCAL_GAME:
      return (
        <div className="local-game-wrapper">
          <button className="back-to-lobby-btn" onClick={handleBackToLobby}>
            ← Back to Lobby
          </button>
          <Game />
        </div>
      );

    default:
      return <Auth onLoginSuccess={handleLoginSuccess} onPlayLocal={handlePlayLocal} />;
  }
}

export default App;
