document.getElementById('request').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(t => t.stop());
    document.getElementById('status').textContent = '✅ Permissions granted! You can close this tab.';
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    document.getElementById('status').textContent = '❌ Error: ' + err.message;
  }
});
