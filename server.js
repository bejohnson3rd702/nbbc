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

// Local in-memory stores for fallback database mode
let localPrayers = [
  { id: 1, sender: 'Sister Beatrice', text: 'Prayers for my nephew who is traveling overseas.', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), praying_count: 3 },
  { id: 2, sender: 'Brother Caleb', text: 'Thank you for praying for my recovery. The doctors say I am healing well.', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), praying_count: 5 }
];

app.get('/api/prayers', (req, res) => {
  res.json(localPrayers);
});

app.post('/api/prayers', (req, res) => {
  const { sender, text } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ error: 'Sender and text are required' });
  }
  const newPrayer = {
    id: Date.now(),
    sender,
    text,
    created_at: new Date().toISOString(),
    praying_count: 0
  };
  localPrayers.unshift(newPrayer);
  res.status(201).json(newPrayer);
});

app.post('/api/prayers/:id/react', (req, res) => {
  const id = parseInt(req.params.id);
  const prayer = localPrayers.find(p => p.id === id);
  if (!prayer) {
    return res.status(404).json({ error: 'Prayer not found' });
  }
  prayer.praying_count += 1;
  res.json(prayer);
});

app.post('/api/generate-notes', async (req, res) => {
  const { title, timeline } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Sermon title is required' });
  }

  const timelineList = timeline || [];
  const key = process.env.GEMINI_API_KEY;

  if (key) {
    try {
      console.log('Generating sermon notes using Gemini API...');
      const prompt = `You are an AI theology assistant. Generate a highly polished, structured, and inspiring sermon study guide notes for a sermon titled "${title}". 
Here is the chronological timeline of what the pastor spotlighted during the service:
${timelineList.map(item => `[${item.timestamp}] (${item.type}) ${item.text}`).join('\n')}

Please format the response in clean Markdown (without wrapping it in markdown code block ticks like \`\`\`markdown) using the following outline:
# ${title}
## Sermon Overview
(Provide a 2-3 sentence summary of the core message)

## Key Scripture References
(List all scriptures mentioned in the timeline, with brief summaries of their context in the sermon)

## Core Sermon Points & Takeaways
(Detail the main points of the sermon based on the timeline, adding constructive theological and practical context for the congregation)

## Practical Application & Reflection
(Provide 3 thought-provoking questions or action steps for personal or small group reflection)`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const responseData = await response.json();
      let aiNotes = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiNotes) {
        aiNotes = aiNotes.replace(/^```markdown\n/, '').replace(/```$/, '');
        return res.json({ notes: aiNotes });
      }
    } catch (e) {
      console.error('Error generating notes with Gemini API:', e);
    }
  }

  // Fallback heuristic generator
  console.log('Generating sermon notes using fallback template...');
  const scriptures = timelineList.filter(t => t.type === 'scripture');
  const points = timelineList.filter(t => t.type === 'point');

  let markdown = `# ${title}\n\n`;
  markdown += `## Sermon Overview\n`;
  markdown += `This service centered around the theme of *"${title}"*. We explored how the scriptures guide us to live out our faith daily, remain steadfast, and build a strong spiritual foundation in our lives.\n\n`;

  markdown += `## Key Scripture References\n`;
  if (scriptures.length > 0) {
    scriptures.forEach(s => {
      markdown += `- **${s.text}** (Shared at ${s.timestamp})\n`;
    });
  } else {
    markdown += `*No specific scriptures were spotlit during this service. We encourage you to study the Bible daily and apply its wisdom to your life.*\n`;
  }
  markdown += `\n`;

  markdown += `## Core Sermon Points & Takeaways\n`;
  if (points.length > 0) {
    points.forEach(p => {
      markdown += `- **${p.text}** (Shared at ${p.timestamp})\n`;
    });
  } else {
    markdown += `- **Stay Anchored in Faith**: Keep your trust in God's promises during all seasons.\n`;
    markdown += `- **Community Fellowship**: Walk together in unity and lift one another up in prayer.\n`;
  }
  markdown += `\n`;

  markdown += `## Practical Application & Reflection\n`;
  markdown += `1. **Reflect**: How does today's word, *"${title}"*, challenge your current walk of faith?\n`;
  markdown += `2. **Pray**: Spend time this week asking for guidance to apply this scripture in your daily choices.\n`;
  markdown += `3. **Share**: Discuss these key takeaways with a friend, family member, or small group this week.\n`;

  res.json({ notes: markdown });
});

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
let currentSpotlight = null;

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

          // Send current scripture spotlight state
          ws.send(JSON.stringify({
            type: 'scripture-spotlight',
            scripture: currentSpotlight
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

        case 'prayer-post': {
          broadcast({
            type: 'prayer-posted',
            prayer: msg.prayer
          });
          break;
        }

        case 'prayer-react': {
          broadcast({
            type: 'prayer-reacted',
            id: msg.id,
            count: msg.count
          });
          break;
        }

        case 'push-announcement': {
          broadcast({
            type: 'push-announcement',
            title: msg.title,
            text: msg.text
          });
          break;
        }

        case 'scripture-spotlight': {
          currentSpotlight = msg.scripture;
          broadcast({
            type: 'scripture-spotlight',
            scripture: currentSpotlight
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

      broadcast({
        type: 'members-list',
        members: getActiveMembers()
      });
    }
  });
});
