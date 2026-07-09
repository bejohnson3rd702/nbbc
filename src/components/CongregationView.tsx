import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Send, LogOut, 
  Hand, Sparkles, Volume2, BookOpen, Copy, Share2, Users
} from 'lucide-react';
import { BIBLE_BOOKS } from '../data/bibleMetadata';
import { supabase } from '../lib/supabaseClient';
import { API_BASE } from '../lib/apiConfig';

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

const SIMULATED_MEMBERS = [
  { email: 'pastor@nbbc.org', name: 'Pastor Thomas', role: 'pastor' as const, isStreaming: true, isMuted: false, handRaised: false },
  { email: 'beatrice@gmail.com', name: 'Sister Beatrice', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false },
  { email: 'caleb@outlook.com', name: 'Brother Caleb', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false },
  { email: 'mary@nbbc.org', name: 'Sister Mary', role: 'member' as const, isStreaming: false, isMuted: true, handRaised: false }
];

interface ParticipantVideoProps {
  stream: MediaStream;
  muted?: boolean;
  style?: React.CSSProperties;
}

function ParticipantVideo({ stream, muted, style }: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video 
      ref={videoRef}
      autoPlay 
      playsInline 
      muted={muted}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  );
}

interface CongregationViewProps {
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
    handRaised: boolean;
    isMutedByPastor: boolean;
    givingTotal: number;
    givingTransactions: any[];
    givingToast: any | null;
    sendChatMessage: (text: string) => void;
    sendReaction: (emoji: string) => void;
    toggleHandRaise: () => void;
    toggleCamera: () => void;
    toggleMic: () => void;
    sendGivingUpdate: (total: number, recentTransaction: any) => void;
    prayers: any[];
    activeSpotlight: { text: string; reference?: string } | null;
    postPrayer: (text: string) => void;
    reactToPrayer: (id: any) => void;
    sendPushAnnouncement: (title: string, text: string) => void;
    spotlightScripture: (text: string, reference?: string) => void;
  };
}

const EMOJI_REACTIONS = [
  { emoji: '🙏', label: 'Amen' },
  { emoji: '🙌', label: 'Hallelujah' },
  { emoji: '❤️🙏', label: 'Love & Blessings' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '✨', label: 'Praying' }
];

const SIMULATED_PASTOR_MESSAGES = [
  "Amen! Let's turn our Bibles to Romans 12...",
  "God bless you all for joining us today.",
  "Remember that our midweek prayer group is this Wednesday at 7 PM.",
  "Let us bow our heads in prayer...",
  "Thank you for sharing your testimonies today."
];

const SIMULATED_CONGREGATION_CHATS = [
  "Amen! Praise the Lord.",
  "Hello from the Harrison home!",
  "What a powerful message today, Pastor.",
  "Let us pray for our community.",
  "Glory to God!",
  "Amen!",
  "Praise Him!"
];

export default function CongregationView({ user, onLogout, webrtc }: CongregationViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'prayer' | 'archive' | 'bible' | 'giving' | 'members'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [prayerInput, setPrayerInput] = useState('');
  const [demoServiceActive] = useState(false);

  // PWA Install State
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setInstallPromptEvent(null);
  };
  const [simulatedChats, setSimulatedChats] = useState<ChatMessage[]>([]);
  const [simulatedReactions, setSimulatedReactions] = useState<{ id: number; emoji: string }[]>([]);

  // Giving Form States
  const [givingAmount, setGivingAmount] = useState('');
  const [givingDesignation, setGivingDesignation] = useState('Tithe');
  const [givingCardName, setGivingCardName] = useState('');
  const [givingCardNumber, setGivingCardNumber] = useState('');
  const [givingCardExpiry, setGivingCardExpiry] = useState('');
  const [givingCardCvv, setGivingCardCvv] = useState('');
  const [givingLoading, setGivingLoading] = useState(false);
  const [givingError, setGivingError] = useState('');
  const [givingSubmitted, setGivingSubmitted] = useState(false);

  const handleGiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!givingAmount.trim()) return;

    setGivingLoading(true);
    setGivingError('');

    try {
      const floatAmount = parseFloat(givingAmount.trim());
      if (isNaN(floatAmount) || floatAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const url = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const isSupabaseConfigured = !!(url && anonKey && 
                                   !url.includes('placeholder-project') && 
                                   !anonKey.includes('placeholder-anon-key'));

      if (isSupabaseConfigured) {
        const transaction = {
          name: user.name,
          email: user.email || 'anonymous@nbbc.org',
          amount: floatAmount,
          designation: givingDesignation,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString()
        };

        const { data: insertedList, error: insertError } = await supabase
          .from('giving')
          .insert(transaction)
          .select();

        if (insertError) throw insertError;
        const insertedTransaction = insertedList?.[0] || transaction;

        // Fetch new total for real-time WebSocket broadcast
        const { data: allGiving, error: sumError } = await supabase
          .from('giving')
          .select('amount');

        if (!sumError && allGiving) {
          const newTotal = allGiving.reduce((sum, item) => sum + Number(item.amount), 0);
          sendGivingUpdate(newTotal, insertedTransaction);
        }

        setGivingSubmitted(true);
      } else {
        const response = await fetch(`${API_BASE}/api/give`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            amount: givingAmount.trim(),
            designation: givingDesignation
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit offering');
        }

        setGivingSubmitted(true);
      }
    } catch (err: any) {
      setGivingError(err.message || 'Connection to the giving portal failed.');
    } finally {
      setGivingLoading(false);
    }
  };

  // Archive States
  const [archiveSermons, setArchiveSermons] = useState<{ id: number; title: string; date: string; videoUrl: string; aiNotes?: string }[]>([]);
  const [selectedSermon, setSelectedSermon] = useState<{ id: number; title: string; date: string; videoUrl: string; aiNotes?: string } | null>(null);
  const [loadingArchive, setLoadingArchive] = useState(false);

  // Bible States
  const [bibleBook, setBibleBook] = useState('John');
  const [bibleChapter, setBibleChapter] = useState(3);
  const [bibleVerses, setBibleVerses] = useState<{ verse: number; text: string; book_name?: string; chapter?: number }[]>([]);
  const [bibleSearchQuery, setBibleSearchQuery] = useState('');
  const [loadingBible, setLoadingBible] = useState(false);
  const [bibleError, setBibleError] = useState('');

  const fetchSermons = async () => {
    setLoadingArchive(true);
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('sermons')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        
        const formattedSermons = (data || []).map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          videoUrl: s.video_url,
          aiNotes: s.ai_notes
        }));
        setArchiveSermons(formattedSermons);
      } catch (e) {
        console.error('Error fetching sermons from Supabase:', e);
      } finally {
        setLoadingArchive(false);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE}/api/sermons`);
        if (response.ok) {
          const data = await response.json();
          setArchiveSermons(data);
        }
      } catch (e) {
        console.error('Error fetching sermons locally:', e);
      } finally {
        setLoadingArchive(false);
      }
    }
  };

  const fetchBible = async (reference: string) => {
    setLoadingBible(true);
    setBibleError('');
    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
      if (!response.ok) {
        throw new Error('Scripture reference not found.');
      }
      const data = await response.json();
      setBibleVerses(data.verses || []);
    } catch (err: any) {
      setBibleError(err.message || 'Failed to load scripture.');
      setBibleVerses([]);
    } finally {
      setLoadingBible(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchSermons();
    } else if (activeTab === 'bible' && bibleVerses.length === 0) {
      fetchBible(`${bibleBook} ${bibleChapter}`);
    }
  }, [activeTab]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const {
    members,
    chatMessages,
    reactions,
    serviceStatus,
    localStream,
    remoteStreams,
    isCameraOn,
    isMicOn,
    handRaised,
    sendChatMessage,
    sendReaction,
    toggleHandRaise,
    toggleCamera,
    toggleMic,
    sendGivingUpdate,
    prayers,
    activeSpotlight,
    postPrayer,
    reactToPrayer
  } = webrtc;

  // Find Pastor's stream in remoteStreams
  const pastorObj = members.find(m => m.role === 'pastor');
  const pastorStream = pastorObj ? remoteStreams[pastorObj.email] : null;



  // Set Local camera preview
  useEffect(() => {
    if (localVideoRef.current && localStream && isCameraOn) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOn]);

  // Combine real and simulated state
  const isLive = serviceStatus === 'live' || demoServiceActive;

  // YouTube Lobby Background Music Player
  const ytPlayerRef = useRef<any>(null);

  useEffect(() => {
    // If the service is live, pause and do not play background music!
    if (isLive) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {
          console.warn('Error pausing YouTube player:', e);
        }
      }
      return;
    }

    // Load the YouTube IFrame Player API script if not loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let player: any;
    const initPlayer = () => {
      if (!document.getElementById('youtube-lobby-player')) return;

      player = new (window as any).YT.Player('youtube-lobby-player', {
        height: '100%',
        width: '100%',
        videoId: 'YQjPuIrR0Dk', // Kirk Franklin - Imagine Me (User Requested)
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: 'YQjPuIrR0Dk', // Required for loop to work
          controls: 1, // Let them control if they want
          rel: 0
        },
        events: {
          onReady: (event: any) => {
            ytPlayerRef.current = event.target;
            event.target.setVolume(10); // 10% volume!
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.UNSTARTED) {
              event.target.setVolume(10);
              event.target.playVideo();
            }
          }
        }
      });
    };

    // Safe polling check to guarantee player initializes even after hot reloads or route changes
    const checkInterval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
        clearInterval(checkInterval);
      }
    }, 100);

    return () => {
      clearInterval(checkInterval);
      if (player) {
        try {
          player.destroy();
        } catch (e) {
          console.warn('Error destroying YouTube player:', e);
        }
      }
    };
  }, [isLive]);

  // User interaction listener to resume background music if blocked by browser autoplay rules
  useEffect(() => {
    const handleUserInteraction = () => {
      if (ytPlayerRef.current && !isLive) {
        try {
          if (ytPlayerRef.current.getPlayerState() !== 1) { // 1 = playing
            ytPlayerRef.current.playVideo();
          }
        } catch (e) {}
      }
    };
    
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [isLive]);

  const allMembers = demoServiceActive
    ? [...members, ...SIMULATED_MEMBERS.filter(sm => !members.some(m => m.email === sm.email))]
    : members;

  const allChats = demoServiceActive
    ? [...chatMessages, ...simulatedChats].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    : chatMessages;

  const allReactions = demoServiceActive
    ? [...reactions, ...simulatedReactions]
    : reactions;

  // Filter prayers into Weekly Focus and Archive
  const nowTime = Date.now();
  const sevenDaysAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
  const weeklyPrayers = prayers.filter(p => !p.created_at || new Date(p.created_at).getTime() > sevenDaysAgo);
  const archivedPrayers = prayers.filter(p => p.created_at && new Date(p.created_at).getTime() <= sevenDaysAgo);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allChats]);

  // Demo service simulator loop
  useEffect(() => {
    if (!demoServiceActive) {
      setSimulatedChats([]);
      setSimulatedReactions([]);
      return;
    }

    const interval = setInterval(() => {
      const rand = Math.random();

      if (rand < 0.25) {
        // Chat from Pastor or congregation member
        const fromPastor = Math.random() < 0.3;
        const senderName = fromPastor ? (pastorObj?.name || 'Pastor John') : 'Member';
        const senderRole = fromPastor ? 'pastor' : 'member';
        const textArray = fromPastor ? SIMULATED_PASTOR_MESSAGES : SIMULATED_CONGREGATION_CHATS;
        const text = textArray[Math.floor(Math.random() * textArray.length)];

        const newChat: ChatMessage = {
          senderName,
          senderEmail: fromPastor ? 'pastor@nbbc.org' : 'member@nbbc.org',
          senderRole,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSimulatedChats(prev => [...prev, newChat]);
      } else if (rand < 0.85) {
        // Emoji reaction
        const emojis = ['🙏', '👏', '❤️', '🙌', '✨'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const reactionId = Date.now() + Math.random();
        setSimulatedReactions(prev => [...prev, { id: reactionId, emoji: randomEmoji }]);
        setTimeout(() => {
          setSimulatedReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 4000);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [demoServiceActive, pastorObj]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handlePostPrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerInput.trim()) return;
    postPrayer(prayerInput.trim());
    // Also post it to chat
    sendChatMessage(`[Prayer Request] ${prayerInput.trim()}`);
    setPrayerInput('');
  };

  const handleReactionClick = (emoji: string) => {
    sendReaction(emoji);
    if (demoServiceActive) {
      // Local immediate reaction for high-fidelity response in demo mode
      const reactionId = Date.now() + Math.random();
      setSimulatedReactions(prev => [...prev, { id: reactionId, emoji }]);
      setTimeout(() => {
        setSimulatedReactions(prev => prev.filter(r => r.id !== reactionId));
      }, 4000);
    }
  };

  const hasPastorStream = pastorStream !== null;

  return (
    <div className="dashboard-layout">
      {/* Hidden audio loop for other members in full mesh connection */}
      {Object.keys(remoteStreams)
        .filter(email => email !== pastorObj?.email)
        .map(email => (
          <audio 
            key={email}
            ref={(el) => {
              if (el && remoteStreams[email]) {
                el.srcObject = remoteStreams[email];
              }
            }}
            autoPlay
          />
        ))}



      {/* Floating reactions wrapper */}
      <div className="reactions-container">
        {allReactions.map((reaction) => {
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

      {/* Main Sanctuary Feed Area */}
      <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.6rem' }}>
              Virtual Sanctuary
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Welcome back, <strong>{user.name}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>

            {installPromptEvent && (
              <button 
                className="btn btn-primary" 
                onClick={handleInstallClick}
                style={{ borderColor: 'var(--primary-gold)', color: 'var(--primary-gold)', background: 'rgba(226,168,80,0.1)' }}
              >
                Install App
              </button>
            )}
            <button className="btn btn-secondary" onClick={onLogout}>
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>

        {/* Pastor's Broadcast Screen (Theater View) */}
        <div className="video-stage">
          {isLive ? (
            hasPastorStream && serviceStatus === 'live' ? (
              <ParticipantVideo 
                stream={pastorStream} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              // Simulated Pulpit fallback visual
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1b2640 0%, #080c16 100%)', position: 'relative' }}>
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(226, 168, 80, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--primary-gold)', animation: 'spin 120s linear infinite', position: 'absolute' }}></div>
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '20px' }}>
                  <Volume2 size={48} className="text-gold" style={{ marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(226,168,80,0.5))' }} />
                  <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.4rem' }}>
                    Pastor's Sermon Broadcast
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', maxWidth: '380px' }}>
                    {demoServiceActive 
                      ? 'Simulated Sanctuary Stream. Audio-video broadcasting from pulpit.' 
                      : 'Connecting to Pastor\'s camera stream. Please wait...'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px', background: 'radial-gradient(circle at center, #1b2640 0%, #080c16 100%)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.4rem' }}>
                    ⛪ Sanctuary Fellowship Lobby
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Welcome! Chat, turn on your camera, and connect with other members before Sunday Service begins.
                  </p>
                </div>
                <div style={{ background: 'rgba(226,168,80,0.1)', color: 'var(--primary-gold)', border: '1px solid var(--primary-gold)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                  Sanctuary Lobby Active
                </div>
              </div>

              {/* Lobby Music Video Player */}
              <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '16/9', margin: '0 auto 10px auto', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--primary-gold)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                <div id="youtube-lobby-player" style={{ width: '100%', height: '100%' }}></div>
              </div>

              {/* Lobby Video Feeds Grid */}
              <div className="participant-grid" style={{ flex: 1, minHeight: '200px' }}>
                {/* Local Member Card */}
                <div className={`participant-card ${isCameraOn ? 'streaming' : ''}`}>
                  {isCameraOn && localStream ? (
                    <ParticipantVideo stream={localStream} muted={true} style={{ transform: 'scaleX(-1)' }} />
                  ) : (
                    <div className="participant-avatar-container">
                      <div className="participant-avatar">
                        {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <span className="participant-name">{user.name} (You)</span>
                  <div className="participant-indicators">
                    {!isMicOn && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '4px', borderRadius: '50%' }}>
                        <MicOff size={10} color="white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Other Online Members */}
                {allMembers
                  .filter(m => m.email !== user.email && m.role === 'member')
                  .map((member) => {
                    const hasVideo = member.isStreaming && remoteStreams[member.email];
                    const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div 
                        key={member.email} 
                        className={`participant-card ${member.isStreaming ? 'streaming' : ''}`}
                      >
                        {hasVideo ? (
                          <ParticipantVideo stream={remoteStreams[member.email]} muted={true} />
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
                        <span className="participant-name">{member.name}</span>
                        <div className="participant-indicators">
                          {member.isMuted && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '4px', borderRadius: '50%' }}>
                              <MicOff size={10} color="white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {isLive && (
            <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 20, alignItems: 'center' }}>
              <div className="live-badge" style={{ position: 'static' }}>
                <div className="live-dot"></div>
                SUNDAY SERVICE LIVE
              </div>
              {(() => {
                const today = new Date();
                const isFirstSunday = today.getDay() === 0 && today.getDate() <= 7;
                return isFirstSunday ? (
                  <div className="first-sunday-badge" style={{ position: 'static' }}>
                    <BookOpen size={16} className="first-sunday-icon" />
                    <span>First Sunday</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Congregation Local Camera Float (Picture-in-Picture) */}
          {isCameraOn && isLive && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              bottom: '20px', 
              right: '20px', 
              width: '140px', 
              aspectRatio: '16/10',
              overflow: 'hidden', 
              borderRadius: '8px',
              border: '2px solid var(--primary-gold)'
            }}>
              {localStream && (
                <ParticipantVideo stream={localStream} muted={true} style={{ transform: 'scaleX(-1)' }} />
              )}
            </div>
          )}

          {/* Scripture Spotlight Overlay */}
          {activeSpotlight && (
            <div className="scripture-spotlight-overlay">
              <div className="spotlight-content">
                <p className="spotlight-text">"{activeSpotlight.text}"</p>
                {activeSpotlight.reference && (
                  <p className="spotlight-reference">— {activeSpotlight.reference}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interaction Panel (Media Controls & Emojis combined in a grid) */}
        {isLive && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', marginTop: '10px' }} className="mobile-stack">
            {/* Participation Controls */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontSize: '1rem', letterSpacing: '0.5px' }}>
                  Participation Controls
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', lineHeight: '1.4' }}>
                  Click \"Raise Hand\" to ask to speak, or toggle your webcam and microphone below.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button 
                  className={`btn ${handRaised ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={toggleHandRaise}
                  style={{ flex: 1, minWidth: '100px', padding: '10px' }}
                >
                  <Hand size={18} />
                  {handRaised ? 'Lower Hand' : 'Raise Hand'}
                </button>
                <button 
                  className={`btn ${isCameraOn ? 'btn-secondary' : 'btn-primary'}`} 
                  onClick={toggleCamera}
                  style={{ flex: 1, minWidth: '100px', padding: '10px' }}
                >
                  {isCameraOn ? <VideoOff size={18} /> : <Video size={18} />}
                  {isCameraOn ? 'Cam Off' : 'Cam On'}
                </button>
                <button 
                  className={`btn ${isMicOn ? 'btn-secondary' : 'btn-primary'}`} 
                  onClick={toggleMic}
                  style={{ flex: 1, minWidth: '100px', padding: '10px' }}
                >
                  {isMicOn ? <MicOff size={18} /> : <Mic size={18} />}
                  {isMicOn ? 'Mute' : 'Unmute'}
                </button>
              </div>
            </div>

            {/* Worship Reactions */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontSize: '1rem', letterSpacing: '0.5px' }}>
                Worship Reactions (Send to Stream)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                {EMOJI_REACTIONS.map((react) => (
                  <button 
                    key={react.label}
                    className="btn btn-secondary" 
                    onClick={() => handleReactionClick(react.emoji)}
                    style={{ fontSize: '1.1rem', padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                  >
                    <span>{react.emoji}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{react.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Congregation Camera Feeds Horizontal Filmstrip */}
        {isLive && (
          <div className="glass-panel" style={{ padding: '20px', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Users size={18} />
              Congregation Camera Feeds ({allMembers.filter(m => m.role === 'member').length})
            </h3>
            
            {allMembers.filter(m => m.role === 'member').length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', textAlign: 'center' }}>
                No congregation members have joined the sanctuary yet.
              </div>
            ) : (
              <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
                {allMembers
                  .filter(m => m.role === 'member')
                  .map((member) => {
                    const hasVideo = member.isStreaming && remoteStreams[member.email];
                    const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div 
                        key={member.email} 
                        className={`participant-card ${member.isStreaming ? 'streaming' : ''}`}
                        style={{ flex: '0 0 150px', aspectRatio: '4/3', margin: 0 }}
                      >
                        {hasVideo ? (
                          <ParticipantVideo stream={remoteStreams[member.email]} muted={true} />
                        ) : (
                          <div className="participant-avatar-container">
                            <div className="participant-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>{initials}</div>
                            {member.isStreaming && (
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                Connecting...
                              </span>
                            )}
                          </div>
                        )}
                        <span className="participant-name" style={{ fontSize: '0.75rem', padding: '3px 6px' }}>{member.name}</span>
                        <div className="participant-indicators">
                          {member.isMuted && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '3px', borderRadius: '50%' }}>
                              <MicOff size={8} color="white" />
                            </div>
                          )}
                          {member.handRaised && (
                            <div style={{ background: 'var(--text-gold)', padding: '3px', borderRadius: '50%' }}>
                              <Hand size={8} color="black" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar (Chat & Prayer board) */}
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
            className={`sidebar-tab ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Archive
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'bible' ? 'active' : ''}`}
            onClick={() => setActiveTab('bible')}
          >
            Bible
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'giving' ? 'active' : ''}`}
            onClick={() => setActiveTab('giving')}
          >
            Giving
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            <div className="chat-messages">
              {allChats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
                  Chat is empty. Join the fellowship!
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
                placeholder={isLive ? "Type a message..." : "Waiting for service to start..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!isLive}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }} disabled={!isLive}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}

        {/* Prayer Wall Tab */}
        {activeTab === 'prayer' && (
          <>
            <div className="prayer-requests" style={{ flex: 1, overflowY: 'auto' }}>
              {weeklyPrayers.length > 0 && (
                <div>
                  <h5 style={{ color: 'var(--primary-gold)', fontSize: '0.85rem', margin: '0 0 10px 0', borderBottom: '1px solid rgba(226,168,80,0.2)', paddingBottom: '4px' }}>
                    Weekly Focus (Recent)
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {weeklyPrayers.map((req) => (
                      <div key={req.id} className="prayer-card">
                        <div className="prayer-meta">{req.sender}</div>
                        <div className="prayer-text">{req.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Just now'}
                          </span>
                          <button 
                            onClick={() => reactToPrayer(req.id)}
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>🙏 Praying for you</span>
                            {req.praying_count > 0 && (
                              <span style={{ color: 'var(--primary-gold)', fontWeight: 'bold' }}>({req.praying_count})</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {archivedPrayers.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h5 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    Prayer Archive
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {archivedPrayers.map((req) => (
                      <div key={req.id} className="prayer-card" style={{ opacity: 0.75 }}>
                        <div className="prayer-meta">{req.sender}</div>
                        <div className="prayer-text">{req.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
                          </span>
                          <button 
                            onClick={() => reactToPrayer(req.id)}
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>🙏 Praying for you</span>
                            {req.praying_count > 0 && (
                              <span style={{ color: 'var(--primary-gold)', fontWeight: 'bold' }}>({req.praying_count})</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {weeklyPrayers.length === 0 && archivedPrayers.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
                  No prayer requests posted yet.
                </div>
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

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginBottom: '4px' }}>
              Sermon Archive
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>
              Watch recorded Sunday services at your convenience.
            </p>

            {loadingArchive ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Loading recorded sermons...
              </div>
            ) : archiveSermons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No recorded services in archive yet.
              </div>
            ) : (
              archiveSermons.map((sermon) => (
                <div 
                  key={sermon.id} 
                  className="glass-panel" 
                  style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-gold)' }}>
                      {sermon.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Service Date: {sermon.date}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 2, padding: '6px 10px', fontSize: '0.75rem' }}
                      onClick={() => setSelectedSermon(sermon)}
                    >
                      Watch Service
                    </button>
                    <a 
                      href={sermon.videoUrl.startsWith('http') ? sermon.videoUrl : `${API_BASE}${sermon.videoUrl}`}
                      download={sermon.title}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', textAlign: 'center', textDecoration: 'none' }}
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Save
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bible Tab */}
        {activeTab === 'bible' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} />
              Virtual Bible
            </h4>

            {/* Browse Selectors */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={bibleBook} 
                onChange={(e) => {
                  const newBook = e.target.value;
                  setBibleBook(newBook);
                  setBibleChapter(1);
                  setBibleSearchQuery('');
                  fetchBible(`${newBook} 1`);
                }}
                className="form-input"
                style={{ flex: 2, padding: '8px 12px' }}
              >
                {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>

              <select 
                value={bibleChapter} 
                onChange={(e) => {
                  const newCh = parseInt(e.target.value);
                  setBibleChapter(newCh);
                  setBibleSearchQuery('');
                  fetchBible(`${bibleBook} ${newCh}`);
                }}
                className="form-input"
                style={{ flex: 1, padding: '8px 12px' }}
              >
                {Array.from({ length: BIBLE_BOOKS.find(b => b.name === bibleBook)?.chapters || 1 }, (_, i) => i + 1).map(c => (
                  <option key={c} value={c}>Ch {c}</option>
                ))}
              </select>
            </div>

            {/* Quick Search */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!bibleSearchQuery.trim()) return;
              fetchBible(bibleSearchQuery.trim());
            }} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. John 3:16 or Romans 12" 
                value={bibleSearchQuery}
                onChange={(e) => setBibleSearchQuery(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                Search
              </button>
            </form>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
              {loadingBible ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px' }}>
                  Opening scripture...
                </div>
              ) : bibleError ? (
                <div style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
                  {bibleError}
                </div>
              ) : bibleVerses.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px' }}>
                  Select a chapter or search above to begin reading.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Georgia, serif', lineHeight: '1.7', fontSize: '0.95rem', color: '#f1f5f9' }}>
                  {bibleVerses.map((verse) => (
                    <div key={verse.verse} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--primary-gold)', fontWeight: 'bold', marginRight: '8px', fontFamily: 'var(--font-sans)', fontSize: '0.8rem' }}>
                          {verse.verse}
                        </span>
                        {verse.text.trim()}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}>
                        <button 
                          type="button" 
                          title="Copy verse to clipboard"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                          onClick={() => {
                            const ref = `${verse.book_name || bibleBook} ${(verse.chapter || bibleChapter)}:${verse.verse}`;
                            navigator.clipboard.writeText(`${ref} - "${verse.text.trim()}"`);
                          }}
                        >
                          <Copy size={10} /> Copy
                        </button>
                        <button 
                          type="button" 
                          title="Share verse to live chat"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                          onClick={() => {
                            const ref = `${verse.book_name || bibleBook} ${(verse.chapter || bibleChapter)}:${verse.verse}`;
                            sendChatMessage(`[Scripture] ${ref} - "${verse.text.trim()}"`);
                          }}
                        >
                          <Share2 size={10} /> Share
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Giving Tab */}
        {activeTab === 'giving' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💸</span>
              Tithes & Offering
            </h4>

            {givingSubmitted ? (
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '24px 16px', 
                  textAlign: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '14px',
                  background: 'linear-gradient(135deg, rgba(226, 168, 80, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
                  border: '1px solid var(--primary-gold)'
                }}
              >
                <div style={{ fontSize: '3rem' }}>🙌</div>
                <div>
                  <h5 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '6px' }}>
                    Gift Received!
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Thank you, <strong>{user.name}</strong>, for your faithful contribution of <strong>${parseFloat(givingAmount).toFixed(2)}</strong>.
                  </p>
                </div>
                
                <div style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--primary-gold)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', width: '100%', fontFamily: 'Georgia, serif' }}>
                  "Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver." <br/>— 2 Corinthians 9:7
                </div>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setGivingSubmitted(false);
                    setGivingAmount('');
                    setGivingCardNumber('');
                    setGivingCardExpiry('');
                    setGivingCardCvv('');
                  }}
                  style={{ width: '100%', marginTop: '6px' }}
                >
                  Submit Another Gift
                </button>
              </div>
            ) : (
              <form onSubmit={handleGiveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                  "Honor the Lord with your wealth and with the firstfruits of all your produce." — Proverbs 3:9
                </p>

                {givingError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#f87171', padding: '10px', fontSize: '0.8rem' }}>
                    {givingError}
                  </div>
                )}

                {/* Designation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>GIVING DESIGNATION</label>
                  <select 
                    value={givingDesignation}
                    onChange={(e) => setGivingDesignation(e.target.value)}
                    className="form-input"
                  >
                    <option value="Tithe">Tithe</option>
                    <option value="General Offering">General Offering</option>
                    <option value="Missions Fund">Missions Fund</option>
                    <option value="Building Fund">Building Fund</option>
                  </select>
                </div>

                {/* Amount */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>AMOUNT ($)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                    <input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={givingAmount}
                      onChange={(e) => setGivingAmount(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '24px' }}
                    />
                  </div>
                </div>

                {/* Cardholder Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CARDHOLDER NAME</label>
                  <input 
                    type="text"
                    required
                    placeholder="Name on card"
                    value={givingCardName || (givingCardName === '' ? user.name : givingCardName)}
                    onChange={(e) => setGivingCardName(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Card Number */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CARD NUMBER</label>
                  <input 
                    type="text"
                    required
                    maxLength={19}
                    placeholder="4111 2222 3333 4444"
                    value={givingCardNumber}
                    onChange={(e) => setGivingCardNumber(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Expiry & CVV */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>EXP DATE</label>
                    <input 
                      type="text"
                      required
                      maxLength={5}
                      placeholder="MM/YY"
                      value={givingCardExpiry}
                      onChange={(e) => setGivingCardExpiry(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CVV</label>
                    <input 
                      type="text"
                      required
                      maxLength={3}
                      placeholder="123"
                      value={givingCardCvv}
                      onChange={(e) => setGivingCardCvv(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={givingLoading}
                  style={{ width: '100%', marginTop: '6px', padding: '12px' }}
                >
                  {givingLoading ? 'Processing Offering...' : `Process Gift of $${givingAmount ? parseFloat(givingAmount).toFixed(2) : '0.00'}`}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Members (Online) Tab */}
        {activeTab === 'members' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} />
              Online Congregation ({allMembers.length})
            </h4>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0' }}>
              These are the active believers and visitors gathered in the sanctuary.
            </p>

            {allMembers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.85rem' }}>
                No other members are online.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allMembers.map((m) => {
                  const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  const isSelf = m.email === user?.email;
                  return (
                    <div 
                      key={m.email} 
                      className="glass-panel" 
                      style={{ 
                        padding: '10px 12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        borderLeft: isSelf ? '3px solid var(--primary-gold)' : '1px solid rgba(255,255,255,0.05)',
                        background: isSelf ? 'rgba(226,168,80,0.03)' : 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: m.role === 'pastor' ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'rgba(255,255,255,0.05)', 
                          border: m.role === 'pastor' ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: m.role === 'pastor' ? '#0b0f19' : 'white'
                        }}>
                          {initials}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {m.name} {isSelf && <span style={{ color: 'var(--primary-gold)', fontSize: '0.7rem', fontWeight: 'normal' }}>(You)</span>}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {m.role === 'pastor' ? '👑 Pastor at the Pulpit' : '🪑 Congregation Member'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {m.isStreaming && (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            background: 'rgba(34, 197, 94, 0.15)', 
                            color: '#4ade80', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(34, 197, 94, 0.25)'
                          }}>
                            🎥 Camera On
                          </span>
                        )}
                        {!m.isMuted && (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            background: 'rgba(234, 179, 8, 0.15)', 
                            color: '#facc15', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(234, 179, 8, 0.25)'
                          }}>
                            🎤 Mic On
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedSermon && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: selectedSermon.aiNotes ? '1100px' : '800px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', transition: 'max-width 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.4rem' }}>
                  {selectedSermon.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Recorded on {selectedSermon.date}
                </span>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedSermon(null)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Close Player
              </button>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: selectedSermon.aiNotes ? 'row' : 'column', 
              gap: '20px',
              alignItems: 'stretch',
              flexWrap: 'wrap'
            }}>
              <div style={{ 
                position: 'relative', 
                flex: 2,
                minWidth: '320px',
                aspectRatio: '16/9', 
                background: '#000', 
                borderRadius: '8px', 
                overflow: 'hidden' 
              }}>
                <video 
                  src={selectedSermon.videoUrl.startsWith('http') ? selectedSermon.videoUrl : `${API_BASE}${selectedSermon.videoUrl}`} 
                  controls 
                  autoPlay 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {selectedSermon.aiNotes && (
                <div style={{ 
                  flex: 1.2, 
                  minWidth: '280px',
                  maxHeight: '450px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', borderBottom: '1px solid rgba(226,168,80,0.2)', paddingBottom: '6px' }}>
                    <Sparkles size={16} color="var(--primary-gold)" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary-gold)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Sermon Study Guide
                    </span>
                  </div>
                  <div 
                    className="markdown-body" 
                    style={{ 
                      fontSize: '0.85rem', 
                      lineHeight: '1.6', 
                      color: '#f1f5f9',
                      fontFamily: 'var(--font-serif)'
                    }}
                  >
                    {selectedSermon.aiNotes.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) {
                        return <h3 key={idx} style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginTop: '12px', marginBottom: '8px' }}>{line.replace('# ', '')}</h3>;
                      }
                      if (line.startsWith('## ')) {
                        return <h4 key={idx} style={{ color: 'var(--text-gold)', fontFamily: 'var(--font-serif)', fontSize: '1rem', marginTop: '14px', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{line.replace('## ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <li key={idx} style={{ marginLeft: '12px', marginBottom: '4px' }}>{line.replace('- ', '')}</li>;
                      }
                      if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
                        return <p key={idx} style={{ margin: '4px 0 4px 12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>{line}</p>;
                      }
                      return <p key={idx} style={{ margin: '6px 0' }}>{line}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
