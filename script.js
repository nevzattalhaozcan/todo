document.addEventListener('DOMContentLoaded', () => {
  let timer;
  let isRunning = false;
  let timeLeft = 0;

  const timeInput = document.getElementById('timeInput');
  const timerDisplay = document.getElementById('timerDisplay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const alarmSound = document.getElementById('alarmSound');

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Add this function to update the display based on dropdown selection
  function updateDisplayFromDropdown() {
    const minutes = parseFloat(timeInput.value);
    timerDisplay.textContent = `${String(Math.floor(minutes)).padStart(2, '0')}:00`;
    if (!isRunning) {
      timeLeft = Math.round(minutes * 60);
    }
  }

  // Listen for dropdown changes
  timeInput.addEventListener('change', updateDisplayFromDropdown);

  // Unlock audio on first user interaction
  let audioUnlocked = false;
  function unlockAudio() {
    if (!audioUnlocked) {
      alarmSound.muted = true;
      alarmSound.play().catch(() => {});
      alarmSound.pause();
      alarmSound.currentTime = 0;
      alarmSound.muted = false;
      audioUnlocked = true;
    }
  }

  // Activity card and log elements
  const activityCards = document.querySelectorAll('.activity-card');
  const activityLog = document.getElementById('activityLog');

  // Track selected activity and session
  let selectedActivity = null;
  let sessionStarted = false;
  let lastSession = null;

  // Load logs from localStorage and display them
  function loadLogsFromLocalStorage() {
    const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
    activityLog.innerHTML = '';
    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'list-group-item py-1 px-2';
      const userInfo = log.user ? ` (${log.user})` : '';
      li.innerHTML = `<span style="font-size:1.2rem;">${log.icon || "📝"}</span> <strong>${log.activity || "General"}</strong> &mdash; <span>${log.duration} min</span> <span class="text-muted" style="font-size:0.85em;">${log.time}${userInfo}</span>`;
      activityLog.appendChild(li);
    });
    activityLog.scrollTop = activityLog.scrollHeight;
  }

  // Save a new log to localStorage
  function saveLogToLocalStorage(logData) {
    const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
    logs.push(logData);
    localStorage.setItem('activityLogs', JSON.stringify(logs));
  }

  // WebSocket Sync initialization (replace WebRTC)
  const pomodoroSync = new PomodoroWebSocketSync();
  let isReceivingSync = false; // Flag to prevent loops

  // Chat elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const chatPanel = document.getElementById('chatPanel');
  const toggleChatBtn = document.getElementById('toggleChatBtn');
  const activeUsers = document.getElementById('activeUsers');
  const userCount = document.getElementById('userCount');

  // Spotify elements
  const spotifyPanel = document.getElementById('spotifyPanel');
  const toggleSpotifyBtn = document.getElementById('toggleSpotifyBtn');

  // Active users management
  let activeUsersList = new Set();
  let currentUserNickname = '';

  function updateActiveUsers() {
    activeUsers.innerHTML = '';
    
    if (activeUsersList.size === 0) {
      activeUsers.innerHTML = '<div class="text-muted text-center small">No users yet...</div>';
      userCount.textContent = '0';
      return;
    }

    activeUsersList.forEach(nickname => {
      const userSpan = document.createElement('span');
      userSpan.className = 'badge bg-light text-dark me-1 mb-1';
      userSpan.style.fontSize = '0.75em';
      userSpan.textContent = nickname === currentUserNickname ? `${nickname} (you)` : nickname;
      activeUsers.appendChild(userSpan);
    });
    
    userCount.textContent = activeUsersList.size.toString();
  }

  function addActiveUser(nickname) {
    activeUsersList.add(nickname);
    updateActiveUsers();
  }

  function removeActiveUser(nickname) {
    activeUsersList.delete(nickname);
    updateActiveUsers();
  }

  // Chat functionality
  function addChatMessage(message, isOwn = false, nickname = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `mb-2 ${isOwn ? 'text-end' : ''}`;
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const displayName = nickname ? `${nickname}: ` : '';
    messageDiv.innerHTML = `
      <div class="small ${isOwn ? 'bg-primary text-white' : 'bg-white'} rounded px-2 py-1 d-inline-block" style="max-width: 80%;">
        ${nickname && !isOwn ? `<strong>${nickname}:</strong> ` : ''}${message}
        <div class="small ${isOwn ? 'text-white-50' : 'text-muted'}" style="font-size: 0.7em;">${time}</div>
      </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Remove placeholder text
    const placeholder = chatMessages.querySelector('.text-muted.text-center');
    if (placeholder) {
      placeholder.remove();
    }
  }

  function sendChatMessage() {
    const message = chatInput.value.trim();
    const nickname = currentUserNickname || 'Anonymous';
    if (message) {
      addChatMessage(message, true);
      
      // Broadcast to peers
      pomodoroSync.broadcast({
        type: 'chat_message',
        message: message,
        nickname: nickname,
        timestamp: Date.now()
      });
      
      chatInput.value = '';
    }
  }

  // Chat toggle functionality
  let isChatVisible = true;
  toggleChatBtn.addEventListener('click', () => {
    isChatVisible = !isChatVisible;
    if (isChatVisible) {
      chatPanel.style.display = 'flex';
      toggleChatBtn.textContent = '💬 Chat';
      toggleChatBtn.classList.remove('btn-outline-primary');
      toggleChatBtn.classList.add('btn-outline-secondary');
    } else {
      chatPanel.style.display = 'none';
      toggleChatBtn.textContent = '💬 Show';
      toggleChatBtn.classList.remove('btn-outline-secondary');
      toggleChatBtn.classList.add('btn-outline-primary');
    }
  });

  // Spotify toggle functionality
  let isSpotifyVisible = true;
  toggleSpotifyBtn.addEventListener('click', () => {
    isSpotifyVisible = !isSpotifyVisible;
    if (isSpotifyVisible) {
      spotifyPanel.style.display = 'flex';
      toggleSpotifyBtn.textContent = '🎵 Hide';
    } else {
      spotifyPanel.style.display = 'none';
      toggleSpotifyBtn.textContent = '🎵 Show';
    }
  });

  // Also add Spotify toggle to main timer card
  const mainTimerCard = document.querySelector('.card');
  if (!document.getElementById('toggleSpotifyMainBtn')) {
    const spotifyToggleMain = document.createElement('button');
    spotifyToggleMain.id = 'toggleSpotifyMainBtn';
    spotifyToggleMain.className = 'btn btn-outline-secondary btn-sm';
    spotifyToggleMain.textContent = '🎵 Music';
    spotifyToggleMain.addEventListener('click', () => {
      toggleSpotifyBtn.click();
    });
    
    // Add to room controls
    const roomControlsButtons = document.querySelector('#roomControls .d-flex.gap-2');
    roomControlsButtons.appendChild(spotifyToggleMain);
  }

  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });

  // Send heartbeat to maintain active status
  function sendHeartbeat() {
    if (currentUserNickname && pomodoroSync.roomId) {
      pomodoroSync.broadcast({
        type: 'user_heartbeat',
        nickname: currentUserNickname,
        timestamp: Date.now()
      });
    }
  }

  // Send heartbeat every 30 seconds
  setInterval(sendHeartbeat, 30000);

  // Clean inactive users every minute
  setInterval(() => {
    const now = Date.now();
    const keys = Object.keys(localStorage);
    const heartbeatKeys = keys.filter(key => key.startsWith(`heartbeat_${pomodoroSync.roomId}_`));
    
    heartbeatKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        // Remove users who haven't sent heartbeat in 2 minutes
        if (now - data.timestamp > 120000) {
          removeActiveUser(data.nickname);
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    });
  }, 60000);

  // Room control elements
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const roomInfo = document.getElementById('roomInfo');
  const roomIdDisplay = document.getElementById('roomIdDisplay');
  const joinRoomInput = document.getElementById('joinRoomInput');
  const roomIdInput = document.getElementById('roomIdInput');
  const joinRoomSubmit = document.getElementById('joinRoomSubmit');
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameInputDiv = document.getElementById('nicknameInputDiv');
  const confirmNicknameBtn = document.getElementById('confirmNicknameBtn');
  const activeUsersSection = document.getElementById('activeUsersSection');

  // Track current action (create or join)
  let currentAction = null;

  // Room controls
  createRoomBtn.addEventListener('click', () => {
    currentAction = 'create';
    nicknameInputDiv.style.display = 'block';
    createRoomBtn.style.display = 'none';
    joinRoomBtn.style.display = 'none';
    nicknameInput.focus();
  });

  joinRoomBtn.addEventListener('click', () => {
    currentAction = 'join';
    nicknameInputDiv.style.display = 'block';
    createRoomBtn.style.display = 'none';
    joinRoomBtn.style.display = 'none';
    nicknameInput.focus();
  });

  confirmNicknameBtn.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      alert('Please enter your nickname!');
      nicknameInput.focus();
      return;
    }

    currentUserNickname = nickname;
    nicknameInputDiv.style.display = 'none';
    nicknameInput.disabled = true;

    if (currentAction === 'create') {
      await createRoom(nickname);
    } else if (currentAction === 'join') {
      joinRoomInput.style.display = 'block';
      roomIdInput.focus();
    }
  });

  // Allow Enter key in nickname input
  nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmNicknameBtn.click();
    }
  });

  async function createRoom(nickname) {
    try {
      const roomId = await pomodoroSync.createRoom(nickname);
      roomIdDisplay.textContent = roomId;
      roomInfo.style.display = 'block';
      
      // Show active users section
      activeUsersSection.style.display = 'block';
      
      // Add yourself to active users
      addActiveUser(nickname);
      
      // Send initial heartbeat
      sendHeartbeat();
      
      // Add connection status
      addChatMessage(`🟢 Room created by ${nickname}! Share this ID: ${roomId}`, false);
      addChatMessage('📱 Open this app in other tabs/devices with the same Room ID to sync!', false);
    } catch (error) {
      console.error('Failed to create room:', error);
      addChatMessage('❌ Failed to create room. Please try again.', false);
    }
  }

  joinRoomSubmit.addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim();
    const nickname = currentUserNickname;
    
    if (roomId) {
      try {
        await pomodoroSync.joinRoom(roomId, nickname);
        roomIdDisplay.textContent = roomId;
        roomInfo.style.display = 'block';
        joinRoomInput.style.display = 'none';
        
        // Show active users section
        activeUsersSection.style.display = 'block';
        
        // Add yourself to active users
        addActiveUser(nickname);
        
        // Send initial heartbeat
        sendHeartbeat();
        
        // Add connection status
        addChatMessage(`🟢 ${nickname} joined room: ${roomId}`, false);
        addChatMessage('📱 You\'re now synced with other users in this room!', false);
        
        // Broadcast join message
        pomodoroSync.broadcast({
          type: 'user_joined',
          nickname: nickname,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Failed to join room:', error);
        addChatMessage('❌ Failed to join room. Please check the ID and try again.', false);
      }
    }
  });

  // Allow Enter key in room ID input
  roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinRoomSubmit.click();
    }
  });

  // Handle incoming sync data
  pomodoroSync.setDataHandler((data) => {
    if (isReceivingSync) return; // Prevent loops
    isReceivingSync = true;
    
    if (data.type === 'timer_sync') {
      if (!isRunning && data.isRunning) {
        timeLeft = data.timeLeft;
        isRunning = data.isRunning;
        updateDisplay();
        startBtn.disabled = data.isRunning;
        pauseBtn.disabled = !data.isRunning;
      }
    } else if (data.type === 'timer_started') {
      addChatMessage(`⏰ ${data.startedBy} started ${data.duration} min focus session (${data.activity || 'General'})`, false);
    } else if (data.type === 'activity_log') {
      // Only add if not already in localStorage to prevent duplicates
      const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
      const exists = logs.some(log => 
        log.activity === data.log.activity && 
        log.time === data.log.time && 
        log.duration === data.log.duration &&
        log.user === data.log.user
      );
      if (!exists) {
        saveLogToLocalStorage(data.log);
        loadLogsFromLocalStorage();
      }
    } else if (data.type === 'activity_completed') {
      // Play alarm sound for all users when someone completes a session
      unlockAudio();
      alarmSound.currentTime = 0;
      alarmSound.play().catch(() => {});
      
      // Add to activity log
      const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
      const exists = logs.some(log => 
        log.activity === data.log.activity && 
        log.time === data.log.time && 
        log.duration === data.log.duration &&
        log.user === data.log.user
      );
      if (!exists) {
        saveLogToLocalStorage(data.log);
        loadLogsFromLocalStorage();
      }
      
      // Show completion notification
      addChatMessage(`🎉 ${data.completedBy} completed ${data.log.duration} min of ${data.log.activity}!`, false);
    } else if (data.type === 'activity_selection') {
      activityCards.forEach(c => c.classList.remove('selected'));
      const card = document.querySelector(`[data-activity="${data.activity}"]`);
      if (card) {
        card.classList.add('selected');
        selectedActivity = {
          name: card.getAttribute('data-activity'),
          icon: card.querySelector('span').textContent
        };
      }
    } else if (data.type === 'chat_message') {
      addChatMessage(data.message, false, data.nickname);
    } else if (data.type === 'user_joined') {
      addActiveUser(data.nickname);
      addChatMessage(`👋 ${data.nickname} joined the room!`, false);
    } else if (data.type === 'user_heartbeat') {
      addActiveUser(data.nickname);
      // Store heartbeat in localStorage
      localStorage.setItem(`heartbeat_${pomodoroSync.roomId}_${data.nickname}`, JSON.stringify({
        nickname: data.nickname,
        timestamp: data.timestamp
      }));
    }
    
    setTimeout(() => {
      isReceivingSync = false;
    }, 100);
  });

  // Helper to log activity session
  function logActivitySession(session) {
    if (!session || !session.duration) return;
    const activity = session.activity && session.activity.name ? session.activity : { name: "General", icon: "📝" };
    const now = new Date(session.endTime || Date.now());
    const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    
    const logData = {
      activity: activity.name,
      icon: activity.icon,
      duration: session.duration,
      time: timeStr,
      user: currentUserNickname || 'Anonymous'
    };

    const li = document.createElement('li');
    li.className = 'list-group-item py-1 px-2';
    li.innerHTML = `<span style="font-size:1.2rem;">${activity.icon}</span> <strong>${activity.name}</strong> &mdash; <span>${session.duration} min</span> <span class="text-muted" style="font-size:0.85em;">${timeStr}</span>`;
    activityLog.appendChild(li);
    activityLog.scrollTop = activityLog.scrollHeight;

    saveLogToLocalStorage(logData);
    
    // Only broadcast if not receiving sync and user is in a room
    if (!isReceivingSync && pomodoroSync.roomId) {
      pomodoroSync.broadcast({
        type: 'activity_completed',
        log: logData,
        completedBy: currentUserNickname || 'Anonymous'
      });
      
      // Send completion notification to chat
      addChatMessage(`🎉 ${currentUserNickname || 'Anonymous'} completed ${session.duration} min of ${activity.name}!`, false);
    }
  }

  function startTimer() {
    unlockAudio();
    if (isRunning) return;
    isRunning = true;

    // Only set timeLeft if it's zero (i.e., first start, not resume)
    if (timeLeft === 0) {
      timeLeft = Math.round(parseFloat(timeInput.value) * 60) || 1500;
    }
    updateDisplay();

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resetBtn.disabled = false;
    timeInput.disabled = true;

    // Mark session started and store session info
    sessionStarted = true;
    lastSession = {
      activity: selectedActivity,
      duration: parseFloat(timeInput.value),
      endTime: null
    };

    // Broadcast timer start (only if not receiving sync and user is in a room)
    if (!isReceivingSync && pomodoroSync.roomId) {
      pomodoroSync.broadcast({
        type: 'timer_started',
        isRunning: true,
        timeLeft: timeLeft,
        duration: parseFloat(timeInput.value),
        startedBy: currentUserNickname || 'Anonymous',
        activity: selectedActivity ? selectedActivity.name : 'General'
      });
      
      // Send start notification to chat
      const activityName = selectedActivity ? selectedActivity.name : 'General';
      addChatMessage(`⏰ ${currentUserNickname || 'Anonymous'} started ${parseFloat(timeInput.value)} min focus session (${activityName})`, false);
    }

    timer = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(timer);
        timerDisplay.textContent = "Time's up!";
        alarmSound.currentTime = 0;
        alarmSound.play().catch(() => {});
        isRunning = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        timeInput.disabled = false;
        
        if (sessionStarted && lastSession) {
          lastSession.endTime = Date.now();
          logActivitySession(lastSession);
          sessionStarted = false;
          lastSession = null;
        }
      } else {
        timeLeft--;
        updateDisplay();
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timer);
    isRunning = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Resume';
    pauseBtn.disabled = true;
  }

  function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    timeLeft = Math.round(parseFloat(timeInput.value) * 60) || 1500;
    updateDisplay();
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
    timeInput.disabled = false;
    // Stop and reset alarm sound
    alarmSound.pause();
    alarmSound.currentTime = 0;
    // Log session if valid
    if (sessionStarted && lastSession && lastSession.activity) {
      lastSession.endTime = Date.now();
      logActivitySession(lastSession);
      sessionStarted = false;
      lastSession = null;
    }
  }

  // Log session if app is closed while timer is running
  window.addEventListener('beforeunload', () => {
    if (sessionStarted && lastSession && lastSession.activity) {
      lastSession.endTime = Date.now();
      logActivitySession(lastSession);
      sessionStarted = false;
      lastSession = null;
    }
  });

  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);

  // Handle activity card selection (radio-style)
  activityCards.forEach(card => {
    card.addEventListener('click', () => {
      if (isReceivingSync) return; // Prevent loops
      
      activityCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedActivity = {
        name: card.getAttribute('data-activity'),
        icon: card.querySelector('span').textContent
      };
      
      if (sessionStarted && lastSession) {
        lastSession.activity = selectedActivity;
      }

      // Broadcast activity selection
      pomodoroSync.broadcast({
        type: 'activity_selection',
        activity: selectedActivity.name
      });
    });
  });

  updateDisplayFromDropdown();
  loadLogsFromLocalStorage();
});
