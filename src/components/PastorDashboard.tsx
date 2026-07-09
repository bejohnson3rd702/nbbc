import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Send, Users, 
  LogOut, Radio, Hand, BookOpen
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { API_BASE } from '../lib/apiConfig';
import { BIBLE_BOOKS } from '../data/bibleMetadata';
import ProfileModal from './ProfileModal';

interface MemberStatus {
  email: string;
  name: string;
  role: 'pastor' | 'member';
  isStreaming: boolean;
  isMuted: boolean;
  handRaised: boolean;
  bio?: string;
  avatar_url?: string;
}

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

interface ChatMessage {
  senderName: string;
  senderEmail: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface PastorDashboardProps {
  user: { name: string; email: string; role: 'pastor' | 'member'; bio?: string; avatar_url?: string; };
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
    prayers: any[];
    activeSpotlight: { text: string; reference?: string } | null;
    postPrayer: (text: string) => void;
    reactToPrayer: (id: any) => void;
    sendPushAnnouncement: (title: string, text: string) => void;
    spotlightScripture: (text: string, reference?: string) => void;
    sermonTimeline: { timestamp: string; type: 'scripture' | 'point'; text: string }[];
    approveHandRaise: (memberEmail: string) => void;
    muteMember: (memberEmail: string) => void;
    revokeMemberMedia: (memberEmail: string) => void;
    updateProfile: (name: string, bio: string, avatarUrl: string) => void;
    updateRole: (email: string, role: string) => void;
  };
}

// Simulated data generator for high-fidelity testing
const SIMULATED_MEMBERS: MemberStatus[] = [
  { email: 'beatrice@gmail.com', name: 'Sister Beatrice', role: 'member', isStreaming: false, isMuted: true, handRaised: false },
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
  const [activeTab, setActiveTab] = useState<'chat' | 'prayer' | 'giving' | 'sms' | 'spotlight' | 'admin'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [prayerInput, setPrayerInput] = useState('');
  const [simulationActive] = useState(false);

  // Scripture Spotlight local UI states
  const [spotlightBook, setSpotlightBook] = useState('John');
  const [spotlightChapter, setSpotlightChapter] = useState(3);
  const [spotlightVerses, setSpotlightVerses] = useState<any[]>([]);
  const [customSpotlightText, setCustomSpotlightText] = useState('');
  const [customSpotlightRef, setCustomSpotlightRef] = useState('');
  const [loadingBible, setLoadingBible] = useState(false);
  const [bibleError, setBibleError] = useState('');

  const fetchBibleVerses = async (reference: string) => {
    setLoadingBible(true);
    setBibleError('');
    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
      if (!response.ok) {
        throw new Error('Scripture reference not found.');
      }
      const data = await response.json();
      setSpotlightVerses(data.verses || []);
    } catch (err: any) {
      setBibleError(err.message || 'Failed to load scripture.');
      setSpotlightVerses([]);
    } finally {
      setLoadingBible(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'spotlight' && spotlightVerses.length === 0) {
      fetchBibleVerses(`${spotlightBook} ${spotlightChapter}`);
    }
  }, [activeTab]);
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
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('sms_messages')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setSmsHistory(data || []);
      } catch (e) {
        console.error('Error fetching SMS history from Supabase:', e);
      } finally {
        setLoadingSMSHistory(false);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE}/api/sms-history`);
        if (response.ok) {
          const data = await response.json();
          setSmsHistory(data);
        }
      } catch (e) {
        console.error('Error fetching SMS history locally:', e);
      } finally {
        setLoadingSMSHistory(false);
      }
    }
  };

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsMessage.trim()) return;

    setSmsSending(true);
    setSmsError('');
    setSmsSuccess(false);

    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const isSupabaseConfigured = !!(url && anonKey && 
                                   !url.includes('placeholder-project') && 
                                   !anonKey.includes('placeholder-anon-key'));

      if (isSupabaseConfigured) {
        const { data: membersList, error: fetchError } = await supabase
          .from('users')
          .select('name, phone')
          .eq('role', 'member')
          .not('phone', 'is', null);

        if (fetchError) throw fetchError;
        
        const filteredMembers = (membersList || []).filter(m => m.phone && m.phone.trim() !== '');
        const recipientCount = filteredMembers.length;
        const recipientsList = filteredMembers;

        console.log(`\n--- 📱 MOCK SMS BROADCAST GATEWAY (SUPABASE) ---`);
        console.log(`Message: "${smsMessage.trim()}"`);
        console.log(`Sending to ${recipientCount} recipients:`);
        filteredMembers.forEach(member => {
          console.log(`  -> Sent to ${member.name} (${member.phone})`);
        });
        console.log(`------------------------------------\n`);

        const smsRecord = {
          message: smsMessage.trim(),
          recipient_count: recipientCount,
          recipients: recipientsList,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString()
        };

        const { error: insertError } = await supabase.from('sms_messages').insert(smsRecord);
        if (insertError) throw insertError;

        setSmsSuccess(true);
        setSmsMessage('');
        fetchSMSHistory();
        setTimeout(() => setSmsSuccess(false), 5000);
      } else {
        const response = await fetch(`${API_BASE}/api/send-sms`, {
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
      }
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
    givingToast,
    prayers,
    activeSpotlight,
    postPrayer,
    reactToPrayer,
    sendPushAnnouncement,
    spotlightScripture,
    sermonTimeline,
    approveHandRaise,
    muteMember,
    revokeMemberMedia,
    updateProfile,
    updateRole
  } = webrtc;

  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);

  // Fetch all registered users from database
  useEffect(() => {
    const fetchRegisteredUsers = async () => {
      try {
        let { data, error } = await supabase
          .from('users')
          .select('name, email, role, bio, avatar_url');
        
        if (error) {
          console.warn('bio or avatar_url columns missing, trying fallback query...');
          const fallbackResult = await supabase
            .from('users')
            .select('name, email, role');
          if (fallbackResult.error) throw fallbackResult.error;
          data = fallbackResult.data ? fallbackResult.data.map((u: any) => ({ ...u, bio: '', avatar_url: '' })) : null;
        }

        if (data) {
          setRegisteredUsers(data);
        }
      } catch (err) {
        console.error('Error fetching registered users:', err);
      }
    };
    fetchRegisteredUsers();
  }, [members]);

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
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const isSupabaseConfigured = !!(url && anonKey && 
                                   !url.includes('placeholder-project') && 
                                   !anonKey.includes('placeholder-anon-key'));

      if (isSupabaseConfigured) {
        const filename = `sermon_${Date.now()}.webm`;
        let videoUrl = '';
        let isUploadSuccess = false;
        let localUploadError = null;

        // 1. Upload to Supabase Storage with local try-catch
        try {
          const { error: uploadError } = await supabase.storage
            .from('sermons')
            .upload(filename, sermonBlob, {
              contentType: 'video/webm',
              cacheControl: '3600'
            });

          if (uploadError) {
            localUploadError = uploadError;
          } else {
            isUploadSuccess = true;
            // Get Public URL
            const { data: urlData } = supabase.storage
              .from('sermons')
              .getPublicUrl(filename);
            videoUrl = urlData.publicUrl;
          }
        } catch (storageErr: any) {
          localUploadError = storageErr;
        }

        // If storage upload failed (e.g. bucket not found), use a fallback placeholder and proceed
        if (!isUploadSuccess) {
          console.warn('Storage upload failed, using fallback video url:', localUploadError);
          videoUrl = 'https://www.youtube.com/watch?v=YQjPuIrR0Dk'; // Fallback to worship placeholder
          alert(
            "⚠️ Note: The sermon metadata was saved successfully, but the video file could not be uploaded " +
            "because the 'sermons' storage bucket was not found in Supabase.\n\n" +
            "Please log in to your Supabase Dashboard, navigate to 'Storage', and create a new public bucket named exactly 'sermons' so that future videos save correctly."
          );
        }

        // Generate AI Notes from timeline
        let generatedNotes = '';
        try {
          const notesRes = await fetch(`${API_BASE}/api/generate-notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: sermonTitle.trim(), timeline: sermonTimeline })
          });
          if (notesRes.ok) {
            const notesData = await notesRes.json();
            generatedNotes = notesData.notes;
          }
        } catch (notesErr) {
          console.error('Error generating AI notes during upload:', notesErr);
        }

        // 3. Save DB Record (including AI notes)
        const { error: dbError } = await supabase.from('sermons').insert({
          title: sermonTitle.trim(),
          date: new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }),
          video_url: videoUrl,
          ai_notes: generatedNotes
        });

        if (dbError) throw dbError;
      } else {
        const response = await fetch(`${API_BASE}/api/upload-sermon`, {
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

  // Filter prayers into Weekly Focus and Archive
  const nowTime = Date.now();
  const sevenDaysAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
  const weeklyPrayers = prayers.filter(p => !p.created_at || new Date(p.created_at).getTime() > sevenDaysAgo);
  const archivedPrayers = prayers.filter(p => p.created_at && new Date(p.created_at).getTime() <= sevenDaysAgo);

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
    postPrayer(prayerInput.trim());
    // Also post it to chat
    sendChatMessage(`[Prayer Request] ${prayerInput.trim()}`);
    setPrayerInput('');
  };





  return (
    <div className="dashboard-layout">
      {/* Hidden audio loop for remote member streams in full mesh connection */}
      {Object.keys(remoteStreams).map(email => (
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
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              onClick={() => setShowProfileModal(true)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1.5px solid var(--primary-gold)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15, 22, 38, 0.95)',
                boxShadow: '0 0 10px rgba(226,168,80,0.15)'
              }}
              title="Edit Profile"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '0.9rem', color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
                  {user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.6rem', margin: 0 }}>
                Pastor Dashboard
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                Logged in as <strong onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer', color: 'var(--primary-gold)', textDecoration: 'underline' }} title="Edit Profile">{user.name}</strong> ({user.email})
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>

            <button className="btn btn-secondary" onClick={onLogout}>
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>

        {/* Video Stage */}
        <div className={`video-stage ${serviceStatus === 'live' ? 'live' : ''}`}>
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
            <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 20, alignItems: 'center' }}>
              <div className="live-badge" style={{ position: 'static' }}>
                <div className="live-dot"></div>
                LIVE BROADCAST
              </div>
              <div className="live-badge" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171', position: 'static' }}>
                <div className="live-dot" style={{ background: '#ef4444' }}></div>
                REC
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
                        <ParticipantVideo stream={remoteStreams[member.email]} muted={true} />
                      ) : (
                        <div className="participant-avatar-container">
                          {member.avatar_url ? (
                            <img 
                              src={member.avatar_url} 
                              alt={member.name} 
                              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-gold)' }} 
                              title={`${member.name}: ${member.bio || 'No bio'}`}
                            />
                          ) : (
                            <div className="participant-avatar">{initials}</div>
                          )}
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

                      {/* Pastor Moderator Actions */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', width: '100%', justifyContent: 'center' }}>
                        {member.isMuted ? (
                          <button 
                            onClick={() => approveHandRaise(member.email)}
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.65rem', borderRadius: '4px', lineHeight: '1' }}
                          >
                            Unmute
                          </button>
                        ) : (
                          <button 
                            onClick={() => muteMember(member.email)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.65rem', borderRadius: '4px', lineHeight: '1' }}
                          >
                            Mute
                          </button>
                        )}
                        <button 
                          onClick={() => revokeMemberMedia(member.email)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.65rem', borderRadius: '4px', lineHeight: '1', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          Revoke
                        </button>
                      </div>

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
            className={`sidebar-tab ${activeTab === 'spotlight' ? 'active' : ''}`}
            onClick={() => setActiveTab('spotlight')}
          >
            Spotlight
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
          >
            Alerts
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin
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

        {/* Spotlight Tab */}
        {activeTab === 'spotlight' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginBottom: '4px' }}>
              Scripture Spotlight
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Spotlight Bible verses or custom text overlays on everyone's live video stream.
            </p>

            {/* Current Active Spotlight */}
            <div className="glass-panel" style={{ padding: '12px', border: '1px solid rgba(226,168,80,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)', fontWeight: 600 }}>CURRENTLY SPOTLIT:</span>
              {activeSpotlight ? (
                <div style={{ marginTop: '6px' }}>
                  <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>"{activeSpotlight.text}"</p>
                  {activeSpotlight.reference && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-gold)', margin: '4px 0 0 0', textAlign: 'right' }}>— {activeSpotlight.reference}</p>
                  )}
                  <button 
                    onClick={() => spotlightScripture('', '')}
                    className="btn btn-danger" 
                    style={{ width: '100%', marginTop: '10px', padding: '6px' }}
                  >
                    Clear Spotlight
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>Nothing is currently spotlit.</p>
              )}
            </div>

            {/* Custom Spotlight Form */}
            <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOM STREAM OVERLAY</span>
              <textarea 
                className="form-input"
                rows={2}
                placeholder="Type a sermon point or notice (e.g. 'Welcome to NBBC!')"
                value={customSpotlightText}
                onChange={(e) => setCustomSpotlightText(e.target.value)}
                style={{ resize: 'none', fontSize: '0.85rem' }}
              />
              <input 
                type="text" 
                className="form-input"
                placeholder="Optional subtext (e.g. 'Announcement')"
                value={customSpotlightRef}
                onChange={(e) => setCustomSpotlightRef(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              <button 
                onClick={() => {
                  if (customSpotlightText.trim()) {
                    spotlightScripture(customSpotlightText.trim(), customSpotlightRef.trim());
                    setCustomSpotlightText('');
                    setCustomSpotlightRef('');
                  }
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '6px' }}
                disabled={!customSpotlightText.trim()}
              >
                Spotlight Custom Text
              </button>
            </div>

            {/* Bible Verse Spotlight Browser */}
            <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>BROWSE BIBLE TO SPOTLIGHT</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  className="form-input"
                  value={spotlightBook}
                  onChange={(e) => {
                    const newBook = e.target.value;
                    setSpotlightBook(newBook);
                    setSpotlightChapter(1);
                    fetchBibleVerses(`${newBook} 1`);
                  }}
                  style={{ flex: 2, padding: '4px 8px', background: '#111726', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                >
                  {BIBLE_BOOKS.map((b) => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>

                <select 
                  className="form-input"
                  value={spotlightChapter}
                  onChange={(e) => {
                    const newCh = parseInt(e.target.value);
                    setSpotlightChapter(newCh);
                    fetchBibleVerses(`${spotlightBook} ${newCh}`);
                  }}
                  style={{ flex: 1, padding: '4px 8px', background: '#111726', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                >
                  {Array.from(
                    { length: BIBLE_BOOKS.find(b => b.name === spotlightBook)?.chapters || 1 },
                    (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    )
                  )}
                </select>
              </div>

              {loadingBible ? (
                <div style={{ textAlign: 'center', color: 'var(--primary-gold)', fontSize: '0.85rem', padding: '10px' }}>Loading scripture...</div>
              ) : bibleError ? (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>{bibleError}</div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  {spotlightVerses.map((v) => (
                    <div 
                      key={v.verse} 
                      onClick={() => spotlightScripture(v.text, `${spotlightBook} ${spotlightChapter}:${v.verse}`)}
                      style={{ 
                        padding: '6px 8px', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        fontSize: '0.8rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(226,168,80,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <strong style={{ color: 'var(--primary-gold)', marginRight: '6px' }}>{v.verse}</strong>
                      {v.text}
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
            {/* Push Announcement Composer */}
            <div className="glass-panel" style={{ padding: '12px', border: '1px solid rgba(226,168,80,0.15)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary-gold)', fontWeight: 600 }}>PUSH ANNOUNCEMENT (REAL-TIME POPUP)</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Sends a native desktop/mobile alert instantly to all online members.
              </p>
              <input 
                type="text"
                id="push-title-input"
                className="form-input"
                placeholder="Alert Title (e.g. Service starting!)"
                style={{ fontSize: '0.85rem', padding: '6px 10px' }}
              />
              <textarea 
                id="push-text-input"
                className="form-input"
                rows={2}
                placeholder="Alert Message (e.g. Tap to join the livestream now.)"
                style={{ resize: 'none', fontSize: '0.85rem', padding: '6px 10px' }}
              />
              <button
                type="button"
                onClick={() => {
                  const titleEl = document.getElementById('push-title-input') as HTMLInputElement;
                  const textEl = document.getElementById('push-text-input') as HTMLTextAreaElement;
                  if (titleEl && textEl && textEl.value.trim()) {
                    sendPushAnnouncement(titleEl.value.trim() || 'NBBC Sanctuary Alert', textEl.value.trim());
                    titleEl.value = '';
                    textEl.value = '';
                    alert('Push alert sent!');
                  }
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '8px' }}
              >
                Send Native Push Alert
              </button>
            </div>

            <h4 style={{ color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', marginBottom: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
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

        {/* Admin Control Tab */}
        {activeTab === 'admin' && (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', margin: '0 0 4px 0', fontSize: '1.1rem' }}>
              ⛪ Church Administration
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Manage registered congregation members and promote roles (Deacon, Choir, etc.) in real-time.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                All Registered Members ({registeredUsers.length})
              </span>
              
              {registeredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                  No members are registered in the system database.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {registeredUsers.map((member: any) => {
                    const isPastorSelf = member.email === user.email;
                    const onlineMember = members.find(m => m.email === member.email);
                    const isOnline = !!onlineMember;

                    return (
                      <div key={member.email} className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '1px solid var(--primary-gold)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255,255,255,0.02)'
                          }}>
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)', fontWeight: 600 }}>
                                {member.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.name} {isPastorSelf && '(You)'}
                              </span>
                              <span style={{ 
                                fontSize: '0.6rem', 
                                padding: '1px 4px', 
                                borderRadius: '3px', 
                                background: isOnline ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: isOnline ? '#4ade80' : 'var(--text-muted)',
                                border: isOnline ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255,255,255,0.05)'
                              }}>
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.email}
                            </span>
                          </div>
                        </div>

                        {member.bio && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '4px' }}>
                            "{member.bio}"
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary-gold)', textTransform: 'capitalize' }}>
                            Role: <strong>{member.role}</strong>
                          </span>
                          
                          {!isPastorSelf && (
                            <select 
                              value={member.role}
                              onChange={async (e) => {
                                const newRole = e.target.value as any;
                                try {
                                  await supabase.from('users').update({ role: newRole }).eq('email', member.email);
                                  if (isOnline) {
                                    updateRole(member.email, newRole);
                                  }
                                  setRegisteredUsers(prev => prev.map(u => u.email === member.email ? { ...u, role: newRole } : u));
                                } catch (err) {
                                  console.error('Failed to change member role:', err);
                                }
                              }}
                              style={{
                                background: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(226,168,80,0.3)',
                                borderRadius: '4px',
                                color: 'white',
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="member">Member</option>
                              <option value="choir">Choir Loft</option>
                              <option value="deacon">Deacon Bench</option>
                              <option value="visitor">Visitor</option>
                              <option value="pastor">Pastor</option>
                            </select>
                          )}
                        </div>

                        {!isPastorSelf && isOnline && onlineMember && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button 
                              type="button"
                              onClick={() => muteMember(member.email)}
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '4px', fontSize: '0.65rem' }}
                            >
                              {onlineMember.isMuted ? 'Unmute Mic' : 'Mute Mic'}
                            </button>
                            <button 
                              type="button"
                              onClick={() => revokeMemberMedia(member.email)}
                              className="btn btn-danger"
                              style={{ flex: 1, padding: '4px', fontSize: '0.65rem' }}
                            >
                              Revoke Media
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

            {sermonTimeline.length > 0 && (
              <div style={{ marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  RECORDED SERMON TIMELINE (FOR AI NOTES):
                </span>
                {sermonTimeline.map((item, idx) => (
                  <div key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--primary-gold)' }}>[{item.timestamp}]</span>
                    <span>{item.text}</span>
                  </div>
                ))}
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

      {showProfileModal && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfileModal(false)} 
          onUpdate={updateProfile} 
        />
      )}
    </div>
  );
}
