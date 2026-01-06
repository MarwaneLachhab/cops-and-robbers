import { supabase } from './supabase';

class RealtimeService {
  constructor() {
    this.roomChannel = null;
    this.gameChannel = null;
    this.lobbyChannel = null;
    this.currentRoom = null;
    this.listeners = new Map();
    this._isSubscribingLobby = false;
  }

  // Subscribe to lobby updates (room list)
  async subscribeLobby(onRoomsUpdate) {
    if (!supabase) return;
    
    // Prevent duplicate subscriptions
    if (this._isSubscribingLobby || this.lobbyChannel) {
      // If already subscribed, just fetch rooms
      const rooms = await this.getRooms();
      onRoomsUpdate(rooms);
      return;
    }
    
    this._isSubscribingLobby = true;

    try {
      // Subscribe to rooms table changes with unique channel name
      const channelName = `lobby-${Date.now()}`;
      this.lobbyChannel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rooms'
        }, async () => {
          // Debounce room updates to prevent too many fetches
          if (this._roomUpdateTimeout) {
            clearTimeout(this._roomUpdateTimeout);
          }
          this._roomUpdateTimeout = setTimeout(async () => {
            const rooms = await this.getRooms();
            onRoomsUpdate(rooms);
          }, 300);
        })
        .subscribe((status) => {
          console.log('Lobby subscription status:', status);
        });

      // Initial fetch
      const rooms = await this.getRooms();
      onRoomsUpdate(rooms);
    } finally {
      this._isSubscribingLobby = false;
    }
  }

  unsubscribeLobby() {
    if (this._roomUpdateTimeout) {
      clearTimeout(this._roomUpdateTimeout);
      this._roomUpdateTimeout = null;
    }
    if (this.lobbyChannel) {
      supabase.removeChannel(this.lobbyChannel);
      this.lobbyChannel = null;
    }
    this._isSubscribingLobby = false;
  }

  // Get all active rooms
  async getRooms() {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }

    return data || [];
  }

  // Create a new room
  async createRoom(hostId, hostUsername, roomName, mapName = 'easy', isPrivate = false, password = null) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name: roomName,
        host_id: hostId,
        map_name: mapName,
        is_private: isPrivate,
        password: password,
        status: 'waiting',
        players: JSON.stringify([{
          id: hostId,
          username: hostUsername,
          role: null,
          ready: false
        }])
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating room:', error);
      return null;
    }

    return data;
  }

  // Join a room
  async joinRoom(roomId, userId, username, password = null) {
    if (!supabase) return { success: false, error: 'Supabase not configured' };

    // Get current room
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return { success: false, error: 'Room not found' };
    }

    // Check password
    if (room.is_private && room.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }

    // Check if room is full
    const players = JSON.parse(room.players || '[]');
    if (players.length >= 2) {
      return { success: false, error: 'Room is full' };
    }

    // Check if already in room
    if (players.some(p => p.id === userId)) {
      return { success: true, room };
    }

    // Add player
    players.push({
      id: userId,
      username: username,
      role: null,
      ready: false
    });

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ players: JSON.stringify(players) })
      .eq('id', roomId);

    if (updateError) {
      return { success: false, error: 'Failed to join room' };
    }

    return { success: true, room: { ...room, players } };
  }

  // Leave a room
  async leaveRoom(roomId, userId) {
    if (!supabase) return;

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room) return;

    const players = JSON.parse(room.players || '[]');
    const newPlayers = players.filter(p => p.id !== userId);

    if (newPlayers.length === 0) {
      // Delete room if empty
      await supabase.from('rooms').delete().eq('id', roomId);
    } else {
      // Update host if host left
      const newHostId = room.host_id === userId ? newPlayers[0].id : room.host_id;
      await supabase
        .from('rooms')
        .update({ 
          players: JSON.stringify(newPlayers),
          host_id: newHostId
        })
        .eq('id', roomId);
    }
  }

  // Subscribe to a specific room for real-time updates
  subscribeRoom(roomId, callbacks) {
    if (!supabase) return;

    this.currentRoom = roomId;

    // Real-time channel for room
    this.roomChannel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        if (callbacks.onRoomUpdate) {
          const room = payload.new;
          room.players = JSON.parse(room.players || '[]');
          callbacks.onRoomUpdate(room);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, () => {
        if (callbacks.onRoomDeleted) {
          callbacks.onRoomDeleted();
        }
      })
      .on('broadcast', { event: 'game-state' }, (payload) => {
        if (callbacks.onGameState) {
          callbacks.onGameState(payload.payload);
        }
      })
      .on('broadcast', { event: 'game-start' }, (payload) => {
        if (callbacks.onGameStart) {
          callbacks.onGameStart(payload.payload);
        }
      })
      .on('broadcast', { event: 'game-end' }, (payload) => {
        if (callbacks.onGameEnd) {
          callbacks.onGameEnd(payload.payload);
        }
      })
      .on('broadcast', { event: 'player-input' }, (payload) => {
        if (callbacks.onPlayerInput) {
          callbacks.onPlayerInput(payload.payload);
        }
      })
      .subscribe();
  }

  unsubscribeRoom() {
    if (this.roomChannel) {
      supabase.removeChannel(this.roomChannel);
      this.roomChannel = null;
    }
    this.currentRoom = null;
  }

  // Update player in room (role, ready status)
  async updatePlayer(roomId, userId, updates) {
    if (!supabase) return;

    const { data: room } = await supabase
      .from('rooms')
      .select('players')
      .eq('id', roomId)
      .single();

    if (!room) return;

    const players = JSON.parse(room.players || '[]');
    const playerIndex = players.findIndex(p => p.id === userId);
    
    if (playerIndex !== -1) {
      players[playerIndex] = { ...players[playerIndex], ...updates };
      await supabase
        .from('rooms')
        .update({ players: JSON.stringify(players) })
        .eq('id', roomId);
    }
  }

  // Start game
  async startGame(roomId) {
    if (!supabase) return;

    await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);

    // Broadcast game start
    if (this.roomChannel) {
      this.roomChannel.send({
        type: 'broadcast',
        event: 'game-start',
        payload: { roomId, timestamp: Date.now() }
      });
    }
  }

  // Send game state update (for host)
  broadcastGameState(gameState) {
    if (this.roomChannel) {
      this.roomChannel.send({
        type: 'broadcast',
        event: 'game-state',
        payload: gameState
      });
    }
  }

  // Send player input
  sendPlayerInput(input) {
    if (this.roomChannel) {
      this.roomChannel.send({
        type: 'broadcast',
        event: 'player-input',
        payload: input
      });
    }
  }

  // End game
  async endGame(roomId, winnerId, winnerRole) {
    if (!supabase) return;

    await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', roomId);

    if (this.roomChannel) {
      this.roomChannel.send({
        type: 'broadcast',
        event: 'game-end',
        payload: { winnerId, winnerRole }
      });
    }
  }

  // Delete room
  async deleteRoom(roomId) {
    if (!supabase) return;
    await supabase.from('rooms').delete().eq('id', roomId);
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
