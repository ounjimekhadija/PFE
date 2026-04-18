import React, { useState } from 'react';
import { Search, Send, Video, MoreVertical, Paperclip, Smile, CheckCheck } from 'lucide-react';

const contacts = [
  { name: 'Group A - Project', lastMsg: "Anas: J'ai configuré Firebase...", time: '09:47', unread: 0, active: true, status: 'online' },
  { name: 'Prof. Ahmed Alami', lastMsg: "Excellent. N'oubliez pas...", time: '09:50', unread: 2, active: false, status: 'online' },
  { name: 'Sara K (Frontend)', lastMsg: 'Je termine les styles...', time: 'Hier', unread: 0, active: false, status: 'offline' },
  { name: 'Yassine B (DevOps)', lastMsg: 'Le CI/CD est prêt.', time: 'Hier', unread: 0, active: false, status: 'offline' },
];

const messages = [
  { id: 1, sender: 'prof', name: 'PROF. AHMED', time: '09:41', text: "Bonjour l'équipe, comment avance l’itération 1 ?", isMe: false },
  { id: 2, sender: 'me', name: 'MOI', time: '09:45', text: "Bonjour Monsieur, nous avons presque terminé le module d'authentification.", isMe: true },
  { id: 3, sender: 'anas', name: 'ANAS M', time: '09:47', text: "J'ai configuré Firebase ce matin, tout fonctionne bien.", isMe: false },
  { id: 4, sender: 'prof', name: 'PROF. AHMED', time: '09:50', text: "Excellent. N'oubliez pas de mettre à jour le Kanban et de déposer le rapport.", isMe: false },
];

const Chat = () => {
  const [input, setInput] = useState("");

  return (
    <div className="flex h-screen bg-[#F8F9FD] font-sans antialiased text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-96 border-r border-slate-200 bg-white flex flex-col shadow-sm z-10">
        <div className="p-8 pb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">Messages</h2>
          </div>
          
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une discussion..." 
              className="w-full bg-slate-100 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none font-medium" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {contacts.map((c, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 group ${c.active ? 'bg-indigo-50 shadow-sm border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}>
              <div className="relative shrink-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm ${c.active ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-indigo-600'}`}>
                  {c.name[0]}
                </div>
                {c.status === 'online' && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full"></span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-[15px] truncate">{c.name}</span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{c.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500 truncate pr-2 font-medium">{c.lastMsg}</p>
                  {c.unread > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-lg px-2 py-1 shadow-lg shadow-indigo-200">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-white">
        
        {/* Header - Glassmorphism */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-10 py-6 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">G</div>
            <div>
              <h3 className="font-bold text-lg leading-none mb-1.5">Group A - Project</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">4 membres actifs</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.open('https://meet.jit.si/prof-chat-room', '_blank')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl shadow-xl shadow-slate-200 flex items-center gap-2 transition-all active:scale-95"
            >
              <Video size={18} />
              <span>Lancer l'appel</span>
            </button>
          </div>
        </header>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-8 bg-[#F8F9FD]/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-[65%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{msg.name}</span>
                  <span className="text-[11px] font-medium text-slate-300">{msg.time}</span>
                </div>
                
                <div className={`px-6 py-4 shadow-sm text-[15px] leading-relaxed font-medium ${
                  msg.isMe 
                    ? 'bg-indigo-600 text-white rounded-3xl rounded-tr-none shadow-indigo-100' 
                    : 'bg-white border border-slate-100 text-slate-700 rounded-3xl rounded-tl-none'
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
              className="flex-1 bg-transparent border-none py-3 text-slate-700 focus:ring-0 outline-none font-medium placeholder:text-slate-400"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-90">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;