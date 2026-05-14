import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckSquare, FileText, Home, LogOut, MessageCircle, Moon, Settings, Sun, Users, Mail, MessageSquare, CheckCircle, FileCheck, ExternalLink, Video } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';

interface ProfessorTopNavProps {
  onLogout?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
  projet_id?: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: Home },
  { id: 'members', label: 'People', to: '/members', icon: Users },
  { id: 'tasks', label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { id: 'deliverables', label: 'Deliverables', to: '/deliverables', icon: FileText },
  { id: 'chat', label: 'Inbox', to: '/chat', icon: MessageCircle },
];

const ProfessorTopNav: React.FC<ProfessorTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { isDark, toggle } = useDarkMode();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`professor_notifications_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n))
            );
          }
        )
        .subscribe();

      return channel;
    };

    const subPromise = setupSubscription();
    return () => {
      subPromise.then(channel => channel && supabase.removeChannel(channel));
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await handleMarkRead(n.id);
    }

    if (n.type === 'MEETING_REQUEST' && n.projet_id) {
      const meetUrl = `https://meet.jit.si/StudentHub_Project_${n.projet_id}`;
      window.open(meetUrl, '_blank');
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE': return <MessageSquare size={14} className="text-blue-500" />;
      case 'SUBMISSION_LIVRABLE': return <ExternalLink size={14} className="text-purple-500" />;
      case 'MEETING_REQUEST': return <Video size={14} className="text-green-500" />;
      case 'COMMENT_LIVRABLE': return <Mail size={14} className="text-amber-500" />;
      case 'COMMENT_TACHE': return <Mail size={14} className="text-amber-500" />;
      default: return <Bell size={14} className="text-[#765b00]" />;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 60) return `il y a ${mins}m`;
    if (hours < 24) return `il y a ${hours}h`;
    return d.toLocaleDateString();
  };

  return (
    <header className="bg-[#faf9f6] px-4 py-3 md:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-[28px] border border-transparent bg-white px-4 py-2 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                title={item.label}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isActive
                    ? 'bg-[#1a1c1a] text-white shadow-[0_2px_8px_rgba(26,28,26,0.25)]'
                    : 'text-[#7f7664] hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white'
                }`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
              aria-label="Notifications"
              onClick={() => setShowNotif(!showNotif)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ba1a1a] ring-2 ring-white dark:ring-[#1c1b19]" />
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-11 z-50 mt-2 w-80 rounded-[24px] border border-transparent bg-white dark:bg-[#1c1b19] p-4 shadow-[0_8px_32px_rgba(118,91,0,0.15)] backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#1a1c1a] dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-[#ba1a1a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-[#765b00] hover:underline"
                  >
                    Tout marquer comme lu
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                  {loading && <p className="py-8 text-center text-xs text-[#7f7664]">Chargement...</p>}
                  {!loading && notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#7f7664]">Aucune notification.</p>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n)}
                        className={`group relative flex items-start gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                          n.is_read ? 'hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927]' : 'bg-[#765b00]/5 hover:bg-[#765b00]/10'
                        }`}
                      >
                        <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          n.is_read ? 'bg-[#f4f3f1] text-[#7f7664]' : 'bg-[#ffd464] text-[#765b00]'
                        }`}>
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${n.is_read ? 'text-[#4d4636] dark:text-[#d1c5b0]' : 'text-[#1a1c1a] dark:text-white'}`}>
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#7f7664] line-clamp-2">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-[#d1c5b0] uppercase tracking-widest">
                            {formatTime(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <div className="absolute top-4 right-4 h-1.5 w-1.5 rounded-full bg-[#765b00]" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle dark mode"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              isDark
                ? 'bg-[#222222] text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                : 'border border-transparent text-[#7f7664] hover:bg-[#f4f3f1] hover:text-[#1a1c1a]'
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-[#7f7664] transition hover:bg-[#ffdad6] hover:border-[#f5c2be] hover:text-[#ba1a1a]"
            onClick={onLogout}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProfessorTopNav;
