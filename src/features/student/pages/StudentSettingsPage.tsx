import React, { useEffect, useRef, useState } from 'react';
import { Camera, Github, Globe, Linkedin, Lock, Mail, Phone, Save, Shield, User } from 'lucide-react';
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
      if (!session?.user) {
        setLoading(false);
        return;
      }

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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#64748B]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
        Chargement du profil...
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 overflow-y-auto bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Parametres</h1>
            <span className="rounded-full bg-[#DCEBFA] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1E3A5F]">
              Espace etudiant
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">Mettez a jour votre profil, vos liens et la securite du compte.</p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                className="group relative"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className={`h-24 w-24 rounded-2xl object-cover shadow-md ring-4 ring-[#DCEBFA] transition ${uploadingAvatar ? 'opacity-60' : ''}`}
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#1E3A5F]/55 text-white opacity-0 transition group-hover:opacity-100">
                  <Camera size={20} />
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <h2 className="mt-4 text-lg font-bold text-[#1a1c1a]">{profile.name}</h2>
              <p className="mt-1 text-sm text-[#64748B]">{profile.email}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <ProfileLink icon={<Github size={15} />} label="GitHub" value={profile.github} />
              <ProfileLink icon={<Linkedin size={15} />} label="LinkedIn" value={profile.linkedin} />
              <ProfileLink icon={<Globe size={15} />} label="Portfolio" value={profile.website} />
              <ProfileLink icon={<Phone size={15} />} label="Telephone" value={profile.phone} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            {[
              { id: 'profile', icon: User, label: 'Profil' },
              { id: 'security', icon: Shield, label: 'Securite' },
            ].map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as 'profile' | 'security')}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                    active ? 'bg-[#1E3A5F] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#1a1c1a]'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </section>
        </aside>

        <section className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)] sm:p-6">
          {success && (
            <div className="mb-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
              Modifications enregistrees.
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1a]">Informations du profil</h2>
                <p className="mt-1 text-sm text-[#64748B]">Ces informations aident votre encadrant et votre equipe a vous contacter.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SettingsInput icon={<Phone size={16} />} label="Telephone" value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} />
                <SettingsInput icon={<Globe size={16} />} label="Portfolio" value={profile.website} onChange={(value) => setProfile({ ...profile, website: value })} />
                <SettingsInput icon={<Github size={16} />} label="GitHub" value={profile.github} onChange={(value) => setProfile({ ...profile, github: value })} />
                <SettingsInput icon={<Linkedin size={16} />} label="LinkedIn" value={profile.linkedin} onChange={(value) => setProfile({ ...profile, linkedin: value })} />
              </div>

              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(30,58,95,0.18)] transition hover:bg-[#172D49]"
              >
                <Save size={16} />
                Enregistrer
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange} className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1a]">Securite du compte</h2>
                <p className="mt-1 text-sm text-[#64748B]">Choisissez un mot de passe solide pour proteger votre espace.</p>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Mot de passe actuel', key: 'current' },
                  { label: 'Nouveau mot de passe', key: 'new' },
                  { label: 'Confirmer le mot de passe', key: 'confirm' },
                ].map(({ label, key }) => (
                  <label key={key} className="block text-sm font-bold text-[#334155]">
                    <span>{label}</span>
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#DCEBFA] bg-[#F8FAFC] px-4 py-3 transition focus-within:border-[#1E3A5F]/40 focus-within:ring-2 focus-within:ring-[#1E3A5F]/10">
                      <Lock size={16} className="text-[#64748B]" />
                      <input
                        type="password"
                        value={passwords[key as keyof typeof passwords]}
                        onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })}
                        className="w-full bg-transparent text-sm text-[#1a1c1a] outline-none"
                      />
                    </div>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1a1c1a] px-5 text-sm font-bold text-white transition hover:bg-[#334155]"
              >
                <Lock size={16} />
                Changer le mot de passe
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

interface ProfileLinkProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const ProfileLink: React.FC<ProfileLinkProps> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-[#F8FAFC] p-3">
    <div className="mb-2 flex items-center gap-2 text-[#1E3A5F]">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
    <p className="truncate text-xs font-semibold text-[#64748B]">{value || 'Non renseigne'}</p>
  </div>
);

interface SettingsInputProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const SettingsInput: React.FC<SettingsInputProps> = ({ icon, label, value, onChange }) => (
  <label className="block text-sm font-bold text-[#334155]">
    <span>{label}</span>
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#DCEBFA] bg-[#F8FAFC] px-4 py-3 transition focus-within:border-[#1E3A5F]/40 focus-within:ring-2 focus-within:ring-[#1E3A5F]/10">
      <span className="text-[#64748B]">{icon}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-[#1a1c1a] outline-none"
      />
    </div>
  </label>
);

export default StudentSettingsPage;
