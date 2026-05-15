let peerConnection;
let screenStream;
let avStream;
let senders = {}; // { cam: sender, mic: sender, screen: sender }

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'start-capture':
      startCapture(message.streamId);
      break;
    case 'toggle-cam':
      toggleCam(message.enabled);
      break;
    case 'toggle-mic':
      toggleMic(message.enabled);
      break;
    case 'create-offer':
      createOffer();
      break;
    case 'handle-offer':
      handleOffer(message.offer);
      break;
    case 'handle-answer':
      handleAnswer(message.answer);
      break;
    case 'handle-ice':
      handleIce(message.candidate);
      break;
  }
});

async function startCapture(streamId) {
  try {
    screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    });

    if (!peerConnection) setupPeerConnection();
    screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));
    
    // Create offer if we are the host
    createOffer();
  } catch (err) {
    console.error('Error starting capture:', err);
  }
}

async function toggleCam(enabled) {
  try {
    if (enabled) {
      if (!avStream) avStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = avStream.getVideoTracks()[0];
      if (peerConnection) {
        if (senders.cam) {
          senders.cam.replaceTrack(track);
        } else {
          senders.cam = peerConnection.addTrack(track, avStream);
        }
      }
    } else {
      if (senders.cam && peerConnection) {
        peerConnection.removeTrack(senders.cam);
        senders.cam = null;
      }
      if (avStream) avStream.getVideoTracks().forEach(t => t.stop());
    }
    renegotiate();
  } catch (err) { console.error(err); }
}

async function toggleMic(enabled) {
  try {
    if (enabled) {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track = micStream.getAudioTracks()[0];
      if (peerConnection) {
        if (senders.mic) {
          senders.mic.replaceTrack(track);
        } else {
          senders.mic = peerConnection.addTrack(track, micStream);
        }
      }
    } else {
      if (senders.mic && peerConnection) {
        peerConnection.removeTrack(senders.mic);
        senders.mic = null;
      }
    }
    renegotiate();
  } catch (err) { console.error(err); }
}

function renegotiate() {
  // If we are already connected, we need to send a new offer
  if (peerConnection && peerConnection.signalingState === 'stable') {
    createOffer();
  }
}

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      chrome.runtime.sendMessage({ type: 'signal', payload: { type: 'ice', candidate: event.candidate }, target: 'sidepanel' });
    }
  };

  peerConnection.ontrack = (event) => {
    // Notify sidepanel that a new track (screen or cam) has arrived
    chrome.runtime.sendMessage({ 
      type: 'track-received', 
      target: 'sidepanel',
      kind: event.track.kind
    });
    
    // In a more advanced version, we'd use a BroadcastChannel or similar to show the video
    // but for now, we'll stick to the signaling bridge.
  };
}

async function createOffer() {
  if (!peerConnection) setupPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  chrome.runtime.sendMessage({ type: 'signal', payload: offer, target: 'sidepanel' });
}

async function handleOffer(offer) {
  if (!peerConnection) setupPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  chrome.runtime.sendMessage({ type: 'signal', payload: answer, target: 'sidepanel' });
}

async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIce(candidate) {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}
