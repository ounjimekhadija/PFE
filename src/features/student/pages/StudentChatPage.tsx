import React, { useState, useEffect, useRef } from 'react';
import { Send, Video, Search, Smile, CheckCheck, Users, Crown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Message {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  time: string;
  isMe: boolean;
  isRead: boolean;
  avatar: string;
  created_at: string;
}

interface Member {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
  role?: string;
  email?: string;
}

const StudentChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('Mon Groupe');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [supervisor, setSupervisor] = useState<Member | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const initChat = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        setCurrentUserId(session.user.id);

        const { data: etudiant } = await supabase
          .from('etudiants')
          .select('projet_id')
          .eq('id', session.user.id)
          .single();

        if (etudiant?.projet_id) {
          setProjectId(etudiant.projet_id);

          const { data: projet } = await supabase
            .from('projets')
            .select('titre, encadrant_id')
            .eq('id', etudiant.projet_id)
            .single();

          if (projet) {
            setProjectTitle(projet.titre);

            if (projet.encadrant_id) {
              const { data: supData } = await supabase
                .from('utilisateurs')
                .select('id, nom, prenom, avatar_url, role, email')
                .eq('id', projet.encadrant_id)
                .single();

              if (supData) setSupervisor(supData as Member);
            }
          }

          const { data: etudiantList } = await supabase
            .from('etudiants')
            .select('id, utilisateurs(id, nom, prenom, avatar_url, role, email)')
            .eq('projet_id', etudiant.projet_id);

          if (etudiantList) {
            const formattedMembers = etudiantList
              .map((e: any) => {
                let u = Array.isArray(e.utilisateurs) ? e.utilisateurs[0] : e.utilisateurs;
                if (!u) return null;
                return { ...u, id: e.id };
              })
              .filter(Boolean) as Member[];
            setMembers(formattedMembers);
          }

          fetchMessages(etudiant.projet_id, session.user.id);
          setupRealtimeSubscription(etudiant.projet_id, session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error init chat:', err);
        setLoading(false);
      }
    };

    initChat();

    return () => { supabase.removeAllChannels(); };
  }, []);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const markMessagesAsRead = async (projId: string, myUserId: string) => {
    await supabase
      .from('messages')
      .update({ lu: true })
      .eq('projet_id', projId)
      .neq('auteur_id', myUserId)
      .eq('lu', false);
  };

  const fetchMessages = async (projId: string, currentUserId: string) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, utilisateurs(nom, prenom, avatar_url)')
      .eq('projet_id', projId)
      .order('created_at', { ascending: true });

    if (msgs) {
      const formattedMsgs = msgs.map((m: any) => ({
        id: m.id,
        senderId: m.auteur_id,
        senderName: m.utilisateurs ? `${m.utilisateurs.prenom} ${m.utilisateurs.nom}` : 'Inconnu',
        text: m.contenu,
        time: formatTime(m.created_at),
        isMe: m.auteur_id === currentUserId,
        isRead: m.lu === true,
        avatar: m.utilisateurs?.avatar_url || `https://ui-avatars.com/api/?name=${m.utilisateurs?.prenom}+${m.utilisateurs?.nom}&background=random`,
        created_at: m.created_at
      }));
      setMessages(formattedMsgs);
    }
    setLoading(false);
    await markMessagesAsRead(projId, currentUserId);
  };

  const setupRealtimeSubscription = (projId: string, myUserId: string) => {
    supabase
      .channel(`chat_${projId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `projet_id=eq.${projId}` }, async (payload) => {
        const { data: newMsgData } = await supabase
          .from('messages')
          .select('*, utilisateurs(nom, prenom, avatar_url)')
          .eq('id', payload.new.id)
          .single();

        if (newMsgData) {
          const isMe = newMsgData.auteur_id === myUserId;
          setMessages((prev) => {
            if (prev.some(p => p.id === newMsgData.id)) return prev;
            return [...prev, {
              id: newMsgData.id,
              senderId: newMsgData.auteur_id,
              senderName: newMsgData.utilisateurs ? `${newMsgData.utilisateurs.prenom} ${newMsgData.utilisateurs.nom}` : 'Inconnu',
              text: newMsgData.contenu,
              time: formatTime(newMsgData.created_at),
              isMe,
              isRead: newMsgData.lu === true,
              avatar: newMsgData.utilisateurs?.avatar_url || `https://ui-avatars.com/api/?name=${newMsgData.utilisateurs?.prenom}+${newMsgData.utilisateurs?.nom}&background=random`,
              created_at: newMsgData.created_at
            }];
          });
          if (!isMe) markMessagesAsRead(projId, myUserId);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `projet_id=eq.${projId}` }, (payload) => {
        if (payload.new.lu === true) {
          setMessages((prev) =>
            prev.map((m) => m.id === String(payload.new.id) ? { ...m, isRead: true } : m)
          );
        }
      })
      .subscribe();
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !projectId || !currentUserId) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      projet_id: projectId,
      auteur_id: currentUserId,
      contenu: messageText,
      type: 'TEXTE'
    });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
    }
  };

  const handleJoinVideo = () => {
    if (projectId) window.open(`https://meet.jit.si/StudentHub_Project_${projectId}`, '_blank');
  };

  const emojis = ['😀', '😂', '😍', '😊', '👍', '👏', '🙏', '🔥', '🎉', '✅', '😅', '😎', '🤝', '💡', '🚀', '📌'];

  const handleEmojiClick = (emoji: string) => {
    setNewMessage((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center bg-[#faf9f6] text-sm font-medium text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>Chargement du chat...</div>;
  }

  if (!projectId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#faf9f6] p-8 text-center font-bold text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
        Vous n'êtes assigné à aucun projet. Veuillez d'abord rejoindre ou créer un groupe.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-[#faf9f6] antialiased text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Left Sidebar */}
      <div className="shrink-0 w-80 border-r border-transparent bg-white shadow-sm hidden md:flex md:flex-col h-full">
        <div className="p-8 pb-6">
          <h2 className="text-2xl font-extrabold tracking-tight mb-6">Messages</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f7664]" size={18} />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full bg-[#f4f3f1] border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#765b00]/20 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-8">
          <div>
            <h3 className="px-7 text-xs font-bold text-[#7f7664] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="bg-[#ffd464]/50 p-1.5 rounded-lg text-[#765b00]"><Crown size={14} /></span>
              Encadrant
            </h3>
            {supervisor ? (
              <div className="mx-4 px-3 py-2 flex items-center gap-3 bg-white rounded-xl hover:bg-[#f4f3f1] transition-colors border border-transparent hover:border-transparent cursor-pointer group">
                <img
                  src={supervisor.avatar_url || `https://ui-avatars.com/api/?name=${supervisor.prenom}+${supervisor.nom}&background=random`}
                  alt="Encadrant"
                  className="w-10 h-10 rounded-xl object-cover shadow-sm border border-transparent bg-white group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1a1c1a] truncate">{supervisor.prenom} {supervisor.nom}</p>
                  <p className="text-xs text-[#765b00] font-bold truncate">Superviseur</p>
                </div>
              </div>
            ) : (
              <div className="mx-7 py-2 text-xs text-[#7f7664] font-medium italic">Aucun encadrant assigné</div>
            )}
          </div>

          <div>
            <h3 className="px-7 text-xs font-bold text-[#7f7664] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="bg-[#ffd464]/30 p-1.5 rounded-lg text-[#765b00]"><Users size={14} /></span>
              Membres ({members.length})
            </h3>
            <div className="space-y-1 mx-4">
              {members.map(member => (
                <div key={member.id} className="px-3 py-2.5 flex items-center gap-3 bg-white rounded-xl hover:bg-[#f4f3f1] transition-colors border border-transparent hover:border-transparent cursor-pointer group">
                  <img
                    src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.prenom}+${member.nom}&background=random`}
                    alt="Membre"
                    className="w-10 h-10 rounded-xl object-cover shadow-sm border border-transparent bg-white group-hover:scale-105 transition-transform"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1a1c1a] truncate flex items-center gap-2">
                      {member.prenom} {member.nom}
                      {member.id === currentUserId && (
                        <span className="text-[10px] font-extrabold text-[#594400] bg-[#ffd464] px-1.5 py-0.5 rounded tracking-wide uppercase">Moi</span>
                      )}
                    </p>
                    <p className="text-xs text-[#7f7664] font-medium truncate">Étudiant(e)</p>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-3 py-2 text-xs text-[#7f7664] font-medium italic">Aucun membre trouvé</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        <header className="h-24 border-b border-transparent px-6 md:px-10 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 w-full">
          <div className="flex items-center gap-4 cursor-pointer md:cursor-default">
            <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-2xl bg-[#765b00] flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {projectTitle.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-[#1a1c1a] text-base md:text-lg truncate max-w-[200px] md:max-w-xs">{projectTitle}</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-[#7f7664] tracking-wider uppercase">En ligne</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleJoinVideo}
              className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-[#1a1c1a] text-white rounded-2xl text-xs md:text-sm font-bold hover:bg-[#4d4636] transition-all shadow-sm active:scale-95"
            >
              <Video size={18} />
              <span className="hidden md:inline">Appel Vidéo</span>
            </button>
          </div>
        </header>

        <div className="chat-messages flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 bg-[#faf9f6]/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 md:gap-4 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
              <img src={msg.avatar} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-2xl object-cover shadow-sm ring-white ring-2" />
              <div className={`max-w-[85%] md:max-w-[65%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-[10px] md:text-[11px] font-bold text-[#7f7664] uppercase tracking-widest">{msg.isMe ? 'Moi' : msg.senderName}</span>
                  <span className="text-[10px] md:text-[11px] font-medium text-[#d1c5b0]">{msg.time}</span>
                </div>
                <div className={`px-5 py-3 md:px-6 md:py-4 shadow-sm transition-all text-[14px] md:text-[15px] leading-relaxed font-medium break-words ${
                  msg.isMe
                    ? 'bg-[#765b00] text-white rounded-3xl rounded-tr-none'
                    : 'bg-white text-[#4d4636] border border-transparent rounded-3xl rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
                {msg.isMe && msg.isRead && (
                  <div className="mt-1.5 flex gap-1 items-center">
                    <CheckCheck size={14} className="text-[#765b00]" />
                    <span className="text-[10px] text-[#7f7664] font-bold uppercase">Lu</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 md:p-8 bg-white border-t border-transparent w-full">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center gap-2 md:gap-4 bg-[#f4f3f1] p-2 rounded-[2rem] border border-transparent shadow-inner">
            <div className="relative hidden md:block">
              <button
                type="button"
                className="p-2 md:p-3 text-[#7f7664] hover:text-[#765b00] transition-colors"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                aria-label="Open emoji picker"
              >
              <Smile size={24} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-0 z-20 w-56 rounded-2xl border border-transparent bg-white p-3 shadow-xl">
                  <div className="grid grid-cols-8 gap-2">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="h-8 w-8 rounded-xl hover:bg-[#fff4cc] text-lg"
                        onClick={() => handleEmojiClick(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Écrivez votre message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-[#4d4636] font-medium px-4 text-sm md:text-base"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-[#765b00] text-white p-3 md:p-4 rounded-2xl hover:bg-[#594400] transition-all shadow-sm active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} className="md:w-5 md:h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentChat;
