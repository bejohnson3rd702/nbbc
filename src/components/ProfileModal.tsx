import React, { useState, useRef } from 'react';
import { Camera, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface User {
  name: string;
  email: string;
  role: 'pastor' | 'member';
  bio?: string;
  avatar_url?: string;
}

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (name: string, bio: string, avatarUrl: string) => void;
}

export default function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const filename = `avatar_${Date.now()}.${fileExt}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, file, {
          contentType: file.type,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filename);

      setAvatarUrl(data.publicUrl);
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setError(
        "Upload failed. Please ensure the 'avatars' storage bucket is created as a public bucket in your Supabase project."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // 1. Update Profile in database
      const { error: dbError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl
        })
        .eq('email', user.email);

      if (dbError) {
        console.warn('Profile update with bio/avatar failed, trying fallback update (name only)...');
        const { error: fallbackError } = await supabase
          .from('users')
          .update({ name: name.trim() })
          .eq('email', user.email);
        if (fallbackError) throw fallbackError;
      }

      // 2. Dispatch profile updated event so App.tsx is notified
      const updatedUser = {
        ...user,
        name: name.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl
      };
      window.dispatchEvent(new CustomEvent('nbbc-profile-updated', { detail: updatedUser }));

      // 3. Trigger signaling WebSocket sync
      onUpdate(name.trim(), bio.trim(), avatarUrl);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (userName: string) => {
    return userName
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        borderRadius: '16px',
        border: '1.5px solid var(--primary-gold)',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-gold)', fontSize: '1.25rem', margin: 0 }}>
            Edit Profile
          </h3>
          <button 
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Avatar Edit */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div 
              onClick={handleAvatarClick}
              style={{
                position: 'relative',
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                cursor: 'pointer',
                border: '2px solid var(--primary-gold)',
                boxShadow: '0 0 15px rgba(226,168,80,0.2)',
                overflow: 'hidden',
                background: 'rgba(15, 22, 38, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontSize: '2rem', color: 'var(--primary-gold)', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
                  {getInitials(name)}
                </span>
              )}
              
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '4px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Camera size={14} color="white" />
              </div>
            </div>

            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />

            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {uploading ? 'Uploading picture...' : 'Click photo to change'}
            </span>
          </div>

          {/* Display Name Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Display Name</label>
            <input 
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              required
              disabled={saving || uploading}
            />
          </div>

          {/* Bio Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Biography / Status</label>
            <textarea 
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the congregation a bit about yourself..."
              rows={3}
              style={{ resize: 'none', fontFamily: 'inherit', padding: '10px 14px' }}
              maxLength={200}
              disabled={saving || uploading}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
              {bio.length}/200 characters
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={saving || uploading}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              disabled={saving || uploading || success}
            >
              {success ? (
                <>
                  <Check size={16} />
                  Saved
                </>
              ) : (
                saving ? 'Saving...' : 'Save Changes'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
