import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Video, Paperclip, Smile, CheckCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface ContactItem {
  id: string;
  name: string;
  lastMsg: string;
  time: string;
  unread: number;
  active: boolean;
  status: 'online' | 'offline';
  membersCount: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  name: string;
  time: string;
  text: string;
  isMe: boolean;
  avatar: string;
  createdAt: string;
}

const Chat: React.FC = () => {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTitle, setSelectedProjectTitle] = useState('Projet');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const resolveAvatar = (value: string | null | undefined, fallbackName: string): string => {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;
    if (!value) return fallback;

    let raw = value.trim();
    if (!raw) return fallback;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    raw = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
    const { data } = supabase.storage.from('avatars').getPublicUrl(raw);
    return data?.publicUrl || fallback;
  };

  const fetchProfessorProjectIds = async (authUserId: string): Promise<string[]> => {
    const projectIdSet = new Set<string>();

    const { data: directRows, error: directError } = await supabase
      .from('projets')
      .select('id')
      .eq('encadrant_id', authUserId);

    if (directError) throw directError;
    (directRows || []).forEach((row: any) => {
      if (row?.id) projectIdSet.add(String(row.id));
    });

    if (projectIdSet.size > 0) {
      return Array.from(projectIdSet);
    }

    const encadrantIdCandidates = new Set<string>();
    const { data: encById } = await supabase
      .from('encadrants')
      .select('id')
      .eq('id', authUserId)
      .limit(1);

    (encById || []).forEach((row: any) => {
      if (row?.id) encadrantIdCandidates.add(String(row.id));
    });

    const mappingColumns = ['utilisateur_id', 'user_id', 'auth_user_id'];
    for (const column of mappingColumns) {
      const { data } = await supabase
        .from('encadrants')
        .select('id')
        .eq(column, authUserId)
        .limit(1);

      (data || []).forEach((row: any) => {
        if (row?.id) encadrantIdCandidates.add(String(row.id));
      });
    }

    if (encadrantIdCandidates.size === 0) {
      return [];
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('projets')
      .select('id')
      .in('encadrant_id', Array.from(encadrantIdCandidates));

    if (fallbackError) throw fallbackError;
    (fallbackRows || []).forEach((row: any) => {
      if (row?.id) projectIdSet.add(String(row.id));
    });

    return Array.from(projectIdSet);
  };

  const loadProjectMessages = async (projectId: string, myUserId: string) => {
    const { data: rows, error: rowsError } = await supabase
      .from('messages')
      .select('id, auteur_id, contenu, created_at, utilisateurs(nom, prenom, avatar_url)')
      .eq('projet_id', projectId)
      .order('created_at', { ascending: true });

    if (rowsError) throw rowsError;

    const mapped: ChatMessage[] = (rows || []).map((m: any) => {
      const u = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
      const senderName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
      return {
        id: String(m.id),
        senderId: String(m.auteur_id),
        name: m.auteur_id === myUserId ? 'MOI' : senderName.toUpperCase(),
        time: formatTime(m.created_at),
        text: m.contenu,
        isMe: m.auteur_id === myUserId,
        avatar: resolveAvatar(u?.avatar_url, senderName),
        createdAt: m.created_at,
      };
    });

    setMessages(mapped);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setContacts([]);
          return;
        }

        setCurrentUserId(user.id);

        const projectIds = await fetchProfessorProjectIds(user.id);
        if (projectIds.length === 0) {
          setContacts([]);
          setSelectedProjectId(null);
          setMessages([]);
          return;
        }

        const [{ data: projectRows, error: projectError }, { data: messageRows, error: messageError }, { data: memberRows, error: memberError }] = await Promise.all([
          supabase
            .from('projets')
            .select('id, titre, created_at')
            .in('id', projectIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('messages')
            .select('id, projet_id, auteur_id, contenu, created_at, utilisateurs(nom, prenom)')
            .in('projet_id', projectIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('etudiants')
            .select('id, projet_id')
            .in('projet_id', projectIds),
        ]);

        if (projectError) throw projectError;
        if (messageError) throw messageError;
        if (memberError) throw memberError;

        const membersCountByProject: Record<string, number> = {};
        (memberRows || []).forEach((row: any) => {
          const key = String(row.projet_id);
          membersCountByProject[key] = (membersCountByProject[key] || 0) + 1;
        });

        const latestMessageByProject: Record<string, any> = {};
        (messageRows || []).forEach((m: any) => {
          const key = String(m.projet_id);
          if (!latestMessageByProject[key]) {
            latestMessageByProject[key] = m;
          }
        });

        const contactList: ContactItem[] = (projectRows || []).map((p: any, idx: number) => {
          const latest = latestMessageByProject[String(p.id)];
          const u = latest ? (Array.isArray(latest.utilisateurs) ? latest.utilisateurs[0] : latest.utilisateurs) : null;
          const latestSender = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '';

          return {
            id: String(p.id),
            name: p.titre || `Projet ${idx + 1}`,
            lastMsg: latest ? `${latestSender ? `${latestSender}: ` : ''}${latest.contenu}` : 'Aucun message pour ce projet',
            time: latest ? formatTime(latest.created_at) : '',
            unread: 0,
            active: idx === 0,
            status: 'online',
            membersCount: membersCountByProject[String(p.id)] || 0,
          };
        });

        setContacts(contactList);

        const first = contactList[0];
        if (first) {
          setSelectedProjectId(first.id);
          setSelectedProjectTitle(first.name);
          await loadProjectMessages(first.id, user.id);
        } else {
          setSelectedProjectId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error('Erreur chargement chat encadrant:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement du chat.');
        setContacts([]);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedProjectId || !currentUserId) return;

    const channel = supabase
      .channel(`prof_chat_${selectedProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `projet_id=eq.${selectedProjectId}`,
        },
        async (payload) => {
          const { data: row } = await supabase
            .from('messages')
            .select('id, auteur_id, contenu, created_at, utilisateurs(nom, prenom, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (!row) return;

          const u = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;
          const senderName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
          const mapped: ChatMessage = {
            id: String(row.id),
            senderId: String(row.auteur_id),
            name: row.auteur_id === currentUserId ? 'MOI' : senderName.toUpperCase(),
            time: formatTime(row.created_at),
            text: row.contenu,
            isMe: row.auteur_id === currentUserId,
            avatar: resolveAvatar(u?.avatar_url, senderName),
            createdAt: row.created_at,
          };

          setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]));
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedProjectId
                ? { ...c, lastMsg: `${senderName}: ${row.contenu}`, time: formatTime(row.created_at) }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProjectId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, search]);

  const selectedContact = contacts.find((c) => c.id === selectedProjectId) || null;

  const onSelectProject = async (project: ContactItem) => {
    if (!currentUserId) return;
    setSelectedProjectId(project.id);
    setSelectedProjectTitle(project.name);
    setContacts((prev) => prev.map((c) => ({ ...c, active: c.id === project.id })));
    try {
      await loadProjectMessages(project.id, currentUserId);
    } catch (err) {
      console.error('Erreur chargement messages projet:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement des messages.');
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !selectedProjectId || !currentUserId) return;

    setInput('');

    const { error: sendError } = await supabase.from('messages').insert({
      projet_id: selectedProjectId,
      auteur_id: currentUserId,
      contenu: content,
      type: 'TEXTE',
    });

    if (sendError) {
      console.error('Erreur envoi message:', sendError);
      setInput(content);
      setError(sendError.message);
    }
  };

  const handleJoinCall = () => {
    if (!selectedProjectId) return;
    window.open(`https://meet.jit.si/Encadrant_Project_${selectedProjectId}`, '_blank');
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#faf9f6] antialiased text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Sidebar */}
      <div className="z-10 flex w-96 flex-col border-r border-[#d1c5b0] bg-white shadow-sm">
        <div className="p-8 pb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">Messages</h2>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f7664]" />
            <input
              type="text"
              placeholder="Rechercher une discussion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#f4f3f1] border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#765b00]/20 transition-all outline-none font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {loading && <div className="px-4 py-2 text-sm text-[#7f7664]">Chargement des discussions...</div>}
          {!loading && filteredContacts.length === 0 && <div className="px-4 py-2 text-sm text-[#7f7664]">Aucune discussion trouvée.</div>}
          {filteredContacts.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectProject(c)}
              className={`w-full text-left flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 group ${
                c.active
                  ? 'bg-[#ffd464]/30 shadow-sm border border-[#ebc254]'
                  : 'hover:bg-[#f4f3f1] border border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm ${
                  c.active ? 'bg-[#765b00] text-white' : 'bg-white border border-[#d1c5b0] text-[#765b00]'
                }`}>
                  {c.name[0]}
                </div>
                {c.status === 'online' && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full"></span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-[15px] truncate">{c.name}</span>
                  <span className="text-[11px] font-bold text-[#7f7664] uppercase">{c.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#7f7664] truncate pr-2 font-medium">{c.lastMsg}</p>
                  {c.unread > 0 && (
                    <span className="bg-[#765b00] text-white text-[10px] font-bold rounded-lg px-2 py-1 shadow-sm">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-white">

        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-10 py-6 bg-white/80 backdrop-blur-md border-b border-[#d1c5b0]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#765b00] flex items-center justify-center text-white font-bold text-xl shadow-sm">G</div>
            <div>
              <h3 className="font-bold text-lg leading-none mb-1.5">{selectedProjectTitle}</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-[#7f7664] uppercase tracking-wide">{selectedContact?.membersCount || 0} membres actifs</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleJoinCall}
              disabled={!selectedProjectId}
              className="bg-[#1a1c1a] hover:bg-[#4d4636] text-white font-bold px-6 py-3 rounded-2xl shadow-sm flex items-center gap-2 transition-all active:scale-95"
            >
              <Video size={18} />
              <span>Lancer l'appel</span>
            </button>
          </div>
        </header>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-8 bg-[#faf9f6]/50">
          {error && <div className="text-sm text-[#ba1a1a]">Erreur: {error}</div>}
          {!loading && !selectedProjectId && <div className="text-sm text-[#7f7664]">Aucun projet assigné à cet encadrant.</div>}
          {!loading && selectedProjectId && messages.length === 0 && <div className="text-sm text-[#7f7664]">Aucun message pour ce projet.</div>}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-[65%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-bold text-[#7f7664] uppercase tracking-widest">{msg.name}</span>
                  <span className="text-[11px] font-medium text-[#d1c5b0]">{msg.time}</span>
                </div>

                <div className={`px-6 py-4 shadow-sm text-[15px] leading-relaxed font-medium ${
                  msg.isMe
                    ? 'bg-[#765b00] text-white rounded-3xl rounded-tr-none'
                    : 'bg-white border border-[#d1c5b0] text-[#4d4636] rounded-3xl rounded-tl-none'
                }`}>
                  {msg.text}
                </div>

                {msg.isMe && (
                  <div className="mt-1.5 flex gap-1 items-center">
                    <CheckCheck size={14} className="text-[#765b00]" />
                    <span className="text-[10px] text-[#7f7664] font-bold uppercase">Lu</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 bg-white border-t border-[#d1c5b0]">
          <div className="max-w-4xl mx-auto relative flex items-center gap-4 bg-[#f4f3f1] p-2 rounded-[2rem] border border-[#d1c5b0] shadow-inner">
            <button className="p-3 text-[#7f7664] hover:text-[#765b00] transition-colors">
              <Smile size={24} />
            </button>

            <button className="p-3 text-[#7f7664] hover:text-[#765b00] transition-colors">
              <Paperclip size={24} />
            </button>

            <input
              type="text"
              placeholder="Écrivez votre message..."
              className="flex-1 bg-transparent border-none py-3 text-[#4d4636] focus:ring-0 outline-none font-medium placeholder:text-[#7f7664]"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedProjectId || !currentUserId}
              className="bg-[#765b00] hover:bg-[#594400] text-white p-4 rounded-2xl shadow-sm transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
