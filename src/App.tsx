import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import PastorDashboard from './components/PastorDashboard';
import CongregationView from './components/CongregationView';
import useWebRTC from './hooks/useWebRTC';

interface User {
  name: string;
  email: string;
  role: 'pastor' | 'deacon' | 'choir' | 'member' | 'visitor';
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
