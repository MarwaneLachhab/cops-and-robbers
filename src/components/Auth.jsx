import React, { useState } from 'react';
import authService from '../services/auth';
import './Auth.css';

function Auth({ onLoginSuccess, onPlayLocal }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (username.length < 3) {
          setError('Username must be at least 3 characters');
          setLoading(false);
          return;
        }
        await authService.register(username, email, password);
      } else {
        // Login uses email
        await authService.login(email, password);
      }
      
      onLoginSuccess(authService.getUser());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🚔 COPS & ROBBERS 💰</h1>
        <h2>{mode === 'login' ? 'Welcome Back!' : 'Create Account'}</h2>
        
        <div className="auth-tabs">
          <button 
            className={mode === 'login' ? 'active' : ''} 
            onClick={() => { setMode('login'); setError(''); }}
          >
            Login
          </button>
          <button 
            className={mode === 'register' ? 'active' : ''} 
            onClick={() => { setMode('register'); setError(''); }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on">
          {mode === 'register' && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '⏳ Loading...' : mode === 'login' ? '🎮 Login' : '🚀 Register'}
          </button>
        </form>

        <div className="guest-option">
          <p>or</p>
          <button className="guest-btn" onClick={onPlayLocal}>
            🎮 Play Offline (Local 2P)
          </button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
