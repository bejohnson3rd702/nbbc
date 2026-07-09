import React, { useState } from 'react';
import { Mail, Lock, User, Key, Church, Eye, EyeOff, Phone } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface AuthProps {
  onAuthSuccess: (user: { name: string; email: string; role: 'pastor' | 'member' }) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Checks if the environment variables have been filled or are placeholders
  const isSupabaseConfigured = () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return url && anonKey && 
      !url.includes('placeholder-project') && 
      !anonKey.includes('placeholder-anon-key');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailClean = email.trim().toLowerCase();
    const adminCodeClean = adminCode.trim();

    // Dev Fallback check if Supabase is not configured yet
    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        setLoading(false);
        if (isLogin) {
          if (emailClean === 'pastor@nbbc.org' && password === 'password123') {
            const mockUser = { name: 'Pastor John', email: 'pastor@nbbc.org', role: 'pastor' as const };
            localStorage.setItem('nbbc_user', JSON.stringify(mockUser));
            onAuthSuccess(mockUser);
          } else if (emailClean === 'member@nbbc.org' && password === 'password123') {
            const mockUser = { name: 'Jamie Johnson', email: 'jamiejohnson814@gmil.com', role: 'member' as const };
            localStorage.setItem('nbbc_user', JSON.stringify(mockUser));
            onAuthSuccess(mockUser);
          } else {
            setError('Dev Mode: Use "pastor@nbbc.org" / "password123" or "member@nbbc.org" / "password123" to sign in, or configure Supabase keys in your .env file.');
          }
        } else {
          setError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to create new accounts.');
        }
      }, 500);
      return;
    }

    try {
      if (isLogin) {
        // 1. Authenticate with Supabase Auth
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: emailClean,
          password,
        });

        if (authError) throw authError;

        if (data.user) {
          // 2. Fetch profile from public.users table
          let { data: profile, error: profileError } = await supabase
            .from('users')
            .select('name, email, role, bio, avatar_url')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.warn('Columns bio/avatar_url might be missing, running fallback select...');
            const fallbackResult = await supabase
              .from('users')
              .select('name, email, role')
              .eq('id', data.user.id)
              .single();
            profile = fallbackResult.data ? { ...fallbackResult.data, bio: '', avatar_url: '' } : null;
            profileError = fallbackResult.error;
          }

          if (profileError || !profile) {
            // Profile fallback if not found in table
            const fallbackUser = {
              name: data.user.user_metadata?.name || 'Sanctuary Member',
              email: emailClean,
              role: (data.user.user_metadata?.role || 'member') as 'pastor' | 'member',
              bio: '',
              avatar_url: ''
            };
            localStorage.setItem('nbbc_user', JSON.stringify(fallbackUser));
            onAuthSuccess(fallbackUser);
          } else {
            const loggedInUser = {
              name: profile.name,
              email: profile.email,
              role: profile.role as 'pastor' | 'member',
              bio: (profile as any).bio || '',
              avatar_url: (profile as any).avatar_url || ''
            };
            localStorage.setItem('nbbc_user', JSON.stringify(loggedInUser));
            onAuthSuccess(loggedInUser);
          }
        }
      } else {
        // 1. Sign up user in Supabase Auth
        const userRole = showAdminField && adminCodeClean === 'NBBC2026' ? 'pastor' : 'member';
        
        if (showAdminField && adminCodeClean !== 'NBBC2026') {
          throw new Error('Invalid Church Administration Code');
        }

        const { data, error: authError } = await supabase.auth.signUp({
          email: emailClean,
          password,
          options: {
            data: {
              name: name.trim(),
              role: userRole,
            }
          }
        });

        if (authError) throw authError;

        if (data.user) {
          // 2. Insert profile record into public.users table
          const { error: profileError } = await supabase.from('users').insert({
            id: data.user.id,
            email: emailClean,
            name: name.trim(),
            phone: phone.trim() || null,
            role: userRole,
            bio: '',
            avatar_url: ''
          });

          if (profileError) throw profileError;

          const registeredUser = {
            name: name.trim(),
            email: emailClean,
            role: userRole as 'pastor' | 'member',
            bio: '',
            avatar_url: ''
          };
          
          localStorage.setItem('nbbc_user', JSON.stringify(registeredUser));
          onAuthSuccess(registeredUser);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Church size={48} color="var(--primary-gold)" />
          </div>
          <h1 className="auth-title">NBBC</h1>
          <p className="auth-subtitle">New Beginnings Baptist Church Live</p>
        </div>

        <div className="auth-tabs">
          <button 
            type="button" 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Log In
          </button>
          <button 
            type="button" 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            color: '#f87171', 
            padding: '12px', 
            borderRadius: '8px', 
            fontSize: '0.85rem', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="John Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required={!isLogin}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (For Announcements)</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="(555) 000-0000" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required={!isLogin && !showAdminField}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ paddingLeft: '44px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ paddingLeft: '44px', paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <input 
                  type="checkbox" 
                  checked={showAdminField}
                  onChange={(e) => setShowAdminField(e.target.checked)}
                  style={{ accentColor: 'var(--primary-gold)' }}
                />
                Register as Church Staff / Pastor
              </label>

              {showAdminField && (
                <div style={{ position: 'relative', marginTop: '12px' }}>
                  <Key size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Enter Administration Code" 
                    value={adminCode} 
                    onChange={(e) => setAdminCode(e.target.value)} 
                    required={showAdminField}
                    style={{ paddingLeft: '44px' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Demo code is <code>NBBC2026</code>
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p>New Beginnings Baptist Church</p>
          <p style={{ marginTop: '4px', fontStyle: 'italic' }}>"Let The God Of 2nd Chances Give You A Fresh Start At New Beginnings"</p>
        </div>
      </div>
    </div>
  );
}
