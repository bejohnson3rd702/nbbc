import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3001',
    'https://nbbc-alpha.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Serve static files from the React build folder (dist) if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  // Status page for development
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <body style="font-family: sans-serif; background: #0b0f19; color: #f1f5f9; text-align: center; padding-top: 100px;">
          <h1 style="color: #e2a850; font-size: 2.2rem; margin-bottom: 10px;">NBBC API & Signaling Server</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 20px;">The backend service is running successfully on port 3001.</p>
          <p style="font-size: 1rem;">To visit the client web application, open:</p>
          <a href="http://localhost:5173" style="color: #f59e0b; font-weight: bold; font-size: 1.3rem; text-decoration: none; border: 1px solid rgba(217, 119, 6, 0.4); padding: 10px 20px; border-radius: 6px; display: inline-block; margin-top: 10px; background: rgba(226, 168, 80, 0.1);">
            http://localhost:5173
          </a>
        </body>
      </html>
    `);
  });
}

// Start HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP Server running on http://0.0.0.0:${PORT}`);
});

// WebSocket signaling & room state
const wss = new WebSocketServer({ server });

// Keep track of connected clients
// key: socket, value: { email, name, role, isStreaming, isMuted, handRaised }
const clients = new Map();
let serviceActive = false;

function broadcast(messageObj) {
  const data = JSON.stringify(messageObj);
  clients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendToClient(targetEmail, messageObj) {
  const data = JSON.stringify(messageObj);
  clients.forEach((clientInfo, ws) => {
    if (clientInfo.email === targetEmail && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function getActiveMembers() {
  return Array.from(clients.values()).map(c => ({
    email: c.email,
    name: c.name,
    role: c.role,
    isStreaming: c.isStreaming,
    isMuted: c.isMuted,
    handRaised: c.handRaised
  }));
}

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'join': {
          const { email, name, role } = msg;
          clients.set(ws, {
            email,
            name,
            role,
            isStreaming: false,
            isMuted: true,
            handRaised: false
          });

          console.log(`${name} (${role}) joined`);

          // Send current service state and members list
          ws.send(JSON.stringify({
            type: 'service-state',
            status: serviceActive ? 'live' : 'offline'
          }));

          broadcast({
            type: 'members-list',
            members: getActiveMembers()
          });
          break;
        }

        case 'signal': {
          const { target, signalData, sender } = msg;
          sendToClient(target, {
            type: 'signal',
            sender,
            signalData
          });
          break;
        }

        case 'chat': {
          const client = clients.get(ws);
          if (client) {
            broadcast({
              type: 'chat',
              senderName: client.name,
              senderEmail: client.email,
              senderRole: client.role,
              text: msg.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
          break;
        }

        case 'reaction': {
          const client = clients.get(ws);
          if (client) {
            broadcast({
              type: 'reaction',
              emoji: msg.emoji,
              senderName: client.name
            });
          }
          break;
        }

        case 'hand-raise': {
          const client = clients.get(ws);
          if (client) {
            client.handRaised = msg.raised;
            broadcast({
              type: 'members-list',
              members: getActiveMembers()
            });
            broadcast({
              type: 'chat',
              senderName: 'System',
              senderEmail: 'system',
              senderRole: 'system',
              text: `${client.name} has ${msg.raised ? 'raised their hand' : 'lowered their hand'}.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
          break;
        }

        case 'hand-approve': {
          const client = clients.get(ws);
          if (client && client.role === 'pastor') {
            const { targetEmail, action } = msg;
            
            clients.forEach((cVal) => {
              if (cVal.email === targetEmail) {
                if (action === 'approve') {
                  cVal.isMuted = false;
                  cVal.handRaised = false;
                } else if (action === 'revoke') {
                  cVal.isMuted = true;
                  cVal.isStreaming = false;
                } else if (action === 'mute') {
                  cVal.isMuted = true;
                }
              }
            });

            sendToClient(targetEmail, {
              type: 'media-control',
              action
            });

            broadcast({
              type: 'members-list',
              members: getActiveMembers()
            });
          }
          break;
        }

        case 'media-state': {
          const client = clients.get(ws);
          if (client) {
            client.isStreaming = msg.isStreaming;
            client.isMuted = msg.isMuted;
            broadcast({
              type: 'members-list',
              members: getActiveMembers()
            });
          }
          break;
        }

        case 'service-state': {
          const client = clients.get(ws);
          if (client && client.role === 'pastor') {
            serviceActive = msg.status === 'live';
            broadcast({
              type: 'service-state',
              status: serviceActive ? 'live' : 'offline'
            });

            if (!serviceActive) {
              clients.forEach((c) => {
                c.isStreaming = false;
                c.isMuted = true;
                c.handRaised = false;
              });
            }

            broadcast({
              type: 'members-list',
              members: getActiveMembers()
            });
          }
          break;
        }

        case 'giving-update': {
          broadcast({
            type: 'giving-update',
            total: msg.total,
            recentTransaction: msg.recentTransaction
          });
          break;
        }
      }
    } catch (e) {
      console.error('Error handling websocket message:', e);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`${client.name} disconnected`);
      clients.delete(ws);

      if (client.role === 'pastor') {
        serviceActive = false;
        broadcast({
          type: 'service-state',
          status: 'offline'
        });
      }

      broadcast({
        type: 'members-list',
        members: getActiveMembers()
      });
    }
  });
});
