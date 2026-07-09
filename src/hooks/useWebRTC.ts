import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { API_BASE, WS_URL } from '../lib/apiConfig';

interface User {
  name: string;
  email: string;
  role: 'pastor' | 'member';
}

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

export default function useWebRTC(user: User | null) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [serviceStatus, setServiceStatus] = useState<'live' | 'offline'>('offline');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [email: string]: MediaStream }>({});
  
  // Controls
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isMutedByPastor, setIsMutedByPastor] = useState(true);
  


  // Watermark Image loading
  const watermarkLogoRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = '/nbbc-logo.jpg';
    watermarkLogoRef.current = img;
  }, []);

  // Giving States
  const [givingTotal, setGivingTotal] = useState(0);
  const [givingTransactions, setGivingTransactions] = useState<any[]>([]);
  const [givingToast, setGivingToast] = useState<any | null>(null);

  const fetchGivingSummary = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('giving')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data) {
          const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
          setGivingTotal(total);
          setGivingTransactions(data);
        }
      } catch (e) {
        console.error('Error fetching giving summary from Supabase:', e);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE}/api/giving-summary`);
        if (response.ok) {
          const data = await response.json();
          setGivingTotal(data.total);
          setGivingTransactions(data.transactions || []);
        }
      } catch (e) {
        console.error('Error fetching giving summary locally:', e);
      }
    }
  };

  // Prayer Wall & Scripture Spotlight States
  const [prayers, setPrayers] = useState<any[]>([]);
  const [activeSpotlight, setActiveSpotlight] = useState<{ text: string; reference?: string } | null>(null);
  const [sermonTimeline, setSermonTimeline] = useState<{ timestamp: string; type: 'scripture' | 'point'; text: string }[]>([]);

  const fetchPrayers = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('prayers')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setPrayers(data);
      } catch (e) {
        console.error('Error fetching prayers from Supabase:', e);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE}/api/prayers`);
        if (response.ok) {
          const data = await response.json();
          setPrayers(data);
        }
      } catch (e) {
        console.error('Error fetching prayers locally:', e);
      }
    }
  };

  const postPrayer = async (text: string) => {
    if (!user) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    try {
      let newPrayer;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('prayers')
          .insert({
            sender: user.name,
            text: text,
            praying_count: 0
          })
          .select();
        if (error) throw error;
        newPrayer = data?.[0];
      } else {
        const response = await fetch(`${API_BASE}/api/prayers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: user.name, text })
        });
        if (response.ok) {
          newPrayer = await response.json();
        }
      }

      if (newPrayer) {
        socketRef.current?.send(JSON.stringify({
          type: 'prayer-post',
          prayer: newPrayer
        }));
      }
    } catch (e) {
      console.error('Error posting prayer:', e);
    }
  };

  const reactToPrayer = async (id: any) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = !!(url && anonKey && 
                                 !url.includes('placeholder-project') && 
                                 !anonKey.includes('placeholder-anon-key'));
    try {
      let updatedPrayer;
      if (isSupabaseConfigured) {
        const { data: current } = await supabase
          .from('prayers')
          .select('praying_count')
          .eq('id', id)
          .single();

        const newCount = (current?.praying_count || 0) + 1;
        const { data, error } = await supabase
          .from('prayers')
          .update({ praying_count: newCount })
          .eq('id', id)
          .select();
        if (error) throw error;
        updatedPrayer = data?.[0];
      } else {
        const response = await fetch(`${API_BASE}/api/prayers/${id}/react`, {
          method: 'POST'
        });
        if (response.ok) {
          updatedPrayer = await response.json();
        }
      }

      if (updatedPrayer) {
        socketRef.current?.send(JSON.stringify({
          type: 'prayer-react',
          id: updatedPrayer.id,
          count: updatedPrayer.praying_count
        }));
      }
    } catch (e) {
      console.error('Error reacting to prayer:', e);
    }
  };

  const sendPushAnnouncement = (title: string, text: string) => {
    socketRef.current?.send(JSON.stringify({
      type: 'push-announcement',
      title,
      text
    }));
  };

  const spotlightScripture = (text: string, reference?: string) => {
    socketRef.current?.send(JSON.stringify({
      type: 'scripture-spotlight',
      scripture: text ? { text, reference } : null
    }));
  };

  // Request native notifications permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const pcsRef = useRef<{ [email: string]: RTCPeerConnection }>({});
  const socketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mockIntervalRef = useRef<any>(null);
  const canvasAnimFrameRef = useRef<number | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Configuration for WebRTC
  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  // Helper to create a fallback animated stream when webcam/microphone is unavailable
  const createMockStream = (userName: string, isPastor: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    let angle = 0;
    const draw = () => {
      if (!ctx) return;
      
      // Draw background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw church circle graphic
      ctx.beginPath();
      ctx.arc(640, 340, 160 + Math.sin(angle) * 15, 0, Math.PI * 2);
      ctx.strokeStyle = isPastor ? 'rgba(226, 168, 80, 0.25)' : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Outer gold dash ring
      ctx.beginPath();
      ctx.arc(640, 340, 190, 0, Math.PI * 2);
      ctx.strokeStyle = isPastor ? 'rgba(226, 168, 80, 0.15)' : 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 20]);
      ctx.stroke();
      ctx.setLineDash([]); // Reset
      
      // Text
      ctx.fillStyle = isPastor ? '#e2a850' : '#f1f5f9';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(userName, 640, 330);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText(isPastor ? 'Broadcasting Pulpit Feed' : 'Member Audio/Video Feed', 640, 375);
      
      // Status Indicator
      ctx.fillStyle = isPastor ? '#ef4444' : '#10b981';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(isPastor ? '● LIVE SERMON' : '● ACTIVE SPEAKING', 640, 230);

      angle += 0.05;
    };

    draw();
    const intervalId = setInterval(draw, 100);
    mockIntervalRef.current = intervalId;

    const stream = canvas.captureStream(30);

    // Add a silent mock audio track
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dst = audioCtx.createMediaStreamDestination();
      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (e) {
      console.error('Silent audio generation failed:', e);
    }

    return stream;
  };

  const stopLocalStream = () => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
    if (canvasAnimFrameRef.current) {
      cancelAnimationFrame(canvasAnimFrameRef.current);
      canvasAnimFrameRef.current = null;
    }
    if (hiddenVideoRef.current) {
      if (hiddenVideoRef.current.parentNode) {
        hiddenVideoRef.current.parentNode.removeChild(hiddenVideoRef.current);
      }
      hiddenVideoRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  };

  const getMedia = async (video: boolean, audio: boolean) => {
    try {
      // Keep track of the old audio track if it's already active and we don't want to change audio state
      const oldAudioTrack = localStreamRef.current?.getAudioTracks().find(t => t.readyState === 'live');
      
      // Stop only tracks that are changing
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
      if (canvasAnimFrameRef.current) {
        cancelAnimationFrame(canvasAnimFrameRef.current);
        canvasAnimFrameRef.current = null;
      }
      
      // Stop old tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (track.kind === 'video' || !audio) {
            track.stop();
          }
        });
      }

      if (!video && !audio) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
          setLocalStream(null);
        }
        updateMediaStateOnServer(false, true);
        return null;
      }

      let audioTrack: MediaStreamTrack | null = null;
      if (audio) {
        if (oldAudioTrack) {
          audioTrack = oldAudioTrack;
        } else {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioTrack = audioStream.getAudioTracks()[0];
          } catch (err) {
            console.warn('Could not acquire microphone:', err);
          }
        }
      }

      let videoTrack: MediaStreamTrack | null = null;
      if (video) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
          videoTrack = videoStream.getVideoTracks()[0];
        } catch (err) {
          console.warn('Hardware camera failed. Using mock canvas stream:', err);
          const mockStream = createMockStream(user?.name || 'Anonymous', user?.role === 'pastor');
          videoTrack = mockStream.getVideoTracks()[0];
        }
      }

      const newStream = new MediaStream();
      if (audioTrack) newStream.addTrack(audioTrack);
      if (videoTrack) newStream.addTrack(videoTrack);

      let finalStream = newStream;
      const isPastor = user?.role === 'pastor';
      if (video && videoTrack && isPastor) {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        
        const videoEl = document.createElement('video');
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.style.display = 'none';
        document.body.appendChild(videoEl);
        hiddenVideoRef.current = videoEl;

        const drawFrame = () => {
          if (!ctx || videoEl.paused || videoEl.ended) return;
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

          // Burn watermark directly into the video stream pixels
          if (watermarkLogoRef.current && watermarkLogoRef.current.complete) {
            ctx.save();
            const watermarkX = canvas.width - 80;
            const watermarkY = canvas.height - 60;
            const size = 50; // larger size for 720p HD frame
            const angle = (Date.now() / 25000) * Math.PI * 2; // complete spin every 25 seconds
            
            // Draw circular translucent background behind logo
            ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
            ctx.beginPath();
            ctx.arc(watermarkX, watermarkY, size / 2 + 5, 0, Math.PI * 2);
            ctx.fill();

            // Translate & Rotate logo (simulate spinning coin)
            ctx.translate(watermarkX, watermarkY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(watermarkLogoRef.current, -size / 2, -size / 2, size, size);
            ctx.restore();

            // Draw translucent text overlay
            ctx.save();
            ctx.fillStyle = 'rgba(226, 168, 80, 0.85)';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 4;
            ctx.fillText('NBBC SANCTUARY', watermarkX - (size / 2 + 12), watermarkY);
            ctx.restore();
          }

          canvasAnimFrameRef.current = requestAnimationFrame(drawFrame);
        };

        // Attach event handlers BEFORE assigning source and playing
        videoEl.onplay = () => {
          drawFrame();
        };

        const tempStream = new MediaStream();
        tempStream.addTrack(videoTrack);
        videoEl.srcObject = tempStream;
        videoEl.play().catch(e => console.error('Error playing raw stream for watermark', e));

        const canvasStream = (canvas as any).captureStream(30);
        const processedVideoTrack = canvasStream.getVideoTracks()[0];
        
        finalStream = new MediaStream();
        if (processedVideoTrack) finalStream.addTrack(processedVideoTrack);
        if (audioTrack) finalStream.addTrack(audioTrack);
      }

      setLocalStream(finalStream);
      localStreamRef.current = finalStream;
      
      updateMediaStateOnServer(video, !audio);

      // Update active WebRTC connections with new tracks using replaceTrack/transceivers
      Object.keys(pcsRef.current).forEach(async email => {
        const pc = pcsRef.current[email];
        const senders = pc.getSenders();

        finalStream.getTracks().forEach(track => {
          // Find existing transceiver of this kind (e.g. video or audio)
          const transceiver = pc.getTransceivers().find(t => t.receiver && t.receiver.track && t.receiver.track.kind === track.kind);
          if (transceiver) {
            transceiver.direction = 'sendrecv';
            transceiver.sender.replaceTrack(track).catch(err => {
              console.error(`Error replacing track for ${email}:`, err);
            });
          } else {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track).catch(err => {
                console.error(`Error replacing track for ${email}:`, err);
              });
            } else {
              pc.addTrack(track, finalStream);
            }
          }
        });
        
        // Disable sending for tracks not in finalStream
        pc.getTransceivers().forEach(t => {
          if (t.sender && t.sender.track && !finalStream.getTracks().some(tr => tr.kind === t.sender.track!.kind)) {
            t.direction = 'recvonly';
          }
        });

        // Manually trigger negotiation if stable to guarantee renegotiation
        if (pc.signalingState === 'stable') {
          try {
            console.log(`Manually triggering renegotiation for ${email}...`);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.send(JSON.stringify({
              type: 'signal',
              target: email,
              sender: user?.email,
              signalData: { sdp: pc.localDescription }
            }));
          } catch (e) {
            console.error('Error during manual renegotiation:', e);
          }
        }
      });

      return finalStream;
    } catch (error) {
      console.error('Error in getMedia:', error);
      return null;
    }
  };

  const updateMediaStateOnServer = (isStreaming: boolean, isMuted: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'media-state',
        isStreaming,
        isMuted
      }));
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;
    setSocket(ws);

    ws.onopen = () => {
      console.log('Connected to signaling server');
      ws.send(JSON.stringify({
        type: 'join',
        email: user.email,
        name: user.name,
        role: user.role
      }));
      fetchGivingSummary();
      fetchPrayers();
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'service-state': {
          setServiceStatus(msg.status);
          if (msg.status === 'offline') {
            // Clean up peer connections
            Object.keys(pcsRef.current).forEach(email => {
              pcsRef.current[email].close();
            });
            pcsRef.current = {};
            setRemoteStreams({});
            
            // Turn off camera/mic for congregation on service stop
            if (user.role === 'member') {
              setIsCameraOn(false);
              setIsMicOn(false);
              setHandRaised(false);
              setIsMutedByPastor(true);
              stopLocalStream();
            }
          }
          break;
        }

        case 'giving-update': {
          setGivingTotal(msg.total);
          if (msg.recentTransaction) {
            setGivingTransactions(prev => {
              // Avoid duplicates if rest request loaded it already
              if (prev.some(t => t.id === msg.recentTransaction.id)) return prev;
              return [msg.recentTransaction, ...prev];
            });
            if (user?.role === 'pastor') {
              setGivingToast(msg.recentTransaction);
              setTimeout(() => {
                setGivingToast(null);
              }, 4000);
            }
          }
          break;
        }

        case 'prayer-posted': {
          setPrayers(prev => {
            if (prev.some(p => p.id === msg.prayer.id)) return prev;
            return [msg.prayer, ...prev];
          });
          break;
        }

        case 'prayer-reacted': {
          setPrayers(prev => prev.map(p => {
            if (p.id === msg.id) {
              return { ...p, praying_count: msg.count };
            }
            return p;
          }));
          break;
        }

        case 'push-announcement': {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(msg.title, {
              body: msg.text,
              icon: '/favicon.svg'
            });
          }
          break;
        }

        case 'scripture-spotlight': {
          setActiveSpotlight(msg.scripture);
          if (msg.scripture) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setSermonTimeline(prev => [
              ...prev,
              {
                timestamp: timeStr,
                type: msg.scripture.reference ? 'scripture' : 'point',
                text: msg.scripture.reference 
                  ? `${msg.scripture.reference}: ${msg.scripture.text}` 
                  : msg.scripture.text
              }
            ]);
          }
          break;
        }

        case 'members-list': {
          setMembers(msg.members);
          
          // If pastor, check if any member disconnected and clean up WebRTC
          if (user.role === 'pastor') {
            const activeEmails = msg.members.map((m: any) => m.email);
            Object.keys(pcsRef.current).forEach(email => {
              if (!activeEmails.includes(email)) {
                pcsRef.current[email].close();
                delete pcsRef.current[email];
                setRemoteStreams(prev => {
                  const updated = { ...prev };
                  delete updated[email];
                  return updated;
                });
              }
            });
          }
          break;
        }

        case 'chat': {
          setChatMessages(prev => [...prev, msg]);
          break;
        }

        case 'reaction': {
          const id = Date.now() + Math.random();
          setReactions(prev => [...prev, { id, emoji: msg.emoji }]);
          // Auto remove reaction after 4s
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
          }, 4000);
          break;
        }

        case 'media-control': {
          // Received by congregation members from the pastor
          if (user.role === 'member') {
            if (msg.action === 'approve') {
              setIsMutedByPastor(false);
              setIsMicOn(true);
              getMedia(isCameraOn, true);
            } else if (msg.action === 'mute') {
              setIsMicOn(false);
              getMedia(isCameraOn, false);
            } else if (msg.action === 'revoke') {
              setIsMutedByPastor(true);
              setIsMicOn(false);
              setIsCameraOn(false);
              getMedia(false, false);
            }
          }
          break;
        }

        case 'signal': {
          const { sender, signalData } = msg;
          let pc = pcsRef.current[sender];

          if (!pc) {
            pc = createPeerConnection(sender);
          }

          if (signalData.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
            if (signalData.sdp.type === 'offer') {
              // Add local stream tracks if available
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                  pc.addTrack(track, localStreamRef.current!);
                });
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: 'signal',
                target: sender,
                sender: user.email,
                signalData: { sdp: pc.localDescription }
              }));
            }
          } else if (signalData.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
            } catch (e) {
              console.error('Error adding ICE candidate', e);
            }
          }
          break;
        }
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    return () => {
      ws.close();
      stopLocalStream();
      Object.keys(pcsRef.current).forEach(email => {
        pcsRef.current[email].close();
      });
    };
  }, [user]);

  // Create WebRTC Peer Connection
  const createPeerConnection = (remoteEmail: string) => {
    const pc = new RTCPeerConnection(rtcConfig);
    pcsRef.current[remoteEmail] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'signal',
          target: remoteEmail,
          sender: user?.email,
          signalData: { candidate: event.candidate }
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteEmail}:`, event.track.kind);
      setRemoteStreams(prev => {
        const currentStream = prev[remoteEmail];
        let streamToUse = currentStream;
        if (!streamToUse || !(streamToUse instanceof MediaStream)) {
          streamToUse = new MediaStream();
        }
        const trackExists = streamToUse.getTracks().some(t => t.id === event.track.id);
        if (!trackExists) {
          streamToUse.addTrack(event.track);
        }
        return {
          ...prev,
          [remoteEmail]: streamToUse
        };
      });
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState === 'stable') {
          console.log(`Negotiation needed with ${remoteEmail}. Creating offer...`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'signal',
              target: remoteEmail,
              sender: user?.email,
              signalData: { sdp: pc.localDescription }
            }));
          }
        }
      } catch (err) {
        console.error('Error during renegotiation:', err);
      }
    };

    return pc;
  };

  // Initiate WebRTC call (invoked by congregation members when service starts)
  const initiateCall = async (pastorEmail: string) => {
    const pc = createPeerConnection(pastorEmail);

    // Add local tracks if camera or mic is active
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      // Create transceivers to receive video/audio even if we aren't sending
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'signal',
        target: pastorEmail,
        sender: user?.email,
        signalData: { sdp: pc.localDescription }
      }));
    }
  };

  // Connect to Pastor's stream
  useEffect(() => {
    if (user?.role === 'member' && serviceStatus === 'live') {
      const pastor = members.find(m => m.role === 'pastor');
      if (pastor && !pcsRef.current[pastor.email]) {
        initiateCall(pastor.email);
      }
    }
  }, [serviceStatus, members, user]);

  // Send message
  const sendChatMessage = (text: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat',
        text
      }));
    }
  };

  // Send reaction
  const sendReaction = (emoji: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'reaction',
        emoji
      }));
    }
  };

  // Raise hand
  const toggleHandRaise = () => {
    if (user?.role === 'member') {
      const newHandState = !handRaised;
      setHandRaised(newHandState);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'hand-raise',
          raised: newHandState
        }));
      }
    }
  };

  // Approve member's hand raise (Pastor only)
  const approveHandRaise = (memberEmail: string) => {
    if (user?.role === 'pastor' && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'hand-approve',
        targetEmail: memberEmail,
        action: 'approve'
      }));
    }
  };

  // Mute member (Pastor only)
  const muteMember = (memberEmail: string) => {
    if (user?.role === 'pastor' && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'hand-approve',
        targetEmail: memberEmail,
        action: 'mute'
      }));
    }
  };

  // Revoke member's microphone and camera privileges (Pastor only)
  const revokeMemberMedia = (memberEmail: string) => {
    if (user?.role === 'pastor' && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'hand-approve',
        targetEmail: memberEmail,
        action: 'revoke'
      }));
    }
  };

  // Toggle Camera
  const toggleCamera = async () => {
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    await getMedia(nextState, isMicOn);
  };

  // Toggle Microphone
  const toggleMic = async () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    await getMedia(isCameraOn, nextState);
  };

  // Control Service State (Pastor only)
  const toggleService = async (start: boolean) => {
    if (user?.role !== 'pastor') return;

    if (start) {
      setSermonTimeline([]);
      // Turn on pastor camera/mic
      setIsCameraOn(true);
      setIsMicOn(true);
      await getMedia(true, true);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'service-state',
          status: 'live'
        }));
      }
      setServiceStatus('live');
    } else {
      setIsCameraOn(false);
      setIsMicOn(false);
      stopLocalStream();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'service-state',
          status: 'offline'
        }));
      }
      setServiceStatus('offline');
    }
  };

  const sendGivingUpdate = (total: number, recentTransaction: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'giving-update',
        total,
        recentTransaction
      }));
    }
  };

  return {
    members,
    chatMessages,
    reactions,
    serviceStatus,
    localStream,
    remoteStreams,
    isCameraOn,
    isMicOn,
    handRaised,
    isMutedByPastor,
    sendChatMessage,
    sendReaction,
    toggleHandRaise,
    approveHandRaise,
    muteMember,
    revokeMemberMedia,
    toggleCamera,
    toggleMic,
    toggleService,
    givingTotal,
    givingTransactions,
    givingToast,
    setGivingToast,
    fetchGivingSummary,
    sendGivingUpdate,
    prayers,
    activeSpotlight,
    postPrayer,
    reactToPrayer,
    sendPushAnnouncement,
    spotlightScripture,
    sermonTimeline,
    setSermonTimeline
  };
}
