import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');
const ADMIN_CODE = 'NBBC2026';

const SERMONS_DIR = path.join(__dirname, 'sermons');
const SERMONS_FILE = path.join(__dirname, 'sermons.json');
const GIVING_FILE = path.join(__dirname, 'giving.json');

// Helper to read giving
function readGiving() {
  try {
    if (!fs.existsSync(GIVING_FILE)) {
      fs.writeFileSync(GIVING_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(GIVING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading giving records:', error);
    return [];
  }
}

// Helper to write giving
function writeGiving(records) {
  try {
    fs.writeFileSync(GIVING_FILE, JSON.stringify(records, null, 2));
  } catch (error) {
    console.error('Error writing giving records:', error);
  }
}

const SMS_FILE = path.join(__dirname, 'sms_messages.json');

// Helper to read SMS history
function readSMSHistory() {
  try {
    if (!fs.existsSync(SMS_FILE)) {
      fs.writeFileSync(SMS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(SMS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading SMS history:', error);
    return [];
  }
}

// Helper to write SMS history
function writeSMSHistory(history) {
  try {
    fs.writeFileSync(SMS_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error writing SMS history:', error);
  }
}

// Ensure sermons directory exists
if (!fs.existsSync(SERMONS_DIR)) {
  fs.mkdirSync(SERMONS_DIR, { recursive: true });
}

// Serve sermons folder statically
app.use('/sermons', express.static(SERMONS_DIR));

// Helper to read sermons
function readSermons() {
  try {
    if (!fs.existsSync(SERMONS_FILE)) {
      fs.writeFileSync(SERMONS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(SERMONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sermons:', error);
    return [];
  }
}

// Helper to write sermons
function writeSermons(sermons) {
  try {
    fs.writeFileSync(SERMONS_FILE, JSON.stringify(sermons, null, 2));
  } catch (error) {
    console.error('Error writing sermons:', error);
  }
}

// Helper to read users
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // Create seed pastor account
      const seedUsers = [
        {
          email: 'pastor@nbbc.org',
          name: 'Pastor John',
          password: 'password123',
          role: 'pastor'
        }
      ];
      fs.writeFileSync(USERS_FILE, JSON.stringify(seedUsers, null, 2));
      return seedUsers;
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}

// Helper to write users
function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users:', error);
  }
}

// API: Register
app.post('/api/register', (req, res) => {
  const { name, email, password, phone, adminCode } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const users = readUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  let role = 'member';
  if (adminCode) {
    if (adminCode === ADMIN_CODE) {
      role = 'pastor';
    } else {
      return res.status(400).json({ error: 'Invalid Church Administration Code' });
    }
  }

  const newUser = { name, email: email.toLowerCase(), password, phone: phone || '', role };
  users.push(newUser);
  writeUsers(users);

  // Return user info (omit password)
  const { password: _, ...userWithoutPassword } = newUser;
  res.status(201).json({ message: 'Registration successful', user: userWithoutPassword });
});

// API: Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { password: _, ...userWithoutPassword } = user;
  res.json({ message: 'Login successful', user: userWithoutPassword });
});

// API: Get SMS History
app.get('/api/sms-history', (req, res) => {
  res.json(readSMSHistory().slice().reverse()); // Newest first
});

// API: Send Broadcast SMS
app.post('/api/send-sms', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  // Get all members with a phone number
  const users = readUsers();
  const members = users.filter(u => u.role === 'member' && u.phone && u.phone.trim() !== '');

  console.log(`\n--- 📱 MOCK SMS BROADCAST GATEWAY ---`);
  console.log(`Message: "${message}"`);
  console.log(`Sending to ${members.length} recipients:`);
  
  members.forEach(member => {
    console.log(`  -> Sent to ${member.name} (${member.phone})`);
  });
  console.log(`------------------------------------\n`);

  const smsRecord = {
    id: Date.now(),
    message: message.trim(),
    recipientCount: members.length,
    recipients: members.map(m => ({ name: m.name, phone: m.phone })),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString()
  };

  try {
    const history = readSMSHistory();
    history.push(smsRecord);
    writeSMSHistory(history);
    res.status(201).json({ message: 'Broadcast successful', record: smsRecord });
  } catch (error) {
    console.error('Error saving SMS broadcast:', error);
    res.status(500).json({ error: 'Failed to record SMS broadcast' });
  }
});

// API: Get Giving Summary
app.get('/api/giving-summary', (req, res) => {
  const transactions = readGiving();
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  res.json({
    total,
    transactions: transactions.slice().reverse() // Newest first
  });
});

// API: Submit Tithe/Offering
app.post('/api/give', (req, res) => {
  const { name, email, amount, designation } = req.body;

  if (!name || !amount || !designation) {
    return res.status(400).json({ error: 'Name, amount, and designation are required' });
  }

  const floatAmount = parseFloat(amount);
  if (isNaN(floatAmount) || floatAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }

  const transaction = {
    id: Date.now(),
    name,
    email: email || 'anonymous@nbbc.org',
    amount: floatAmount,
    designation,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString()
  };

  try {
    const transactions = readGiving();
    transactions.push(transaction);
    writeGiving(transactions);

    // Broadcast update via WebSocket
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    broadcast({
      type: 'giving-update',
      total,
      recentTransaction: transaction
    });

    res.status(201).json({ message: 'Gift received. Thank you!', transaction });
  } catch (error) {
    console.error('Error saving giving transaction:', error);
    res.status(500).json({ error: 'Failed to record donation' });
  }
});

// API: Get Sermons Archive
app.get('/api/sermons', (req, res) => {
  res.json(readSermons());
});

// API: Upload/Archive Sermon Video
app.post('/api/upload-sermon', express.raw({ type: 'video/webm', limit: '150mb' }), (req, res) => {
  const title = decodeURIComponent(req.headers['x-sermon-title'] || 'Untitled Sermon');
  const date = req.headers['x-sermon-date'] || new Date().toLocaleDateString();

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Video data is empty' });
  }

  const id = Date.now();
  const filename = `sermon_${id}.webm`;
  const filepath = path.join(SERMONS_DIR, filename);

  try {
    fs.writeFileSync(filepath, req.body);

    const sermons = readSermons();
    const newSermon = {
      id,
      title,
      date,
      videoUrl: `/sermons/${filename}`
    };
    sermons.push(newSermon);
    writeSermons(sermons);

    res.status(201).json({ message: 'Sermon archived successfully', sermon: newSermon });
  } catch (error) {
    console.error('Error saving sermon video:', error);
    res.status(500).json({ error: 'Failed to write video file to disk' });
  }
});

// Serve static files from the React build folder (dist)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Serve index.html for client-side routing on any GET request except API endpoints
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  // Helpful developer status page in dev mode
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
const server = app.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
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
          // Send WebRTC SDP/ICE candidate to the target client
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
            // System message in chat
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
            
            // Find target client and update status
            clients.forEach((cVal) => {
              if (cVal.email === targetEmail) {
                if (action === 'approve') {
                  cVal.isMuted = false;
                  cVal.handRaised = false; // lower hand after approval
                } else if (action === 'revoke') {
                  cVal.isMuted = true;
                  cVal.isStreaming = false;
                } else if (action === 'mute') {
                  cVal.isMuted = true;
                }
              }
            });

            // Send command specifically to the target member to toggle their media
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

            // Clear streaming status for all members when service stops
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

      // If the pastor disconnected, set service state to offline
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
