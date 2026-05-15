// sidepanel.js
let socket = null;
let reconnectAttempts = 0;

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const sessionStatus = document.getElementById('sessionStatus');
const shareScreenBtn = document.getElementById('shareScreen');
const aiStatusDiv = document.getElementById('aiStatus');
const localRecapBtn = document.getElementById('localRecap');
const endSessionBtn = document.getElementById('endSession');
const recapModal = document.getElementById('recapModal');
const recapText = document.getElementById('recapText');
const closeRecapBtn = document.getElementById('closeRecap');
const toggleMicBtn = document.getElementById('toggleMic');
const openAVStudioBtn = document.getElementById('openAVStudio');
const recordVoiceBtn = document.getElementById('recordVoice');
const avPortalIframe = document.getElementById('avPortalIframe');
const avPortalContainer = document.getElementById('avPortalContainer');
const videoContainer = document.getElementById('videoContainer');
const viewHistoryBtn = document.getElementById('viewHistory');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');
const closeHistoryBtn = document.getElementById('closeHistory');
const clearHistoryBtn = document.getElementById('clearHistory');
const copyCodeBtn = document.getElementById('copyCode');
const reconnectBtn = document.getElementById('reconnect');

let sessionCode = null;
let role = null;
let messages = [];
let aiEngine = new LocalAI();
let mediaRecorder = null;
let audioChunks = [];

// Initialize AI
aiEngine.init().then(() => {
  aiStatusDiv.textContent = `AI: ${aiEngine.type === 'gemini' ? 'Gemini Nano' : 'Transformers.js'} Ready`;
});

function connectWebSocket() {
  if (socket) {
    socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
    socket.close();
  }

  socket = new WebSocket(APP_CONFIG.SIGNALING_SERVER_URL);

  socket.onopen = () => {
    console.log('Connected to signaling server');
    reconnectAttempts = 0;
    sessionStatus.textContent = sessionCode ? `Code: ${sessionCode}` : 'Connected';
    sessionStatus.classList.add('online');
    reconnectBtn.classList.add('hidden');
    
    if (sessionCode) {
      socket.send(JSON.stringify({ type: role === 'host' ? 'create-session' : 'join-session', code: sessionCode }));
      copyCodeBtn.classList.remove('hidden');
    } else {
      // Check if we have a pending session from the popup
      chrome.runtime.sendMessage({ type: 'get-current-session' }, (response) => {
        if (response) {
          role = response.role;
          if (role === 'host') {
            socket.send(JSON.stringify({ type: 'create-session' }));
            document.getElementById('noSessionHint').classList.add('hidden');
          } else if (response.code) {
            sessionCode = response.code;
            socket.send(JSON.stringify({ type: 'join-session', code: sessionCode }));
            document.getElementById('noSessionHint').classList.add('hidden');
          }
        }
      });
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
    sessionStatus.textContent = 'Connection Error';
    sessionStatus.classList.remove('online');
    reconnectBtn.classList.remove('hidden');
  };

  socket.onclose = () => {
    console.log('WebSocket closed');
    sessionStatus.textContent = 'Disconnected';
    sessionStatus.classList.remove('online');
    reconnectBtn.classList.remove('hidden');
    
    // Auto-reconnect logic
    if (reconnectAttempts < APP_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${APP_CONFIG.MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(connectWebSocket, APP_CONFIG.RECONNECT_INTERVAL);
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'session-created':
        sessionCode = data.code;
        sessionStatus.textContent = `Code: ${sessionCode}`;
        sessionStatus.classList.add('online');
        copyCodeBtn.classList.remove('hidden');
        document.getElementById('noSessionHint').classList.add('hidden');
        chrome.runtime.sendMessage({ type: 'update-session-code', code: sessionCode });
        shareScreenBtn.classList.remove('hidden');
        addSystemMessage(`Session created. Share code: ${sessionCode}`);
        break;

      case 'session-joined':
        sessionCode = data.code;
        sessionStatus.textContent = `Joined: ${sessionCode}`;
        sessionStatus.classList.add('online');
        copyCodeBtn.classList.remove('hidden');
        addSystemMessage(`Joined session: ${sessionCode}`);
        break;

      case 'peer-joined':
        addSystemMessage('Peer joined the session.');
        break;

      case 'chat':
        if (data.payloadType === 'audio') {
          addAudioMessage(data.from, data.payload, 'received');
        } else {
          addChatMessage(data.from, data.payload, 'received');
        }
        break;

      case 'chat-history':
        if (data.payload && Array.isArray(data.payload)) {
          // Clear current chat display to avoid duplicates
          chatMessages.innerHTML = '<div class="system-msg">Synced from Cloud ☁️</div>';
          messages = []; 
          data.payload.forEach(msg => {
            if (msg.MESSAGE_TYPE === 'audio') {
              addAudioMessage(msg.SENDER_ROLE === role ? 'Me' : msg.SENDER_ROLE, msg.MESSAGE_TEXT, msg.SENDER_ROLE === role ? 'sent' : 'received');
            } else {
              addChatMessage(msg.SENDER_ROLE === role ? 'Me' : msg.SENDER_ROLE, msg.MESSAGE_TEXT, msg.SENDER_ROLE === role ? 'sent' : 'received');
            }
          });
        }
        break;

      case 'signal':
        handleSignal(data.payload);
        break;

      case 'peer-disconnected':
        addSystemMessage('Peer disconnected.');
        break;
    }
  };
}

connectWebSocket();

reconnectBtn.addEventListener('click', () => {
  reconnectAttempts = 0;
  connectWebSocket();
});

copyCodeBtn.addEventListener('click', () => {
  if (sessionCode) {
    navigator.clipboard.writeText(sessionCode).then(() => {
      const originalText = sessionStatus.textContent;
      sessionStatus.textContent = 'Copied!';
      setTimeout(() => {
        sessionStatus.textContent = originalText;
      }, 2000);
    });
  }
});

document.getElementById('sidepanelCreate').addEventListener('click', () => {
  role = 'host';
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'create-session' }));
    document.getElementById('noSessionHint').classList.add('hidden');
  } else {
    addSystemMessage('Not connected to server. Attempting to reconnect...');
    connectWebSocket();
  }
});

document.getElementById('sidepanelJoin').addEventListener('click', () => {
  const code = document.getElementById('sidepanelJoinInput').value.trim().toUpperCase();
  if (code.length === 6) {
    sessionCode = code;
    role = 'guest';
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'join-session', code: sessionCode }));
      document.getElementById('noSessionHint').classList.add('hidden');
    } else {
      addSystemMessage('Not connected to server. Attempting to reconnect...');
      connectWebSocket();
    }
  } else {
    alert('Please enter a valid 6-character code.');
  }
});

function addChatMessage(from, text, type) {
  const msg = { from, text, time: new Date() };
  messages.push(msg);
  
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAudioMessage(from, base64Audio, type) {
  const msg = { from, text: '[Voice Message]', time: new Date() };
  messages.push(msg);
  
  const div = document.createElement('div');
  div.className = `message ${type}`;
  
  const audio = document.createElement('audio');
  audio.src = base64Audio;
  audio.controls = true;
  
  div.appendChild(audio);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-msg';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendMessageBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (!text) return;
  
  if (!sessionCode) {
    addSystemMessage('Cannot send message: No active session.');
    return;
  }
  
  if (socket.readyState !== WebSocket.OPEN) {
    addSystemMessage('Cannot send message: Server connection is lost.');
    return;
  }

  socket.send(JSON.stringify({ type: 'chat', code: sessionCode, payload: text }));
  addChatMessage('Me', text, 'sent');
  messageInput.value = '';
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessageBtn.click();
  }
});

// Voice Message Logic
recordVoiceBtn.addEventListener('mousedown', startRecording);
recordVoiceBtn.addEventListener('mouseup', stopRecording);
recordVoiceBtn.addEventListener('mouseleave', stopRecording);

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Audio = reader.result;
        socket.send(JSON.stringify({ 
          type: 'chat', 
          code: sessionCode, 
          payload: base64Audio, 
          payloadType: 'audio' 
        }));
        addAudioMessage('Me', base64Audio, 'sent');
      };
      stream.getTracks().forEach(t => t.stop());
    };
    
    mediaRecorder.start();
    recordVoiceBtn.classList.add('recording');
  } catch (err) {
    console.error('Recording failed:', err);
    addSystemMessage('Microphone access denied for recording.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordVoiceBtn.classList.remove('recording');
  }
}

// AV Controls
if (openAVStudioBtn) {
  openAVStudioBtn.addEventListener('click', () => {
    if (sessionCode) {
      avPortalIframe.src = `${APP_CONFIG.AV_WEB_APP_URL}?code=${sessionCode}`;
      avPortalContainer.classList.remove('hidden');
      addSystemMessage('AV Studio embedded. Turn on Cam/Mic inside the frame.');
    } else {
      addSystemMessage('Please start a session first.');
    }
  });
}

// Screen Sharing Logic
shareScreenBtn.addEventListener('click', () => {
  chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'], (streamId) => {
    if (streamId) {
      videoContainer.classList.remove('hidden');
      startScreenShare(streamId);
    }
  });
});

async function startScreenShare(streamId) {
  addSystemMessage('Starting screen share...');
  chrome.runtime.sendMessage({
    type: 'start-capture',
    target: 'offscreen',
    streamId: streamId
  });
}

// Local Recap Logic
localRecapBtn.addEventListener('click', async () => {
  recapModal.classList.remove('hidden');
  recapText.textContent = "Analyzing your local chat history...";
  
  const summary = await aiEngine.summarize(messages);
  recapText.textContent = summary;
  
  saveSessionToHistory(summary);
});

async function saveSessionToHistory(summary) {
  if (!sessionCode) return;
  
  const historyItem = {
    code: sessionCode,
    date: new Date().toLocaleString(),
    summary: summary,
    messageCount: messages.length
  };

  chrome.storage.local.get(['sessionHistory'], (result) => {
    const history = result.sessionHistory || [];
    const existingIndex = history.findIndex(h => h.code === sessionCode);
    if (existingIndex > -1) {
      history[existingIndex] = historyItem;
    } else {
      history.unshift(historyItem);
    }
    chrome.storage.local.set({ sessionHistory: history });
  });
}

viewHistoryBtn.addEventListener('click', () => {
  historyModal.classList.remove('hidden');
  loadHistory();
});

function loadHistory() {
  chrome.storage.local.get(['sessionHistory'], (result) => {
    const history = result.sessionHistory || [];
    historyList.innerHTML = history.length === 0 ? '<p class="system-msg">No past sessions found.</p>' : '';
    
    history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <span class="history-date">${item.date}</span>
        <h4>Session ${item.code}</h4>
        <p>${item.summary}</p>
        <div style="font-size: 0.6rem; color: var(--primary); margin-top: 5px;">${item.messageCount} messages</div>
      `;
      historyList.appendChild(div);
    });
  });
}

closeHistoryBtn.addEventListener('click', () => {
  historyModal.classList.add('hidden');
});

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all history?')) {
    chrome.storage.local.set({ sessionHistory: [] }, () => {
      loadHistory();
    });
  }
});

closeRecapBtn.addEventListener('click', () => {
  recapModal.classList.add('hidden');
});

endSessionBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to end the session?')) {
    window.close();
  }
});

const toggleRemoteBtn = document.getElementById('toggleRemote');
const remoteVideo = document.getElementById('remoteVideo');

let remoteControlEnabled = false;

toggleRemoteBtn.addEventListener('click', () => {
  remoteControlEnabled = !remoteControlEnabled;
  toggleRemoteBtn.textContent = `Remote: ${remoteControlEnabled ? 'ON' : 'Off'}`;
  toggleRemoteBtn.classList.toggle('active', remoteControlEnabled);
  
  if (remoteControlEnabled) {
    addSystemMessage('Remote Control Enabled. Click on the video to interact.');
  }
});

// Capture interaction on the video
remoteVideo.addEventListener('click', (e) => {
  if (!remoteControlEnabled || !sessionCode) return;

  const rect = remoteVideo.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  socket.send(JSON.stringify({
    type: 'remote-action',
    code: sessionCode,
    payload: { action: 'click', x, y }
  }));
});

remoteVideo.addEventListener('wheel', (e) => {
  if (!remoteControlEnabled || !sessionCode) return;

  // Prevent scrolling the sidepanel itself
  e.preventDefault();

  socket.send(JSON.stringify({
    type: 'remote-action',
    code: sessionCode,
    payload: { action: 'scroll', deltaX: e.deltaX, deltaY: e.deltaY }
  }));
}, { passive: false });

// WebRTC Signaling Bridge
function handleSignal(payload) {
  chrome.runtime.sendMessage({
    type: payload.type === 'offer' ? 'handle-offer' : (payload.type === 'answer' ? 'handle-answer' : 'handle-ice'),
    target: 'offscreen',
    offer: payload,
    answer: payload,
    candidate: payload.candidate
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'sidepanel' && message.type === 'signal') {
    socket.send(JSON.stringify({ type: 'signal', code: sessionCode, payload: message.payload }));
  } else if (message.type === 'remote-action' && message.target === 'sidepanel') {
    // If we receive a remote action (as host), handle it
    handleRemoteAction(message.payload);
  }
});

function handleRemoteAction(action) {
  // Pass to service worker to inject into active tab
  chrome.runtime.sendMessage({ type: 'execute-remote-action', payload: action });
}
