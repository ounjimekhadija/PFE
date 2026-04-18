import React, { useState } from 'react';
import { User, Mail, Phone, Globe, Camera, Shield, Bell, Lock, Save, Github, Linkedin } from 'lucide-react';
import { motion } from 'motion/react';

const StudentSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({
    name: 'Hira R',
    email: 'hira.r@student.hub',
    phone: '+212 6 00 00 00 00',
    website: 'portfolio.hira.com',
    github: 'github.com/hira',
    linkedin: 'linkedin.com/in/hira',
    bio: 'UI/UX Designer & Frontend Developer. Passionate about creating beautiful and functional user interfaces.',
    avatar: 'https://picsum.photos/seed/hira/150/150'
  });

  const [success, setSuccess] = useState(false);
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

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
                  <div className="relative">
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
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
              <form className="space-y-8 max-w-lg mx-auto mt-8 p-0">
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
