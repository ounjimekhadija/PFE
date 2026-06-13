import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Video, Paperclip, Smile, CheckCheck } from 'lucide-react';
import MessageContent from '../../../shared/components/MessageContent';
import { supabase } from '../../../lib/supabase';
import { notifyProjectStudents, notifyProjectProfessor } from '../../../lib/notifications';

interface ContactItem {
  id: string;
  name: string;
  groupName?: string;
  lastMsg: string;
  time: string;
  unread: number;
  active: boolean;
  status: 'online' | 'offline';
  role?: 'professor' | 'student'; // Added role
  avatar_url?: string; // Added avatar_url
}

interface ReunionItem {
  id: string;
  titre: string;
  dateHeure: string;
  duree: number | null;
  lienJitsi: string | null;
  ordreDuJour: string | null;
  statut: string | null;
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

const StudentChat: React.FC = () => {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState('');
  const [projectTitle, setProjectTitle] = useState('Discussion');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectMeetings, setProjectMeetings] = useState<ReunionItem[]>([]);
  const [supervisorName, setSupervisorName] = useState('Supervisor');
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '😭', '🤩', '🥳', '👍', '👎', '❤️', '🔥', '🎉', '✅', '❌', '🙏', '💪', '🤝', '👏', '🚀', '💡', '⭐', '💯', '🏆', '📌', '🎯', '😊', '🤗', '😴', '🤯'];

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

  const getProjectMeetingUrl = (activeProjectId: string) => {
    const roomName = `PFEspace_Project_${activeProjectId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `https://meet.jit.si/${roomName}`;
  };

  const mapMeeting = (meeting: any): ReunionItem => ({
    id: String(meeting.id),
    titre: meeting.titre || 'Réunion',
    dateHeure: meeting.date_heure || '',
    duree: meeting.duree ?? null,
    lienJitsi: meeting.lien_jitsi || null,
    ordreDuJour: meeting.ordre_du_jour || null,
    statut: meeting.statut || null,
  });

  const loadProjectMeetings = async (activeProjectId: string) => {
    const { data, error: meetingsError } = await supabase
      .from('reunions')
      .select('id, titre, date_heure, duree, lien_jitsi, ordre_du_jour, statut')
      .eq('projet_id', activeProjectId)
      .order('date_heure', { ascending: true });

    if (meetingsError) throw meetingsError;
    setProjectMeetings((data || []).map(mapMeeting));
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Utilisateur non trouvé');
          return;
        }

        setCurrentUserId(user.id);

        const { data: student, error: studentError } = await supabase
          .from('etudiants')
          .select('projet_id')
          .eq('id', user.id)
          .single();

        if (studentError || !student?.projet_id) {
          setError('Projet non trouvé');
          return;
        }

        setProjectId(student.projet_id);

        const { data: project, error: projectError } = await supabase
          .from('projets')
          .select('encadrant_id, titre, nom_groupe')
          .eq('id', student.projet_id)
          .single();

        if (projectError || !project?.encadrant_id) {
          setError('Supervisor not found');
          return;
        }

        const { data: professor, error: professorError } = await supabase
          .from('utilisateurs')
          .select('id, nom, prenom, avatar_url')
          .eq('id', project.encadrant_id)
          .single();

        if (professorError || !professor) {
          setError('Supervisor details not found');
          return;
        }

        const professorName = `${professor.prenom} ${professor.nom}`;
        setSupervisorName(professorName);
        setProjectTitle(project?.titre || 'Discussion');
        const contact: ContactItem = {
          id: professor.id,
          name: professorName,
          groupName: project?.nom_groupe || project?.titre || '',
          lastMsg: 'Loading project messages...',
          time: '',
          unread: 0,
          active: true,
          status: 'online',
          role: 'professor',
          avatar_url: professor.avatar_url
        };

        const initialContacts: ContactItem[] = [contact];

        const { data: projectStudents, error: projectStudentsError } = await supabase
          .from('etudiants')
          .select('id, utilisateurs(nom, prenom, avatar_url)')
          .eq('projet_id', student.projet_id)
          .neq('id', user.id);

        if (projectStudentsError) throw projectStudentsError;

        if (projectStudents) {
          projectStudents.forEach((projStudent: any) => {
            const studentUser = Array.isArray(projStudent.utilisateurs) ? projStudent.utilisateurs[0] : projStudent.utilisateurs;
            if (studentUser) {
              const studentName = `${studentUser.prenom || ''} ${studentUser.nom || ''}`.trim();
              initialContacts.push({
                id: projStudent.id,
                name: studentName,
                groupName: project?.nom_groupe || project?.titre || '',
                lastMsg: 'Loading project messages...',
                time: '',
                unread: 0,
                active: false,
                status: 'offline',
                role: 'student',
                avatar_url: studentUser.avatar_url
              });
            }
          });
        }

        setContacts(initialContacts);
        setSelectedContactId(professor.id);
        setSelectedContactName(professorName);

        const [{ data: members }, { data: meetings }] = await Promise.all([
          supabase.from('etudiants').select('id').eq('projet_id', student.projet_id),
          supabase
            .from('reunions')
            .select('id, titre, date_heure, duree, lien_jitsi, ordre_du_jour, statut')
            .eq('projet_id', student.projet_id)
            .order('date_heure', { ascending: true }),
        ]);

        setMemberCount(members?.length || 0);
        setProjectMeetings((meetings || []).map(mapMeeting));

        if (student.projet_id && user.id) {
          fetchMessages(student.projet_id, user.id);
        }
      } catch (err: any) {
        setError(err?.message || 'Loading error');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`student_reunions_${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reunions', filter: `projet_id=eq.${projectId}` },
        () => {
          loadProjectMeetings(projectId).catch((err) => {
            console.error('Erreur chargement réunions:', err);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const markProjectMessagesAsRead = async (activeProjectId: string, myUserId: string) => {
    await supabase
      .from('messages')
      .update({ lu: true })
      .eq('projet_id', activeProjectId)
      .neq('auteur_id', myUserId)
      .eq('lu', false);
  };

  const fetchMessages = async (activeProjectId: string, myUserId: string) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, projet_id, auteur_id, contenu, created_at, lu, type, utilisateurs(nom, prenom, avatar_url)')
      .eq('projet_id', activeProjectId)
      .order('created_at', { ascending: true });

    if (msgs) {
      const formattedMsgs = msgs.map((m: any) => {
        const u = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
        const senderName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
        return {
          id: m.id,
          senderId: m.auteur_id,
          name: m.auteur_id === myUserId ? 'MOI' : senderName.toUpperCase(),
          text: m.contenu,
          time: formatTime(m.created_at),
          isMe: m.auteur_id === myUserId,
          isRead: m.lu === true,
          avatar: resolveAvatar(u?.avatar_url, senderName),
          createdAt: m.created_at
        };
      });
      setMessages(formattedMsgs);
      if (activeProjectId && myUserId) {
        await markProjectMessagesAsRead(activeProjectId, myUserId);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    if (projectId && currentUserId) {
      const channel = supabase
        .channel(`student_project_chat_${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `projet_id=eq.${projectId}`,
          },
          async (payload) => {
            const { data: row } = await supabase
              .from('messages')
              .select('id, projet_id, auteur_id, contenu, created_at, lu, utilisateurs(nom, prenom, avatar_url)')
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
            if (!mapped.isMe && currentUserId) {
              await markProjectMessagesAsRead(projectId, currentUserId);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `projet_id=eq.${projectId}`,
          },
          (payload) => {
            setMessages((prev) => prev.map((m) => (m.id === String(payload.new.id) ? { ...m, isRead: payload.new.lu === true } : m)));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [projectId, currentUserId]);

  const filteredContacts = useMemo(() => {
    if (!search) return contacts;
    return contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [contacts, search]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(q));
  }, [messages, search]);

  const groupedContacts = useMemo(() => {
    const groups: {
      professor?: ContactItem;
      students: ContactItem[];
    } = { students: [] };
  
    filteredContacts.forEach(contact => {
      if (contact.role === 'professor') {
        groups.professor = contact;
      } else {
        groups.students.push(contact);
      }
    });
    return groups;
  }, [filteredContacts]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || null;
  const nextMeeting = useMemo(() => {
    const meetingsWithLink = projectMeetings.filter((meeting) => meeting.lienJitsi);
    const now = Date.now();
    const futureMeetings = meetingsWithLink
      .filter((meeting) => new Date(meeting.dateHeure).getTime() >= now)
      .sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime());

    if (futureMeetings[0]) return futureMeetings[0];

    return [...meetingsWithLink].sort((a, b) => new Date(b.dateHeure).getTime() - new Date(a.dateHeure).getTime())[0] || null;
  }, [projectMeetings]);
  const activeMeetingUrl = nextMeeting?.lienJitsi || (projectId ? getProjectMeetingUrl(projectId) : null);

  const handleCreateMeeting = async () => {
    if (!projectId || !currentUserId || !activeMeetingUrl || creatingMeeting) return;

    setCreatingMeeting(true);
    try {
      const { error: meetingError } = await supabase.from('reunions').insert({
        projet_id: projectId,
        titre: `Appel vidéo - ${projectTitle}`,
        date_heure: new Date().toISOString(),
        duree: 60,
        lien_jitsi: activeMeetingUrl,
        ordre_du_jour: `Appel vidéo lancé par un étudiant pour le projet "${projectTitle}".`,
        statut: 'EN_COURS',
      });

      if (meetingError) throw meetingError;

      await notifyProjectProfessor({
        projectId,
        senderId: currentUserId,
        title: 'Nouvel appel vidéo',
        message: `Un étudiant a lancé un appel vidéo pour "${projectTitle}". Lien: ${activeMeetingUrl}`,
        type: 'MEETING_REQUEST'
      });

      window.open(activeMeetingUrl, '_blank');
      await loadProjectMeetings(projectId);
    } catch (err: any) {
      console.error('Erreur création appel vidéo:', err);
      setError(err?.message || 'Erreur création appel vidéo');
    } finally {
      setCreatingMeeting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !projectId || !currentUserId) return;

    try {
      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          projet_id: projectId,
          auteur_id: currentUserId,
          contenu: input.trim(),
          type: 'TEXTE',
          lu: false,
        });

      if (sendError) throw sendError;

      await notifyProjectProfessor({
        projectId,
        senderId: currentUserId,
        title: 'Nouveau message',
        message: 'Un membre du groupe a envoyé un message.',
        type: 'MESSAGE'
      });

      await notifyProjectStudents({
        projectId,
        senderId: currentUserId,
        title: 'Nouveau message',
        message: 'Un membre du groupe a envoyé un message.',
        type: 'MESSAGE'
      });

      setInput('');
      fetchMessages(projectId, currentUserId);
    } catch (err: any) {
      console.error('Erreur d\'envoi:', err);
    }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !currentUserId || uploading) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `direct-messages/${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('messages').getPublicUrl(filePath);
      const fileTag = `[file]${file.name}||${data.publicUrl}`;

      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          projet_id: projectId,
          auteur_id: currentUserId,
          contenu: fileTag,
          type: 'TEXTE',
          lu: false,
        });

      if (sendError) throw sendError;

      await notifyProjectProfessor({
        projectId,
        senderId: currentUserId,
        title: 'New file',
        message: 'A group member shared a file.',
        type: 'MESSAGE'
      });

      await notifyProjectStudents({
        projectId,
        senderId: currentUserId,
        title: 'New file',
        message: 'A group member shared a file.',
        type: 'MESSAGE'
      });

      fetchMessages(projectId, currentUserId);
    } catch (err: any) {
      console.error('Erreur d\'upload:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[#64748B]">Loading...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#F8FAFC] text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="z-10 flex w-80 flex-col border-r border-transparent bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="p-6 pb-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight">Messages</h2>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border-none bg-[#EEF3F8] py-3 pl-12 pr-4 text-sm font-medium text-[#1a1c1a] placeholder-[#64748B] outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {groupedContacts.professor && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2 px-4">SUPERVISOR</h3>
              <div
                key={groupedContacts.professor.id}
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all ${
                  'border border-[#BFD7EF] bg-[#DCEBFA]/30 shadow-sm'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={resolveAvatar(groupedContacts.professor.avatar_url, groupedContacts.professor.name)}
                    alt={groupedContacts.professor.name}
                    className={`h-12 w-12 rounded-2xl object-cover ${selectedContactId === groupedContacts.professor.id ? 'border-2 border-[#1E3A5F]' : 'border border-[#C8D6E5]'}`}
                  />
                  {groupedContacts.professor.status === 'online' && <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-3">
                    <p className="truncate font-bold text-[#1a1c1a]">{groupedContacts.professor.name}</p>
                    <span className="text-[11px] font-bold uppercase text-[#64748B]">{groupedContacts.professor.time}</span>
                  </div>
                  <p className="mb-0.5 truncate text-[11px] font-semibold text-[#1E3A5F]">Supervisor</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-[#64748B]">{groupedContacts.professor.lastMsg}</p>
                    {groupedContacts.professor.unread > 0 && <span className="rounded-lg bg-[#1E3A5F] px-2 py-1 text-[10px] font-bold text-white">{groupedContacts.professor.unread}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {groupedContacts.students.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2 px-4">MEMBRES ({groupedContacts.students.length})</h3>
              {groupedContacts.students.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all ${
                    'border border-transparent bg-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={resolveAvatar(contact.avatar_url, contact.name)}
                      alt={contact.name}
                      className={`h-12 w-12 rounded-2xl object-cover ${selectedContactId === contact.id ? 'border-2 border-[#1E3A5F]' : 'border border-[#C8D6E5]'}`}
                    />
                    {contact.status === 'online' && <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-3">
                      <p className="truncate font-bold text-[#1a1c1a]">{contact.name}</p>
                      <span className="text-[11px] font-bold uppercase text-[#64748B]">{contact.time}</span>
                    </div>
                    <p className="mb-0.5 truncate text-[11px] font-semibold text-[#64748B]">Student</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-[#64748B]">{contact.lastMsg}</p>
                      {contact.unread > 0 && <span className="rounded-lg bg-[#1E3A5F] px-2 py-1 text-[10px] font-bold text-white">{contact.unread}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col relative bg-white">
        {selectedContactId ? (
          <>
            <div className="flex-1 overflow-y-auto px-8 py-8">
              {filteredMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#64748B]">
                  No message
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[65%] flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        <div className="mb-2 flex items-center gap-2 px-1">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{msg.name}</span>
                          <span className="text-[11px] font-medium text-[#C8D6E5]">{msg.time}</span>
                        </div>
  
                        <div className={`flex items-end gap-3 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <img
                            src={msg.avatar}
                            alt={msg.name}
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                          />
                          <div className={`overflow-hidden text-[15px] font-medium leading-relaxed shadow-sm ${
                            msg.isMe
                              ? 'rounded-3xl rounded-tr-none bg-[#1E3A5F] text-white'
                              : 'rounded-3xl rounded-tl-none border border-[#C8D6E5] bg-white text-[#334155]'
                          }`}>
                            <div className="px-6 py-4">
                              <MessageContent text={msg.text} />
                            </div>
                          </div>
                        </div>
  
                        {msg.isMe && msg.isRead && (
                          <div className="mt-1.5 flex items-center gap-1 px-1">
                            <CheckCheck size={14} className="text-[#1E3A5F]" />
                            <span className="text-[10px] font-bold uppercase text-[#64748B]">VU</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex-shrink-0 bg-white px-6 py-3">
              <div className="mx-auto flex max-w-4xl items-center gap-3">
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

                <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
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
                  disabled={!activeMeetingUrl || creatingMeeting}
                  aria-label="Créer un appel vidéo"
                  title="Créer un appel vidéo"
                  onClick={handleCreateMeeting}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3A5F] text-white transition-all hover:bg-[#172D49] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Video size={20} />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="h-12 flex-1 rounded-2xl border border-[#C8D6E5] bg-[#EEF3F8] px-5 text-[#1a1c1a] placeholder-[#64748B] outline-none focus:border-[#1E3A5F]/30 focus:ring-2 focus:ring-[#1E3A5F]/10"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || uploading}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3A5F] text-white transition-all hover:bg-[#172D49] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[#64748B]">
            Sélectionnez une discussion
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentChat;
