chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('Co-Viewer extension installed');
});

let currentSession = null;

// Listener for messages from popup or sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'initiate-session') {
    currentSession = { role: message.role, code: message.code || null };
    
    // Create offscreen document if it doesn't exist
    createOffscreen();

    // Open side panel
    chrome.windows.getCurrent((window) => {
      chrome.sidePanel.open({ windowId: window.id });
    });
  } else if (message.type === 'get-current-session') {
    sendResponse(currentSession);
    return true;
  } else if (message.type === 'update-session-code') {
    if (currentSession) currentSession.code = message.code;
  } else if (message.type === 'execute-remote-action') {
    handleRemoteAction(message.payload);
  }
});

async function handleRemoteAction(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['remote-handler.js']
  }).then(() => {
    chrome.tabs.sendMessage(tab.id, { type: 'remote-action', payload: action });
  }).catch(err => console.error('Failed to inject remote-handler:', err));
}

async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA', 'DISPLAY_MEDIA'],
    justification: 'To handle WebRTC streams and screen capture.'
  });
}
