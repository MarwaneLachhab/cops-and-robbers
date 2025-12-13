import { useState, useEffect } from 'react';
import Game from './Game';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import OnlineGame from './components/OnlineGame';
import authService from './services/auth';
import socketService from './services/socket';
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

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check Supabase session directly
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const userData = await authService.getProfile();
            if (userData) {
              setUser(userData);
              setScreen(SCREENS.LOBBY);
              socketService.connect(session.access_token);
              setLoading(false);
              return;
            }
          }
        }
        
        // Fallback to localStorage token
        const token = localStorage.getItem('token');
        if (token) {
          const userData = await authService.getProfile();
          if (userData) {
            setUser(userData);
            setScreen(SCREENS.LOBBY);
            socketService.connect(token);
          } else {
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.log('Session check error:', error);
        localStorage.removeItem('token');
      }
      setLoading(false);
    };

    checkAuth();
    
    // Listen for Supabase auth changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          const userData = await authService.getProfile();
          if (userData) {
            setUser(userData);
            setScreen(SCREENS.LOBBY);
            socketService.connect(session.access_token);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setScreen(SCREENS.AUTH);
        }
      });
      
      return () => subscription.unsubscribe();
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token);
    }
    setScreen(SCREENS.LOBBY);
  };

  // Handle logout
  const handleLogout = () => {
    authService.logout();
    socketService.disconnect();
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
