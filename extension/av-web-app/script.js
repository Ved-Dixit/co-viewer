let sessionCode = new URLSearchParams(window.location.search).get('code');
let socket = null;
let peerConnection = null;
let localStream = null;
let isCamOn = false;
let isMicOn = false;

const status = document.getElementById('status');
const video = document.getElementById('video');
const placeholder = document.getElementById('placeholder');
const toggleCamBtn = document.getElementById('toggleCam');
const toggleMicBtn = document.getElementById('toggleMic');

if (!sessionCode) {
  status.textContent = 'Error: No session code';
} else {
  status.textContent = `Live: ${sessionCode}`;
  init();
}

function init() {
  const wsUrl = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.SIGNALING_SERVER_URL : 'ws://localhost:8080';
  
  socket = new WebSocket(wsUrl);
  socket.onopen = () => {
    console.log('AV Portal connected');
    status.textContent = `Connected: ${sessionCode}`;
  };
  socket.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'signal') handleSignal(data.payload);
  };
  socket.onerror = () => {
    status.textContent = 'Connection Error';
  };
  socket.onclose = () => {
    status.textContent = 'Disconnected';
  };
}

toggleCamBtn.onclick = async () => {
  isCamOn = !isCamOn;
  toggleCamBtn.classList.toggle('active', isCamOn);
  placeholder.classList.toggle('hidden', isCamOn);
  updateMedia();
};

toggleMicBtn.onclick = async () => {
  isMicOn = !isMicOn;
  toggleMicBtn.classList.toggle('active', isMicOn);
  updateMedia();
};

async function updateMedia() {
  try {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    
    if (isCamOn || isMicOn) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: isCamOn,
        audio: isMicOn
      });
      video.srcObject = localStream;
      
      setupPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'signal', code: sessionCode, payload: offer }));
      } else {
        status.textContent = 'Error: Not connected';
      }
    } else {
      video.srcObject = null;
    }
  } catch (err) {
    console.error(err);
    status.textContent = 'Hardware Error';
  }
}

function setupPeerConnection() {
  if (peerConnection) peerConnection.close();
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  peerConnection.onicecandidate = (e) => {
    if (e.candidate && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'signal', code: sessionCode, payload: { type: 'ice', candidate: e.candidate } }));
    }
  };
}

function handleSignal(payload) {
  if (!peerConnection) setupPeerConnection();
  if (payload.type === 'answer') peerConnection.setRemoteDescription(payload);
  else if (payload.type === 'ice') peerConnection.addIceCandidate(payload.candidate);
}
