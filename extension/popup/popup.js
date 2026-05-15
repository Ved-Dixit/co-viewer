document.getElementById('createSession').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'initiate-session', role: 'host' });
  window.close(); // Close popup, sidepanel will handle the rest
});

document.getElementById('joinSession').addEventListener('click', () => {
  const code = document.getElementById('sessionCodeInput').value.trim().toUpperCase();
  if (code.length === 6) {
    chrome.runtime.sendMessage({ type: 'initiate-session', role: 'guest', code });
    window.close();
  } else {
    alert('Please enter a valid 6-character code.');
  }
});

// If the sidepanel is already open and has a code, show it
chrome.runtime.sendMessage({ type: 'get-current-session' }, (response) => {
  if (response && response.code) {
    document.querySelector('.actions').classList.add('hidden');
    document.getElementById('activeSession').classList.remove('hidden');
    document.getElementById('displayCode').textContent = response.code;
  }
});
