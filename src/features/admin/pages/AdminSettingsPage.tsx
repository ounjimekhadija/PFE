import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, Shield, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const AdminSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({
    name: 'Chargement...',
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
        console.error('Erreur chargement profil admin:', err);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      alert('Erreur lors du telechargement de la photo : ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      setPasswords({ current: '', new: '', confirm: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error: any) {
      alert('Erreur lors du changement de mot de passe: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFF] p-8 text-sm font-medium text-[#64748B]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        Chargement des donnees...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFF] p-6 md:p-8 text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="mt-2 text-sm text-[#64748B]">Manage your account profile and security preferences.</p>
      </header>

      {success && (
        <div className="mb-4 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]">
          Changes saved successfully.
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[260px,1fr]">
        <aside className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          <div className="space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Edit Profile' },
              { id: 'security', icon: Shield, label: 'Security' },
            ].map((item) => (
              <button
                key={item.id}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeTab === item.id
                    ? 'bg-[#EEF2FF] text-[#4338CA]'
                    : 'text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#334155]'
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4 sm:flex-row sm:items-center">
                <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <img
                    src={profile.avatar}
                    alt="Profile"
                    className={`h-24 w-24 rounded-full border border-[#E2E8F0] object-cover transition ${uploadingAvatar ? 'opacity-60' : ''}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition hover:opacity-100">
                    <Camera size={18} />
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#0F172A]">{profile.name}</p>
                  <p className="text-sm text-[#64748B]">{profile.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Phone</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Website</label>
                  <input
                    type="text"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">GitHub</label>
                  <input
                    type="text"
                    value={profile.github}
                    onChange={(e) => setProfile({ ...profile, github: e.target.value })}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">LinkedIn</label>
                  <input
                    type="text"
                    value={profile.linkedin}
                    onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] transition hover:bg-[#4F46E5]"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <h2 className="text-xl font-semibold text-[#0F172A]">Change Password</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#334155]">Current Password</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#334155]">New Password</label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#334155]">Confirm New Password</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] transition hover:bg-[#4F46E5]"
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
