import React, { useState } from 'react';
import { Send, Paperclip, Video, Search, Smile, CheckCheck, MoreHorizontal } from 'lucide-react';

const StudentChat: React.FC = () => {
  const [messages] = useState([
    { id: 1, sender: 'Prof. Ahmed', text: 'Bonjour l\'équipe, comment avance l\'itération 1 ?', time: '09:41', isMe: false, avatar: 'https://picsum.photos/seed/prof/100/100' },
    { id: 2, sender: 'Me', text: 'Bonjour Monsieur, nous avons presque terminé le module d\'authentification.', time: '09:45', isMe: true, avatar: 'https://picsum.photos/seed/hira/100/100' },
    { id: 3, sender: 'Anas M', text: 'J\'ai configuré Firebase ce matin, tout fonctionne bien.', time: '09:47', isMe: false, avatar: 'https://picsum.photos/seed/anas/100/100' },
    { id: 4, sender: 'Prof. Ahmed', text: 'Excellent. N\'oubliez pas de mettre à jour le Kanban et de déposer le rapport.', time: '09:50', isMe: false, avatar: 'https://picsum.photos/seed/prof/100/100' },
  ]);

  const [newMessage, setNewMessage] = useState('');

  const handleJoinVideo = () => {
    window.open('https://meet.jit.si/StudentHub_Iteration1_GroupA', '_blank');
  };

  return (
    <div className="flex h-screen bg-[#F8F9FD] font-sans antialiased text-slate-900 overflow-hidden">
      
      {/* --- Sidebar Contacts --- */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        <div className="p-8 pb-6">
          <h2 className="text-2xl font-extrabold tracking-tight mb-6">Messages</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher..."
              className="w-full bg-slate-100 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 px-3">
          {[
            { name: 'Group A - Project', lastMsg: 'Anas: J\'ai configuré Firebase...', time: '09:47', active: true, unread: 0, initial: 'G' },
            { name: 'Prof. Ahmed Alami', lastMsg: 'Excellent. N\'oubliez pas...', time: '09:50', active: false, unread: 2, initial: 'A' },
            { name: 'Sara K (Frontend)', lastMsg: 'Je termine les styles...', time: 'Hier', active: false, unread: 0, initial: 'S' },
            { name: 'Yassine B (DevOps)', lastMsg: 'Le CI/CD est prêt.', time: 'Hier', active: false, unread: 0, initial: 'Y' },
          ].map((chat, i) => (
            <div key={i} className={`p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 rounded-2xl ${
              chat.active ? 'bg-indigo-50 shadow-sm border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'
            }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-sm ${
                chat.active ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-indigo-600'
              }`}>
                {chat.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <h4 className="font-bold text-[14px] text-slate-900 truncate">{chat.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400">{chat.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate font-medium">{chat.lastMsg}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-5 h-5 bg-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-indigo-200">
                  {chat.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- Main Chat Area --- */}
      <div className="flex-1 flex flex-col bg-white">
        
        {/* Chat Header (Glassmorphism) */}
        <header className="h-24 border-b border-slate-100 px-10 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">
              G
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Group A - Project</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-400 tracking-wide">4 Membres en ligne</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleJoinVideo}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
            >
              <Video size={18} />
              Appel Vidéo
            </button>
          </div>
        </header>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-[#F8F9FD]/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
              <img src={msg.avatar} alt="" className="w-10 h-10 rounded-2xl object-cover shadow-sm ring-2 ring-white" />
              <div className={`max-w-[65%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{msg.isMe ? 'Moi' : msg.sender}</span>
                  <span className="text-[11px] font-medium text-slate-300">{msg.time}</span>
                </div>
                <div className={`px-6 py-4 shadow-sm transition-all text-[15px] leading-relaxed font-medium ${
                  msg.isMe 
                    ? 'bg-indigo-600 text-white rounded-3xl rounded-tr-none shadow-indigo-100' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-3xl rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
                {msg.isMe && (
                  <div className="mt-1.5 flex gap-1 items-center">
                    <CheckCheck size={14} className="text-indigo-500" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Lu</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative flex items-center gap-4 bg-slate-50 p-2 rounded-[2rem] border border-slate-200/50 shadow-inner">
            <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
              <Smile size={24} />
            </button>
            <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
              <Paperclip size={24} />
            </button>
            <input 
              type="text" 
              placeholder="Écrivez votre message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-slate-700 font-medium px-2"
            />
            <button className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-90">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentChat;