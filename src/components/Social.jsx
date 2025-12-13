import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import './Social.css';

function Social({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
      loadUnreadCount();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id);
      // Mark messages as read
      markMessagesAsRead(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user || !supabase) return;

    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        if (selectedUser && payload.new.sender_id === selectedUser.id) {
          setMessages(prev => [...prev, payload.new]);
          markMessagesAsRead(selectedUser.id);
        } else {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, selectedUser]);

  const loadFriends = async () => {
    if (!supabase) return;
    
    const { data } = await supabase
      .from('friendships')
      .select(`
        id,
        status,
        friend:friend_id(id, username, ranking, stats),
        user:user_id(id, username, ranking, stats)
      `)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (data) {
      const friendsList = data.map(f => {
        return f.user.id === user.id ? f.friend : f.user;
      });
      setFriends(friendsList);
    }
  };

  const loadPendingRequests = async () => {
    if (!supabase) return;

    const { data } = await supabase
      .from('friendships')
      .select(`
        id,
        user:user_id(id, username, ranking)
      `)
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (data) {
      setPendingRequests(data);
    }
  };

  const loadUnreadCount = async () => {
    if (!supabase) return;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);

    setUnreadCount(count || 0);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !supabase) return;
    
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, ranking, stats')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user.id)
      .limit(10);

    setSearchResults(data || []);
    setLoading(false);
  };

  const sendFriendRequest = async (friendId) => {
    if (!supabase) return;

    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
      });

    if (!error) {
      alert('Friend request sent!');
      setSearchResults(prev => prev.filter(u => u.id !== friendId));
    }
  };

  const acceptFriendRequest = async (requestId) => {
    if (!supabase) return;

    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    loadFriends();
    loadPendingRequests();
  };

  const rejectFriendRequest = async (requestId) => {
    if (!supabase) return;

    await supabase
      .from('friendships')
      .delete()
      .eq('id', requestId);

    loadPendingRequests();
  };

  const removeFriend = async (friendId) => {
    if (!supabase || !confirm('Remove this friend?')) return;

    await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    loadFriends();
    setSelectedUser(null);
  };

  const loadMessages = async (friendId) => {
    if (!supabase) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages(data || []);
  };

  const markMessagesAsRead = async (senderId) => {
    if (!supabase) return;

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
      .eq('read', false);

    loadUnreadCount();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !supabase) return;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: newMessage.trim()
      })
      .select()
      .single();

    if (!error && data) {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      'Bronze': '#cd7f32',
      'Silver': '#c0c0c0',
      'Gold': '#ffd700',
      'Platinum': '#00d9ff',
      'Diamond': '#b9f2ff',
      'Master': '#ff6b6b',
      'Legend': '#ff00ff'
    };
    return colors[tier] || '#666';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="social-overlay">
      <div className="social-container">
        <div className="social-header">
          <h2>👥 Social</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="social-tabs">
          <button 
            className={activeTab === 'friends' ? 'active' : ''} 
            onClick={() => setActiveTab('friends')}
          >
            Friends ({friends.length})
          </button>
          <button 
            className={activeTab === 'requests' ? 'active' : ''} 
            onClick={() => setActiveTab('requests')}
          >
            Requests {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length}</span>}
          </button>
          <button 
            className={activeTab === 'search' ? 'active' : ''} 
            onClick={() => setActiveTab('search')}
          >
            Add Friend
          </button>
          <button 
            className={activeTab === 'messages' ? 'active' : ''} 
            onClick={() => setActiveTab('messages')}
          >
            Messages {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
        </div>

        <div className="social-content">
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="friends-list">
              {friends.length === 0 ? (
                <div className="empty-state">
                  <p>No friends yet</p>
                  <button onClick={() => setActiveTab('search')}>Find Friends</button>
                </div>
              ) : (
                friends.map(friend => (
                  <div 
                    key={friend.id} 
                    className="friend-card"
                    onClick={() => { setSelectedUser(friend); setActiveTab('messages'); }}
                  >
                    <div className="friend-avatar">
                      {friend.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="friend-info">
                      <h4>{friend.username}</h4>
                      <span 
                        className="tier-badge"
                        style={{ color: getTierColor(friend.ranking?.tier) }}
                      >
                        {friend.ranking?.tier || 'Bronze'} • {friend.ranking?.points || 1000} pts
                      </span>
                    </div>
                    <div className="friend-stats">
                      <span>🎮 {friend.stats?.gamesPlayed || 0}</span>
                      <span>🏆 {friend.stats?.gamesWon || 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 'requests' && (
            <div className="requests-list">
              {pendingRequests.length === 0 ? (
                <div className="empty-state">
                  <p>No pending requests</p>
                </div>
              ) : (
                pendingRequests.map(request => (
                  <div key={request.id} className="request-card">
                    <div className="friend-avatar">
                      {request.user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="friend-info">
                      <h4>{request.user.username}</h4>
                      <span className="tier-badge">
                        {request.user.ranking?.tier || 'Bronze'}
                      </span>
                    </div>
                    <div className="request-actions">
                      <button 
                        className="accept-btn"
                        onClick={() => acceptFriendRequest(request.id)}
                      >
                        ✓
                      </button>
                      <button 
                        className="reject-btn"
                        onClick={() => rejectFriendRequest(request.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="search-section">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                />
                <button onClick={searchUsers} disabled={loading}>
                  {loading ? '...' : '🔍'}
                </button>
              </div>
              
              <div className="search-results">
                {searchResults.map(result => (
                  <div key={result.id} className="search-result-card">
                    <div className="friend-avatar">
                      {result.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="friend-info">
                      <h4>{result.username}</h4>
                      <span 
                        className="tier-badge"
                        style={{ color: getTierColor(result.ranking?.tier) }}
                      >
                        {result.ranking?.tier || 'Bronze'} • {result.ranking?.points || 1000} pts
                      </span>
                    </div>
                    <button 
                      className="add-friend-btn"
                      onClick={() => sendFriendRequest(result.id)}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="messages-section">
              <div className="messages-sidebar">
                <h4>Conversations</h4>
                {friends.map(friend => (
                  <div 
                    key={friend.id}
                    className={`conversation-item ${selectedUser?.id === friend.id ? 'active' : ''}`}
                    onClick={() => setSelectedUser(friend)}
                  >
                    <div className="friend-avatar small">
                      {friend.username?.charAt(0).toUpperCase()}
                    </div>
                    <span>{friend.username}</span>
                  </div>
                ))}
              </div>
              
              <div className="messages-main">
                {selectedUser ? (
                  <>
                    <div className="messages-header">
                      <div className="friend-avatar small">
                        {selectedUser.username?.charAt(0).toUpperCase()}
                      </div>
                      <h4>{selectedUser.username}</h4>
                      <button 
                        className="view-profile-btn"
                        onClick={() => setActiveTab('profile')}
                      >
                        View Profile
                      </button>
                    </div>
                    
                    <div className="messages-list">
                      {messages.map(msg => (
                        <div 
                          key={msg.id}
                          className={`message ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                        >
                          <p>{msg.content}</p>
                          <span className="message-time">{formatTime(msg.created_at)}</span>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    
                    <form className="message-input" onSubmit={sendMessage}>
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                      />
                      <button type="submit">Send</button>
                    </form>
                  </>
                ) : (
                  <div className="empty-state">
                    <p>Select a friend to start chatting</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile View */}
          {activeTab === 'profile' && selectedUser && (
            <div className="profile-view">
              <button className="back-btn" onClick={() => setActiveTab('messages')}>
                ← Back
              </button>
              
              <div className="profile-header">
                <div className="profile-avatar large">
                  {selectedUser.username?.charAt(0).toUpperCase()}
                </div>
                <h2>{selectedUser.username}</h2>
                <span 
                  className="tier-badge large"
                  style={{ color: getTierColor(selectedUser.ranking?.tier) }}
                >
                  {selectedUser.ranking?.tier || 'Bronze'}
                </span>
              </div>
              
              <div className="profile-stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{selectedUser.ranking?.points || 1000}</span>
                  <span className="stat-label">Points</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{selectedUser.stats?.gamesPlayed || 0}</span>
                  <span className="stat-label">Games</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{selectedUser.stats?.gamesWon || 0}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {selectedUser.stats?.gamesPlayed > 0 
                      ? Math.round((selectedUser.stats.gamesWon / selectedUser.stats.gamesPlayed) * 100)
                      : 0}%
                  </span>
                  <span className="stat-label">Win Rate</span>
                </div>
              </div>
              
              <div className="profile-actions">
                <button 
                  className="message-btn"
                  onClick={() => setActiveTab('messages')}
                >
                  💬 Message
                </button>
                <button 
                  className="remove-btn"
                  onClick={() => removeFriend(selectedUser.id)}
                >
                  Remove Friend
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Social;
