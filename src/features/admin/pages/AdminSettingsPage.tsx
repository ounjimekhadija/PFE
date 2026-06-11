import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, Shield, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const AdminSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({
    name: 'Loading...',
    email: '',
    phone: '',
    website: '',
    github: '',
    linkedin: '',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=random',
  });

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveAvatarUrl = (value: string | null | undefined, fallbackName: string): string => {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;
    if (!value) return fallback;
    const raw = value.trim();
    if (!raw) return fallback;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
    const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
    return data?.publicUrl || fallback;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData, error: userError } = await supabase
          .from('utilisateurs')
          .select('nom, prenom, email, telephone, avatar_url')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        const { data: adminData } = await supabase
          .from('administrateurs')
          .select('portfolio_url, github_url, linkedin_url')
          .eq('utilisateur_id', user.id)
          .single();

        const fullName = `${userData.prenom || ''} ${userData.nom || ''}`.trim() || 'Admin';
        setProfile({
          name: fullName,
          email: userData.email || user.email || '',
          phone: userData.telephone || '',
          website: adminData?.portfolio_url || '',
          github: adminData?.github_url || '',
          linkedin: adminData?.linkedin_url || '',
          avatar: resolveAvatarUrl(userData.avatar_url, fullName),
        });
      } catch (err) {
        console.error('Error loading admin profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setUploadingAvatar(true);

      const file = event.target.files[0];
      const ext = file.name.split('.').pop() || 'jpg';
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const filePath = `${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || '';

      const { error: updateError } = await supabase.from('utilisateurs').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      setProfile((prev) => ({ ...prev, avatar: publicUrl }));
    } catch (error: any) {
      alert('Error uploading photo: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: userError } = await supabase.from('utilisateurs').update({ telephone: profile.phone }).eq('id', user.id);
      if (userError) throw userError;

      const { error: adminError } = await supabase
        .from('administrateurs')
        .update({
          portfolio_url: profile.website,
          github_url: profile.github,
          linkedin_url: profile.linkedin,
        })
        .eq('utilisateur_id', user.id);

      if (adminError) throw adminError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error: any) {
      alert('Error saving: ' + error.message);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('Passwords do not match.');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      setPasswords({ current: '', new: '', confirm: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error: any) {
      alert('Error changing password: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#faf9f6] p-8 text-sm font-medium text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
        Loading data...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1a1c1a]">Settings</h1>
        <p className="mt-2 text-sm text-[#7f7664]">Manage your account profile and security preferences.</p>
      </header>

      {success && (
        <div className="mb-4 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]">
          Changes saved successfully.
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[260px,1fr]">
        <aside className="mb-6 rounded-2xl border border-transparent bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Edit Profile' },
              { id: 'security', icon: Shield, label: 'Security' },
            ].map((item) => (
              <button
                key={item.id}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeTab === item.id
                    ? 'bg-[#ffd464] text-[#594400]'
                    : 'text-[#7f7664] hover:bg-[#f4f3f1] hover:text-[#4d4636]'
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <article className="mb-6 rounded-2xl border border-transparent bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-transparent bg-[#f4f3f1] p-4 sm:flex-row sm:items-center">
                <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <img
                    src={profile.avatar}
                    alt="Profile"
                    className={`h-24 w-24 rounded-full border border-transparent object-cover transition ${uploadingAvatar ? 'opacity-60' : ''}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition hover:opacity-100">
                    <Camera size={18} />
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#1a1c1a]">{profile.name}</p>
                  <p className="text-sm text-[#7f7664]">{profile.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { label: 'Phone', key: 'phone', type: 'text' },
                  { label: 'Website', key: 'website', type: 'text' },
                  { label: 'GitHub', key: 'github', type: 'text' },
                  { label: 'LinkedIn', key: 'linkedin', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm font-medium text-[#4d4636]">{label}</label>
                    <input
                      type={type}
                      value={profile[key as keyof typeof profile]}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                      className="w-full rounded-xl border border-[#efeeeb] bg-white px-3 py-2 text-sm text-[#1a1c1a] shadow-sm outline-none focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/20"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#765b00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(118,91,0,0.30)] transition hover:bg-[#594400]"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <h2 className="text-xl font-semibold text-[#1a1c1a]">Change Password</h2>

              {[
                { label: 'Current Password', key: 'current' },
                { label: 'New Password', key: 'new' },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-[#4d4636]">{label}</label>
                  <input
                    type="password"
                    value={passwords[key as keyof typeof passwords]}
                    onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                    className="w-full rounded-xl border border-[#efeeeb] bg-white px-3 py-2 text-sm text-[#1a1c1a] shadow-sm outline-none focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/20"
                  />
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#765b00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(118,91,0,0.30)] transition hover:bg-[#594400]"
                >
                  <Save size={16} />
                  Change Password
                </button>
              </div>
            </form>
          )}
        </article>
      </section>
    </div>
  );
};

export default AdminSettingsPage;
