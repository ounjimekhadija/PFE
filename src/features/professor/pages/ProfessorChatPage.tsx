import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Video, Paperclip, Smile, CheckCheck } from 'lucide-react';
import MessageContent from '../../../shared/components/MessageContent';
import { supabase } from '../../../lib/supabase';
import { notifyProjectStudents } from '../../../lib/notifications';

interface ContactItem {
  id: string;
  name: string;
  groupName: string;
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
  isRead: boolean;
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😅','😭','🤩','🥳','👍','👎','❤️','🔥','🎉','✅','❌','🙏','💪','🤝','👏','🚀','💡','⭐','💯','🏆','📌','🎯','😊','🤗','😴','🤯'];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const getProjectMeetingUrl = (projectId: string) => {
    const roomName = `PFEspace_Project_${projectId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `https://meet.jit.si/${roomName}`;
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

  const markMessagesAsRead = async (projectId: string, myUserId: string) => {
    await supabase
      .from('messages')
      .update({ lu: true })
      .eq('projet_id', projectId)
      .neq('auteur_id', myUserId)
      .eq('lu', false);
  };

  const loadProjectMessages = async (projectId: string, myUserId: string) => {
    const { data: rows, error: rowsError } = await supabase
      .from('messages')
      .select('id, auteur_id, contenu, created_at, lu, utilisateurs(nom, prenom, avatar_url)')
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
        isRead: m.lu === true,
        avatar: resolveAvatar(u?.avatar_url, senderName),
        createdAt: m.created_at,
      };
    });

    setMessages(mapped);
    await markMessagesAsRead(projectId, myUserId);
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
            .select('id, titre, nom_groupe, created_at')
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
            name: p.titre || `Project ${idx + 1}`,
            groupName: p.nom_groupe || '',
            lastMsg: latest ? `${latestSender ? `${latestSender}: ` : ''}${latest.contenu}` : 'Aucun message pour ce projet',
            time: latest ? formatTime(latest.created_at) : '',
            unread: 0,
            active: idx === 0,
            status: 'offline',
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
        console.error('Error loading supervisor chat:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la messagerie.');
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
            .select('id, auteur_id, contenu, created_at, lu, utilisateurs(nom, prenom, avatar_url)')
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
            isRead: row.lu === true,
            avatar: resolveAvatar(u?.avatar_url, senderName),
            createdAt: row.created_at,
          };

          setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]));
          if (!mapped.isMe && currentUserId) markMessagesAsRead(selectedProjectId!, currentUserId);
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedProjectId
                ? { ...c, lastMsg: `${senderName}: ${row.contenu}`, time: formatTime(row.created_at) }
                : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `projet_id=eq.${selectedProjectId}` },
        (payload) => {
          if (payload.new.lu === true) {
            setMessages((prev) =>
              prev.map((m) => m.id === String(payload.new.id) ? { ...m, isRead: true } : m)
            );
          }
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

  const filteredMessages = messages;

  const selectedContact = contacts.find((c) => c.id === selectedProjectId) || null;
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.groupName, c.lastMsg].some((value) => value.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const onSelectProject = async (project: ContactItem) => {
    if (!currentUserId) return;
    setSelectedProjectId(project.id);
    setSelectedProjectTitle(project.name);
    setContacts((prev) => prev.map((c) => ({ ...c, active: c.id === project.id })));
    try {
      await loadProjectMessages(project.id, currentUserId);
    } catch (err) {
      console.error('Error loading project messages:', err);
      setError(err instanceof Error ? err.message : 'Error loading messages.');
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
    } else {
      // Notify students
      await notifyProjectStudents({
        projectId: selectedProjectId,
        senderId: currentUserId,
        title: 'New message',
        message: `The supervisor sent a message in "${selectedProjectTitle}".`,
        type: 'MESSAGE'
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId || !currentUserId) return;
    e.target.value = '';

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chat/${selectedProjectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const isImage = file.type.startsWith('image/');
      const contenu = isImage ? `[image]${urlData.publicUrl}` : `[file]${file.name}||${urlData.publicUrl}`;

      await supabase.from('messages').insert({
        projet_id: selectedProjectId,
        auteur_id: currentUserId,
        contenu,
        type: 'TEXTE',
      });

      // Notify students
      await notifyProjectStudents({
        projectId: selectedProjectId,
        senderId: currentUserId,
        title: 'New file',
        message: `The supervisor shared a file in "${selectedProjectTitle}".`,
        type: 'MESSAGE'
      });
    } catch (err) {
      setError('Erreur lors de l’envoi du fichier.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!selectedProjectId || !currentUserId || creatingMeeting) return;

    setCreatingMeeting(true);
    const meetUrl = getProjectMeetingUrl(selectedProjectId);
    const startedAt = new Date().toISOString();

    const { error: meetingError } = await supabase.from('reunions').insert({
      projet_id: selectedProjectId,
      titre: `Appel vidéo - ${selectedProjectTitle}`,
      date_heure: startedAt,
      duree: 60,
      lien_jitsi: meetUrl,
      ordre_du_jour: `Appel vidéo lancé par l'encadrant pour le projet "${selectedProjectTitle}".`,
      statut: 'EN_COURS',
    });

    if (meetingError) {
      console.error('Erreur création réunion:', meetingError);
      setError(meetingError.message);
      setCreatingMeeting(false);
      return;
    }

    await notifyProjectStudents({
      projectId: selectedProjectId,
      senderId: currentUserId,
      title: 'Nouvel appel vidéo',
      message: `L'encadrant a lancé un appel vidéo pour "${selectedProjectTitle}". Lien: ${meetUrl}`,
      type: 'MEETING_REQUEST'
    });

    window.open(meetUrl, '_blank');
    setCreatingMeeting(false);
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#F8FAFC] antialiased text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Sidebar */}
      <div className="z-10 flex w-80 flex-col border-r border-[#C8D6E5]/60 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="p-6 pb-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">Messages</h2>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Rechercher une discussion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#EEF3F8] py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:border-[#1E3A5F]/25 focus:ring-2 focus:ring-[#1E3A5F]/15"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {loading && <div className="px-4 py-2 text-sm text-[#64748B]">Chargement des discussions...</div>}
          {!loading && filteredContacts.length === 0 && <div className="px-4 py-2 text-sm text-[#64748B]">Aucune discussion trouvée.</div>}
          {filteredContacts.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectProject(c)}
              className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                c.active
                  ? 'bg-[#1E3A5F]/8 shadow-sm border border-[#1E3A5F]/20'
                  : 'hover:bg-[#EEF3F8] border border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-sm ${
                  c.active ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-[#C8D6E5] text-[#1E3A5F]'
                }`}>
                  {(c.groupName || c.name)[0]}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-[15px] truncate">{c.groupName || c.name}</span>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase">{c.time}</span>
                </div>
                {c.groupName && (
                  <p className="text-[11px] text-[#1E3A5F] font-semibold truncate mb-0.5">{c.name}</p>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#64748B] truncate pr-2 font-medium">{c.lastMsg}</p>
                  {c.unread > 0 && (
                    <span className="bg-[#1E3A5F] text-white text-[10px] font-bold rounded-lg px-2 py-1 shadow-sm">
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
      <div className="flex-1 flex flex-col relative bg-white" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#C8D6E5]/60 bg-white/85 px-8 py-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#1E3A5F] flex items-center justify-center text-white font-bold text-lg shadow-sm">G</div>
            <div>
              <h3 className="font-bold text-lg leading-none mb-1.5">{selectedProjectTitle}</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1E3A5F]"></span>
                </span>
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">{selectedContact?.membersCount || 0} membres</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleCreateMeeting}
              disabled={!selectedProjectId || creatingMeeting}
              aria-label="Créer un appel vidéo"
              title="Créer un appel vidéo"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E3A5F] text-white shadow-sm ring-1 ring-[#DCEBFA]/40 transition-all hover:bg-[#172D49] active:scale-95 disabled:opacity-40"
            >
              <Video size={22} strokeWidth={2.4} className="shrink-0" />
            </button>
          </div>
        </header>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-8 bg-[#F8FAFC]/50">
          {error && <div className="text-sm text-[#ba1a1a]">Erreur : {error}</div>}
          {!loading && !selectedProjectId && <div className="text-sm text-[#64748B]">Aucun projet assigné à cet encadrant.</div>}
          {!loading && selectedProjectId && messages.length === 0 && <div className="text-sm text-[#64748B]">Aucun message pour ce projet.</div>}
          {filteredMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-[65%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest">{msg.name}</span>
                  <span className="text-[11px] font-medium text-[#C8D6E5]">{msg.time}</span>
                </div>

                <div className={`flex items-end gap-3 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img
                    src={msg.avatar}
                    alt={msg.name}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                  <div className={`shadow-sm text-[15px] leading-relaxed font-medium overflow-hidden ${
                    msg.isMe
                      ? 'bg-[#1E3A5F] text-white rounded-2xl rounded-tr-sm'
                      : 'bg-white border border-[#C8D6E5] text-[#334155] rounded-2xl rounded-tl-sm'
                  }`}>
                    <div className="px-6 py-4">
                      <MessageContent text={msg.text} />
                    </div>
                  </div>
                </div>

                {msg.isMe && msg.isRead && (
                  <div className="mt-1.5 flex gap-1 items-center">
                    <CheckCheck size={14} className="text-[#1E3A5F]" />
                    <span className="text-[10px] text-[#64748B] font-bold uppercase">Lu</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white px-6 py-3">
          <div className="max-w-4xl mx-auto relative flex items-center gap-3">


            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                  showEmoji ? 'bg-[#DCEBFA] text-[#1E3A5F]' : 'text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#1E3A5F]'
                }`}
                aria-label="Ajouter un emoji"
                title="Ajouter un emoji"
              >
                <Smile size={22} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-14 left-0 z-30 w-72 rounded-2xl border border-[#EEF3F8] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.15)]">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => { setInput((v) => v + em); setShowEmoji(false); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-[#EEF3F8]"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#64748B] transition-colors hover:bg-[#EEF3F8] hover:text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Joindre un fichier"
              title="Joindre un fichier"
            >
              {uploading ? <span className="text-xs font-bold text-[#1E3A5F]">...</span> : <Paperclip size={22} />}
            </button>

            <button
              type="button"
              onClick={handleCreateMeeting}
              disabled={!selectedProjectId || !currentUserId || creatingMeeting}
              aria-label="Créer un appel vidéo"
              title="Créer un appel vidéo"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3A5F] text-white transition-all hover:bg-[#172D49] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Video size={20} />
            </button>

            <input
              type="text"
              placeholder="Écrivez votre message..."
              className="h-12 flex-1 rounded-2xl border border-[#C8D6E5] bg-[#EEF3F8] px-5 text-[#334155] outline-none font-medium placeholder:text-[#64748B] focus:border-[#1E3A5F]/30 focus:ring-2 focus:ring-[#1E3A5F]/10"
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
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3A5F] text-white transition-all hover:bg-[#172D49] active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
