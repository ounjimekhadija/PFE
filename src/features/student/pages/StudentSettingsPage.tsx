import React, { useEffect, useRef, useState } from 'react';
import { Camera, Lock, Save, Shield, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const StudentSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [success, setSuccess] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [profile, setProfile] = useState({
    name: 'Loading...',
    email: 'loading@hub.student',
    phone: '',
    website: '',
    github: '',
    linkedin: '',
    avatar: 'https://ui-avatars.com/api/?name=User&background=random',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: user } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const { data: student } = await supabase
        .from('etudiants')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (user) {
        setProfile({
          name: `${user.prenom} ${user.nom}`,
          email: user.email,
          phone: user.telephone || '',
          website: student?.portfolio_url || '',
          github: student?.github_url || '',
          linkedin: student?.linkedin_url || '',
          avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${user.prenom}+${user.nom}&background=random`,
        });
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setUploadingAvatar(true);

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const fileName = `${userId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('utilisateurs').update({ avatar_url: publicUrl }).eq('id', userId);
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { error: userError } = await supabase
        .from('utilisateurs')
        .update({ telephone: profile.phone })
        .eq('id', session.user.id);
      if (userError) throw userError;

      const { error: studentError } = await supabase
        .from('etudiants')
        .update({ portfolio_url: profile.website, github_url: profile.github, linkedin_url: profile.linkedin })
        .eq('id', session.user.id);
      if (studentError) throw studentError;

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
      alert('Error changing password: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#faf9f6] text-sm font-medium text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
        Loading data...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1a1c1a]">Settings</h1>
        <p className="mt-1 text-sm text-[#7f7664]">Manage your account settings and profile information.</p>
      </header>

      <div className="rounded-2xl border border-transparent bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Edit Profile' },
              { id: 'security', icon: Shield, label: 'Security' },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as 'profile' | 'security')}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    active
                      ? 'bg-[#ffd464] text-[#594400]'
                      : 'text-[#7f7664] hover:bg-[#f4f3f1] hover:text-[#1a1c1a]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <item.icon size={16} />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </aside>

          <section>
            {success && (
              <div className="mb-4 rounded-xl border border-transparent bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
                Changes saved successfully.
              </div>
            )}

            {activeTab === 'profile' && (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center gap-5 rounded-2xl border border-transparent bg-[#f4f3f1] p-6 sm:flex-row">
                  <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className={`h-24 w-24 rounded-full border-4 border-white object-cover shadow-md transition ${
                        uploadingAvatar ? 'opacity-60' : 'hover:opacity-80'
                      }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition hover:opacity-100">
                      <Camera size={18} />
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-lg font-semibold text-[#1a1c1a]">{profile.name}</p>
                    <p className="text-sm text-[#7f7664]">{profile.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { label: 'Phone Number', key: 'phone', type: 'text' },
                    { label: 'Website', key: 'website', type: 'text' },
                    { label: 'GitHub', key: 'github', type: 'text' },
                    { label: 'LinkedIn', key: 'linkedin', type: 'text' },
                  ].map(({ label, key, type }) => (
                    <label key={key} className="space-y-2 text-sm font-medium text-[#4d4636]">
                      {label}
                      <input
                        type={type}
                        value={profile[key as keyof typeof profile]}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        className="w-full rounded-xl border border-[#efeeeb] bg-white px-4 py-3 text-sm text-[#1a1c1a] shadow-sm outline-none transition focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/15"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#765b00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#594400]"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </form>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handlePasswordChange} className="max-w-xl space-y-4">
                <h2 className="text-lg font-semibold text-[#1a1c1a]">Change Password</h2>
                {[
                  { label: 'Current Password', key: 'current' },
                  { label: 'New Password', key: 'new' },
                  { label: 'Confirm New Password', key: 'confirm' },
                ].map(({ label, key }) => (
                  <label key={key} className="space-y-2 text-sm font-medium text-[#4d4636]">
                    {label}
                    <input
                      type="password"
                      value={passwords[key as keyof typeof passwords]}
                      onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                      className="w-full rounded-xl border border-[#efeeeb] bg-white px-4 py-3 text-sm text-[#1a1c1a] shadow-sm outline-none transition focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/15"
                    />
                  </label>
                ))}

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1a1c1a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4d4636]"
                >
                  <Lock size={16} />
                  Change Password
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default StudentSettingsPage;
