import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Send, Users, 
  LogOut, Radio, Hand, Sparkles
} from 'lucide-react';

interface MemberStatus {
  email: string;
  name: string;
  role: 'pastor' | 'member';
  isStreaming: boolean;
  isMuted: boolean;
  handRaised: boolean;
}

interface ChatMessage {
  senderName: string;
  senderEmail: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface PastorDashboardProps {
  user: { name: string; email: string; role: 'pastor' | 'member' };
  onLogout: () => void;
  webrtc: {
    members: MemberStatus[];
    chatMessages: ChatMessage[];
    reactions: { id: number; emoji: string }[];
    serviceStatus: 'live' | 'offline';
    localStream: MediaStream | null;
    remoteStreams: { [email: string]: MediaStream };
    isCameraOn: boolean;
    isMicOn: boolean;
    sendChatMessage: (text: string) => void;
    sendReaction: (emoji: string) => void;
    givingTotal: number;
    givingTransactions: any[];
    givingToast: any | null;
    toggleCamera: () => void;
    toggleMic: () => void;
    toggleService: (start: boolean) => void;
  };
}

// Simulated data generator for high-fidelity testing
const SIMULATED_MEMBERS = [
  { email: 'beatrice@gmail.com', name: 'Sister Beatrice', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false },
  { email: 'caleb@outlook.com', name: 'Brother Caleb', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false },
  { email: 'mary@nbbc.org', name: 'Sister Mary', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false },
  { email: 'david@yahoo.com', name: 'Brother David', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false }
];

const SIMULATED_CHAT_TEXTS = [
  "Amen! Praise God.",
  "Good morning Pastor John! Greeting from the Smith family.",
  "Beautiful scripture choice for today.",
  "Praying for everyone's health this morning.",
  "Praise the Lord!",
  "Amen! Thank you Pastor for this word.",
  "This is a powerful message.",
  "Amen, so true."
];

const SIMULATED_EMOJIS = ['🙏', '👏', '❤️', '🙌', '✨'];

export default function PastorDashboard({ user, onLogout, webrtc }: PastorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'prayer' | 'giving' | 'sms'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [prayerWall, setPrayerWall] = useState<{ id: number; sender: string; text: string }[]>([
    { id: 1, sender: 'Sister Beatrice', text: 'Prayers for my nephew who is traveling overseas.' },
    { id: 2, sender: 'Brother Caleb', text: 'Thank you for praying for my recovery. The doctors say I am healing well.' }
  ]);
  const [prayerInput, setPrayerInput] = useState('');
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedMembersList, setSimulatedMembersList] = useState<MemberStatus[]>([]);
  const [simulatedChats, setSimulatedChats] = useState<ChatMessage[]>([]);
  const [simulatedReactions, setSimulatedReactions] = useState<{ id: number; emoji: string }[]>([]);

  // SMS Broadcast States
  const [smsMessage, setSmsMessage] = useState('');
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [loadingSMSHistory, setLoadingSMSHistory] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState(false);
  const [smsError, setSmsError] = useState('');

  const fetchSMSHistory = async () => {
    setLoadingSMSHistory(true);
    try {
      const response = await fetch('http://localhost:3001/api/sms-history');
      if (response.ok) {
        const data = await response.json();
        setSmsHistory(data);
      }
    } catch (e) {
      console.error('Error fetching SMS history:', e);
    } finally {
      setLoadingSMSHistory(false);
    }
  };

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsMessage.trim()) return;

    setSmsSending(true);
    setSmsError('');
    setSmsSuccess(false);

    try {
      const response = await fetch('http://localhost:3001/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: smsMessage.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      setSmsSuccess(true);
      setSmsMessage('');
      fetchSMSHistory();
      setTimeout(() => setSmsSuccess(false), 5000);
    } catch (err: any) {
      setSmsError(err.message || 'Connection failed.');
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sms') {
      fetchSMSHistory();
    }
  }, [activeTab]);

  // Recording & Uploading states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [sermonTitle, setSermonTitle] = useState('');
  const [sermonBlob, setSermonBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const expectRecordingRef = useRef<boolean>(false);

  const {
    members,
    chatMessages,
    reactions,
    serviceStatus,
    localStream,
    remoteStreams,
    isCameraOn,
    isMicOn,
    sendChatMessage,
    toggleCamera,
    toggleMic,
    toggleService,
    givingTotal,
    givingTransactions,
    givingToast
  } = webrtc;

  // Set local video stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle MediaRecorder initialization
  useEffect(() => {
    if (serviceStatus === 'live' && localStream) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        return;
      }

      console.log('Initializing MediaRecorder for stream...');
      chunksRef.current = [];
      
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      try {
        const recorderOptions: any = {
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 128000
        };
        if (mimeType) recorderOptions.mimeType = mimeType;

        const recorder = new MediaRecorder(localStream, recorderOptions);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          console.log('Recording stopped. Compiled chunks:', chunksRef.current.length);
          if (expectRecordingRef.current) {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setSermonBlob(blob);
            setShowUploadModal(true);
            expectRecordingRef.current = false;
          }
        };

        recorder.start(1000); // chunk every 1s
      } catch (err) {
        console.error('Failed to initialize MediaRecorder:', err);
      }
    }
  }, [serviceStatus, localStream]);

  const handleEndService = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      expectRecordingRef.current = true;
      mediaRecorderRef.current.stop();
    }
    toggleService(false);
  };

  const handleUploadSermon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sermonBlob || !sermonTitle.trim()) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const response = await fetch('http://localhost:3001/api/upload-sermon', {
        method: 'POST',
        headers: {
          'Content-Type': 'video/webm',
          'X-Sermon-Title': encodeURIComponent(sermonTitle.trim()),
          'X-Sermon-Date': new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
        },
        body: sermonBlob
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      setUploadSuccess(true);
      setTimeout(() => {
        setShowUploadModal(false);
        setSermonBlob(null);
        setSermonTitle('');
        setUploadSuccess(false);
      }, 2000);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to archive today\'s service.');
    } finally {
      setUploading(false);
    }
  };

  // Combine real and simulated members
  const allMembers = simulationActive 
    ? [...members, ...simulatedMembersList.filter(sm => !members.some(m => m.email === sm.email))]
    : members;

  // Combine real and simulated chats
  const allChats = simulationActive 
    ? [...chatMessages, ...simulatedChats].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    : chatMessages;

  // Combine real and simulated reactions
  const allReactions = simulationActive 
    ? [...reactions, ...simulatedReactions]
    : reactions;

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allChats]);

  // Simulation loop
  useEffect(() => {
    if (!simulationActive) {
      setSimulatedMembersList([]);
      setSimulatedChats([]);
      setSimulatedReactions([]);
      return;
    }

    // Set initial simulated members
    setSimulatedMembersList(SIMULATED_MEMBERS);

    // Interval to generate chat and reactions
    const interval = setInterval(() => {
      // 30% chance of new chat, 70% chance of new reaction, 10% hand raise
      const rand = Math.random();
      
      if (rand < 0.25) {
        // Chat message
        const randomMember = SIMULATED_MEMBERS[Math.floor(Math.random() * SIMULATED_MEMBERS.length)];
        const randomText = SIMULATED_CHAT_TEXTS[Math.floor(Math.random() * SIMULATED_CHAT_TEXTS.length)];
        const newChat: ChatMessage = {
          senderName: randomMember.name,
          senderEmail: randomMember.email,
          senderRole: 'member',
          text: randomText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSimulatedChats(prev => [...prev, newChat]);
      } else if (rand < 0.8) {
        // Emoji reaction
        const randomEmoji = SIMULATED_EMOJIS[Math.floor(Math.random() * SIMULATED_EMOJIS.length)];
        const reactionId = Date.now() + Math.random();
        setSimulatedReactions(prev => [...prev, { id: reactionId, emoji: randomEmoji }]);
        setTimeout(() => {
          setSimulatedReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 4000);
      } else {
        // Hand Raise toggle
        setSimulatedMembersList(prev => {
          const next = [...prev];
          const index = Math.floor(Math.random() * next.length);
          // Only raise if not already streaming or approved
          if (!next[index].isStreaming) {
            next[index].handRaised = !next[index].handRaised;
          }
          return next;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [simulationActive]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handlePostPrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerInput.trim()) return;
    const newRequest = {
      id: Date.now(),
      sender: user.name,
      text: prayerInput.trim()
    };
    setPrayerWall(prev => [newRequest, ...prev]);
    // Also post it to chat
    sendChatMessage(`[Prayer Request] ${prayerInput.trim()}`);
    setPrayerInput('');
  };





  return (
    <div className="dashboard-layout">
      {/* Real-time Giving Toast Notification */}
      {givingToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid var(--primary-gold)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          padding: '16px 24px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'floatUp 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards',
          maxWidth: '380px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(226, 168, 80, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🎉
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              NEW OFFERING RECEIVED
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'white', marginTop: '2px' }}>
              {givingToast.name} contributed <span style={{ color: 'var(--primary-gold)' }}>${givingToast.amount.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Designated for: {givingToast.designation}
            </div>
          </div>
        </div>
      )}

      {/* Floating reactions wrapper */}
      <div className="reactions-container">
        {allReactions.map((reaction) => {
          // Generate a semi-random horizontal offset for the floating animation
          const randomX = `${(reaction.id % 40) - 20}px`;
          return (
            <div 
              key={reaction.id} 
              className="floating-reaction"
              style={{ '--random-x': randomX } as React.CSSProperties}
            >
              {reaction.emoji}
            </div>
          );
        })}
      </div>

      {/* Main Stream Area */}
      <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.6rem' }}>
              Pastor Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Logged in as <strong>{user.name}</strong> ({user.email})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`btn ${simulationActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSimulationActive(!simulationActive)}
              title="Simulates mock congregation members, chats, and hand-raises for demo testing."
            >
              <Sparkles size={16} />
              {simulationActive ? 'Disable Simulation' : 'Simulate Congregation'}
            </button>
            <button className="btn btn-secondary" onClick={onLogout}>
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>

        {/* Video Stage */}
        <div className="video-stage">
          {serviceStatus === 'live' && isCameraOn ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="stream-video"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <img 
                src="/nbbc-logo.jpg" 
                alt="NBBC Logo" 
                className="logo-spin"
                style={{ width: '180px', height: '180px', borderRadius: '50%', border: '2px solid var(--primary-gold)', boxShadow: '0 0 25px rgba(226,168,80,0.25)', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)' }}>
                  Sermon Stream is {serviceStatus === 'live' ? 'Online (Camera Muted)' : 'Offline'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                  {serviceStatus === 'live' ? 'Turn on your camera to broadcast.' : 'Click "Go Live" to start Sunday Service.'}
                </p>
              </div>
            </div>
          )}

          {serviceStatus === 'live' && (
            <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '8px' }}>
              <div className="live-badge">
                <div className="live-dot"></div>
                LIVE BROADCAST
              </div>
              <div className="live-badge" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }}>
                <div className="live-dot" style={{ background: '#ef4444' }}></div>
                REC
              </div>
            </div>
          )}

          {/* Video Overlays / Media Controls */}
          <div className="video-overlay-bottom">
            <div style={{ display: 'flex', gap: '10px' }}>
              {serviceStatus === 'live' ? (
                <>
                  <button 
                    className={`btn ${isCameraOn ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={toggleCamera}
                  >
                    {isCameraOn ? <VideoOff size={18} /> : <Video size={18} />}
                    {isCameraOn ? 'Stop Video' : 'Start Video'}
                  </button>

                  <button 
                    className={`btn ${isMicOn ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={toggleMic}
                  >
                    {isMicOn ? <MicOff size={18} /> : <Mic size={18} />}
                    {isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={handleEndService}
                  >
                    <Radio size={18} />
                    End Service
                  </button>
                </>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={() => toggleService(true)}
                >
                  <Radio size={18} />
                  Go Live (Start Service)
                </button>
              )}
            </div>
            
            <div style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontSize: '0.9rem', fontWeight: 500 }}>
              {allMembers.length} Joined
            </div>
          </div>
        </div>

        {/* Congregation Grid */}
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', marginBottom: '12px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} />
            Congregation Camera Feeds ({allMembers.filter(m => m.role === 'member').length})
          </h3>
          
          {allMembers.filter(m => m.role === 'member').length === 0 ? (
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No congregation members are currently connected.
              {!simulationActive && (
                <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                  Click <strong>"Simulate Congregation"</strong> above to see demo participants!
                </p>
              )}
            </div>
          ) : (
            <div className="participant-grid">
              {allMembers
                .filter(m => m.role === 'member')
                .map((member) => {
                  const hasVideo = member.isStreaming && remoteStreams[member.email];
                  const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <div 
                      key={member.email} 
                      className={`participant-card ${member.isStreaming ? 'streaming' : ''}`}
                    >
                      {hasVideo ? (
                        <video 
                          ref={(el) => {
                            if (el && remoteStreams[member.email]) {
                              el.srcObject = remoteStreams[member.email];
                            }
                          }}
                          autoPlay 
                          playsInline 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="participant-avatar-container">
                          <div className="participant-avatar">{initials}</div>
                          {member.isStreaming && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Connecting camera...
                            </span>
                          )}
                        </div>
                      )}

                      <span className="participant-name">
                        {member.name}
                      </span>

                      <div className="participant-indicators">
                        {member.isMuted && (
                          <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '4px', borderRadius: '50%' }}>
                            <MicOff size={10} color="white" />
                          </div>
                        )}
                        {member.handRaised && (
                          <div style={{ background: 'var(--text-gold)', padding: '4px', borderRadius: '50%' }}>
                            <Hand size={10} color="black" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar (Chat, Attendees, Prayer requests) */}
      <div className="sidebar">
        <div className="sidebar-tabs">
          <button 
            className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>

          <button 
            className={`sidebar-tab ${activeTab === 'prayer' ? 'active' : ''}`}
            onClick={() => setActiveTab('prayer')}
          >
            Prayer
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'giving' ? 'active' : ''}`}
            onClick={() => setActiveTab('giving')}
          >
            Giving
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
          >
            SMS
          </button>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            <div className="chat-messages">
              {allChats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
                  Chat is empty. Send a welcome message to start Sunday Service!
                </div>
              ) : (
                allChats.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`chat-bubble ${msg.senderRole === 'pastor' ? 'pastor' : msg.senderRole === 'system' ? 'system' : ''}`}
                  >
                    {msg.senderRole !== 'system' && (
                      <div className="chat-header">
                        <span className="chat-sender">{msg.senderName}</span>
                        <span className="chat-time">{msg.timestamp}</span>
                      </div>
                    )}
                    <div className="chat-text">{msg.text}</div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendChat} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Send chat to service..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}



        {/* Prayer Wall Tab */}
        {activeTab === 'prayer' && (
          <>
            <div className="prayer-requests">
              {prayerWall.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
                  No prayer requests posted yet.
                </div>
              ) : (
                prayerWall.map((req) => (
                  <div key={req.id} className="prayer-card">
                    <div className="prayer-meta">{req.sender}</div>
                    <div className="prayer-text">{req.text}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostPrayer} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea 
                className="form-input" 
                rows={2}
                placeholder="Post a request or praise report..." 
                value={prayerInput}
                onChange={(e) => setPrayerInput(e.target.value)}
                style={{ resize: 'none' }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Post to Prayer Wall
              </button>
            </form>
          </>
        )}

        {/* Giving Tab */}
        {activeTab === 'giving' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginBottom: '4px' }}>
              Service Giving
            </h4>
            
            {/* Total Display */}
            <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(226, 168, 80, 0.1) 0%, rgba(15, 23, 42, 0.4) 100%)', border: '1px solid rgba(226, 168, 80, 0.25)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                Total Offering Collected
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginTop: '4px', textShadow: '0 0 10px rgba(226,168,80,0.3)' }}>
                ${givingTotal.toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* History List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recent Transactions ({givingTransactions.length})
              </h5>

              {givingTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '0.85rem' }}>
                  No donations received yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                  {givingTransactions.map((t: any) => (
                    <div 
                      key={t.id}
                      className="glass-panel"
                      style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {t.designation} • {t.timestamp}
                        </div>
                      </div>
                      <div style={{ color: 'var(--primary-gold)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                        +${t.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SMS Tab */}
        {activeTab === 'sms' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginBottom: '4px' }}>
              SMS Broadcast Announcement
            </h4>

            {smsSuccess && (
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '6px', color: '#4ade80', padding: '10px', fontSize: '0.8rem' }}>
                🎉 Broadcast sent successfully! Check terminal logs to see mocked dispatch.
              </div>
            )}

            {smsError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#f87171', padding: '10px', fontSize: '0.8rem' }}>
                {smsError}
              </div>
            )}

            {/* Composer */}
            <form onSubmit={handleSendSMS} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>MESSAGE TEXT</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  placeholder="Sunday Service starts in 10 minutes! Join us online..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  style={{ resize: 'none', padding: '10px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span>{smsMessage.length} characters</span>
                  <span>{Math.ceil(smsMessage.length / 160)} segment(s) (160 ch limit)</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={smsSending || !smsMessage.trim()}
                style={{ width: '100%', padding: '10px' }}
              >
                {smsSending ? 'Sending Broadcast...' : 'Send Broadcast SMS'}
              </button>
            </form>

            {/* Member Directory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <h5 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recipient Directory
              </h5>
              
              {members.filter(m => m.role === 'member').length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                  No members are currently in the sanctuary directory.
                </div>
              ) : (
                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '6px' }}>
                  {members.filter(m => m.role === 'member').map(member => (
                    <div 
                      key={member.email} 
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      <span style={{ fontWeight: 600 }}>{member.name}</span>
                      <span style={{ color: 'var(--primary-gold)' }}>Active</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Broadcast History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h5 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Broadcast Logs ({smsHistory.length})
              </h5>

              {loadingSMSHistory ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px', fontSize: '0.8rem' }}>
                  Loading broadcast history...
                </div>
              ) : smsHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                  No announcements broadcasted yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {smsHistory.map((log: any) => (
                    <div key={log.id} className="glass-panel" style={{ padding: '10px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '4px' }}>
                        <span>Sent to {log.recipientCount} recipient(s)</span>
                        <span>{log.date} at {log.timestamp}</span>
                      </div>
                      <div style={{ color: 'white', lineHeight: '1.4' }}>{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Sermon Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '30px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>
              Archive Today's Service
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center' }}>
              Sermon recording completed successfully (Size: {sermonBlob ? (sermonBlob.size / (1024 * 1024)).toFixed(2) : '0.00'} MB). Give this sermon a title so the congregation can find it.
            </p>

            {uploadError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '15px' }}>
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '15px', textAlign: 'center' }}>
                Sermon successfully saved and archived!
              </div>
            )}

            <form onSubmit={handleUploadSermon}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Sermon Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Walking in Faith (Sunday Service)" 
                  value={sermonTitle}
                  onChange={(e) => setSermonTitle(e.target.value)}
                  required
                  disabled={uploading || uploadSuccess}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowUploadModal(false);
                    setSermonBlob(null);
                    setSermonTitle('');
                  }}
                  disabled={uploading || uploadSuccess}
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 2 }}
                  disabled={uploading || uploadSuccess}
                >
                  {uploading ? 'Archiving Video...' : 'Archive Sermon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
