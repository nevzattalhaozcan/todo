class PomodoroWebSocketSync {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.userId = Math.random().toString(36).substring(2, 15);
    this.nickname = null;
    this.onDataReceived = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageQueue = [];
  }

  async createRoom(nickname) {
    this.roomId = Math.random().toString(36).substring(2, 15);
    this.nickname = nickname;
    await this.connect();
    console.log('Room created:', this.roomId);
    return this.roomId;
  }

  async joinRoom(roomId, nickname) {
    this.roomId = roomId;
    this.nickname = nickname;
    await this.connect();
    console.log('Joined room:', roomId);
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Using ws://localhost:8080 - you'll need to run a simple WebSocket server
      // For now, let's simulate with localStorage + intervals for cross-tab sync
      this.simulateWebSocketWithStorage();
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.simulateWebSocketWithStorage();
    }
  }

  // Fallback: simulate WebSocket using localStorage for cross-tab communication
  simulateWebSocketWithStorage() {
    this.isConnected = true;
    console.log('Using localStorage fallback for sync');
    
    // Listen for storage changes (cross-tab communication)
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(`room_${this.roomId}_`) && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          
          // Don't process our own messages
          if (data.userId !== this.userId && this.onDataReceived) {
            this.onDataReceived(data);
          }
        } catch (error) {
          console.error('Failed to parse storage message:', error);
        }
      }
    });

    // Clean old messages periodically
    setInterval(() => {
      this.cleanOldStorageMessages();
    }, 30000);
  }

  broadcast(data) {
    if (!this.isConnected || !this.roomId) {
      console.warn('Cannot broadcast - not connected or no room');
      return;
    }

    const message = {
      ...data,
      roomId: this.roomId,
      userId: this.userId,
      nickname: this.nickname,
      timestamp: Date.now()
    };

    // Store in localStorage with unique key
    const messageKey = `room_${this.roomId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    localStorage.setItem(messageKey, JSON.stringify(message));
  }

  cleanOldStorageMessages() {
    const keys = Object.keys(localStorage);
    const roomKeys = keys.filter(key => key.startsWith(`room_${this.roomId}_`));
    const now = Date.now();
    
    roomKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        // Remove messages older than 5 minutes
        if (now - data.timestamp > 300000) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    });
  }

  setDataHandler(callback) {
    this.onDataReceived = callback;
  }

  disconnect() {
    this.isConnected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
