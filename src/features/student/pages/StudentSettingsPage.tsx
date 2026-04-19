import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Globe, Camera, Shield, Bell, Lock, Save, Github, Linkedin } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

const StudentSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({
    name: 'Chargement...',
    email: 'chargement@hub.student',
    phone: '',
    website: '',
    github: '',
    linkedin: '',
    bio: '',
    avatar: 'https://ui-avatars.com/api/?name=User&background=random'
  });

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const filePath = `${fileName}`;

      // 1. Upload au bucket avatars
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Mettre à jour l'utilisateur
      const { error: updateError } = await supabase
        .from('utilisateurs')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      // 4. Mettre à jour l'interface
      setProfile(prev => ({ ...prev, avatar: publicUrl }));

    } catch (error: any) {
      console.error('Erreur upload avatar:', error);
      alert('Erreur lors du téléchargement de la photo : ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
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
          bio: user.bio || '',
          avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${user.prenom}+${user.nom}&background=random`
        });
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, []);

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
        .update({
          portfolio_url: profile.website,
          github_url: profile.github,
          linkedin_url: profile.linkedin
        })
        .eq('id', session.user.id);

      if (studentError) throw studentError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde: " + error.message);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });
      
      if (error) throw error;
      
      setPasswords({ current: '', new: '', confirm: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (error: any) {
      alert("Erreur lors du changement de mot de passe: " + error.message);
    }
  };

  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  if (loading) {
    return <div className="flex-1 bg-white text-gray-900 p-8 flex items-center justify-center font-semibold text-gray-500">Chargement des données...</div>;
  }

  return (
    <div className="flex-1 bg-white text-gray-900 p-8 overflow-y-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-400 mt-2">Manage your account settings and profile information</p>
      </header>

      <div className="max-w-4xl">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Settings Menu */}
          <div className="w-full md:w-64 space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Edit Profile' },
              { id: 'security', icon: Shield, label: 'Security' },
            ].map((item) => (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  activeTab === item.id
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {success && (
              <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-900 px-8 py-3 rounded-2xl shadow-lg font-semibold text-base z-50 flex items-center gap-2 min-w-[320px] justify-center animate-fade-in">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M20 6L9.5 17L4 11.5"/></svg>
                <span>Changes saved successfully!</span>
              </div>
            )}
            {activeTab === 'profile' && (
              <form onSubmit={handleSave} className="space-y-10">
                {/* Profile Header Modern */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-8">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className={`w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl transition-all ${uploadingAvatar ? 'opacity-50' : 'group-hover:opacity-75'}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Camera className="text-white w-8 h-8" />
                    </div>
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAvatarUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                  <div className="flex flex-col items-center sm:items-start gap-1">
                    <span className="text-2xl font-bold text-gray-800">{profile.name}</span>
                    <span className="text-base text-gray-500">{profile.email}</span>
                  </div>
                </div>

                {/* Champs en deux colonnes modernes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Phone Number</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-base focus:outline-none focus:border-orange-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Website</label>
                    <input
                      type="text"
                      value={profile.website}
                      onChange={e => setProfile({ ...profile, website: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-base focus:outline-none focus:border-orange-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">GitHub</label>
                    <input
                      type="text"
                      value={profile.github}
                      onChange={e => setProfile({ ...profile, github: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-base focus:outline-none focus:border-orange-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">LinkedIn</label>
                    <input
                      type="text"
                      value={profile.linkedin}
                      onChange={e => setProfile({ ...profile, linkedin: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-base focus:outline-none focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>



                <div className="flex justify-center pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] text-lg"
                  >
                    <Save size={22} />
                    Save Changes
                  </button>
                </div>
              </form>
            )}
            {activeTab === 'security' && (
              <form onSubmit={handlePasswordChange} className="space-y-8 max-w-lg mx-auto mt-8 p-0">
                <h2 className="text-xl font-bold mb-6">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 ml-1">Current Password</label>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-gray-200 py-3 px-0 text-base focus:outline-none focus:border-b-2 focus:border-blue-400 transition-all shadow-none rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 ml-1">New Password</label>
                    <input
                      type="password"
                      value={passwords.new}
                      onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-gray-200 py-3 px-0 text-base focus:outline-none focus:border-b-2 focus:border-blue-400 transition-all shadow-none rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 ml-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwords.confirm}
                      onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-gray-200 py-3 px-0 text-base focus:outline-none focus:border-b-2 focus:border-blue-400 transition-all shadow-none rounded-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                  >
                    <Save size={20} />
                    Change Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSettingsPage;
