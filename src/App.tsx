import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import PastorDashboard from './components/PastorDashboard';
import CongregationView from './components/CongregationView';
import useWebRTC from './hooks/useWebRTC';

interface User {
  name: string;
  email: string;
  role: 'pastor' | 'member';
  bio?: string;
  avatar_url?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('nbbc_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('nbbc_user');
      }
    }
    setLoading(false);
  }, []);

  // Listen for real-time role changes from signaling
  useEffect(() => {
    const handleRoleChanged = (e: Event) => {
      const newRole = (e as CustomEvent).detail;
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, role: newRole };
        localStorage.setItem('nbbc_user', JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('nbbc-role-changed', handleRoleChanged);
    return () => window.removeEventListener('nbbc-role-changed', handleRoleChanged);
  }, []);

  // Listen for local profile updates
  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const updatedUser = (e as CustomEvent).detail;
      setUser(updatedUser);
      localStorage.setItem('nbbc_user', JSON.stringify(updatedUser));
    };
    window.addEventListener('nbbc-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('nbbc-profile-updated', handleProfileUpdated);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('nbbc_user');
    setUser(null);
  };

  // Initialize the WebRTC hook once the user is logged in
  const webrtc = useWebRTC(user);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        backgroundColor: 'var(--bg-main)', 
        color: 'var(--primary-gold)',
        fontFamily: 'var(--font-serif)',
        fontSize: '1.5rem'
      }}>
        Loading Sanctuary...
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={setUser} />;
  }

  return (
    <>
      {user.role === 'pastor' ? (
        <PastorDashboard user={user} onLogout={handleLogout} webrtc={webrtc} />
      ) : (
        <CongregationView user={user} onLogout={handleLogout} webrtc={webrtc} />
      )}
    </>
  );
}

export default App;
