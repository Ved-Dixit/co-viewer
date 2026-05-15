// config.js - Centralized configuration for Co-Viewer
const CONFIG = {
  // Replace these with your production URLs before final deployment
  SIGNALING_SERVER_URL: 'ws://80.225.239.152:8080',
  AV_WEB_APP_URL: 'https://leafy-swan-399766.netlify.app',
  
  // Reconnection settings
  RECONNECT_INTERVAL: 2000,
  MAX_RECONNECT_ATTEMPTS: 5
};

// Use globalThis to make it available in all extension contexts without complex modules
globalThis.APP_CONFIG = CONFIG;
