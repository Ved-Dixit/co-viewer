// config.js - Centralized configuration for Co-Viewer
const CONFIG = {
  // Replace these with your production URLs before final deployment
  SIGNALING_SERVER_URL: 'ws://localhost:8080',
  AV_WEB_APP_URL: 'http://localhost:3000',
  
  // Reconnection settings
  RECONNECT_INTERVAL: 2000,
  MAX_RECONNECT_ATTEMPTS: 5
};

// Use globalThis to make it available in all extension contexts without complex modules
globalThis.APP_CONFIG = CONFIG;
