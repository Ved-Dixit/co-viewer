const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

// Map to store active connections: code -> { host: ws, guest: ws }
const activeSessions = new Map();

// Initialize Database
db.initialize();

console.log(`Signaling server running on port ${port}`);

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    const { type, code, payload } = data;

    switch (type) {
      case 'create-session':
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        activeSessions.set(newCode, { host: ws, guest: null });
        ws.sessionCode = newCode;
        ws.role = 'host';
        
        // Persist to Oracle DB
        await db.saveSession(newCode, 'host');
        
        ws.send(JSON.stringify({ type: 'session-created', code: newCode }));
        console.log(`Session created and persisted: ${newCode}`);
        break;

      case 'join-session':
        const session = activeSessions.get(code);
        if (session && !session.guest) {
          session.guest = ws;
          ws.sessionCode = code;
          ws.role = 'guest';
          
          ws.send(JSON.stringify({ type: 'session-joined', code }));
          session.host.send(JSON.stringify({ type: 'peer-joined' }));
          
          // Automatically fetch history from DB
          const history = await db.getSessionMessages(code);
          ws.send(JSON.stringify({ type: 'chat-history', payload: history }));
          
          console.log(`Guest joined session: ${code}`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not found or full' }));
        }
        break;

      case 'chat':
      case 'remote-action':
        const targetSession = activeSessions.get(code);
        
        // Persist message to Oracle DB (only for chat)
        if (type === 'chat') {
          await db.saveMessage(code, ws.role, payload, data.payloadType || 'text');
        }
        
        if (targetSession) {
          const targetWs = ws.role === 'host' ? targetSession.guest : targetSession.host;
          if (targetWs) {
            targetWs.send(JSON.stringify({ type, payload, from: ws.role, payloadType: data.payloadType }));
          }
        }
        break;

      case 'signal':
        const signalSession = activeSessions.get(code);
        if (signalSession) {
          const targetWs = ws.role === 'host' ? signalSession.guest : signalSession.host;
          if (targetWs) {
            targetWs.send(JSON.stringify({ type, payload, from: ws.role }));
          }
        }
        break;
        
      case 'get-history':
        const messages = await db.getSessionMessages(code);
        ws.send(JSON.stringify({ type: 'chat-history', payload: messages }));
        break;
    }
  });

  ws.on('close', () => {
    if (ws.sessionCode) {
      const session = activeSessions.get(ws.sessionCode);
      if (session) {
        if (ws.role === 'host') {
          if (session.guest) session.guest.send(JSON.stringify({ type: 'peer-disconnected' }));
          activeSessions.delete(ws.sessionCode);
          console.log(`Session ${ws.sessionCode} closed (host left)`);
        } else {
          if (session.host) session.host.send(JSON.stringify({ type: 'peer-disconnected' }));
          session.guest = null;
          console.log(`Guest left session ${ws.sessionCode}`);
        }
      }
    }
  });
});

process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});
