import React from 'react';
import { Bell, CheckSquare, FileText, Home, LogOut, MessageCircle, Moon, Settings, Sun, Users, Mail, MessageSquare, CheckCircle, FileCheck, ExternalLink, Video } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  projet_id?: string;
}

interface StudentTopNavProps {
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', to: '/dashboard', icon: Home },
  { id: 'groups', label: 'Groupes', to: '/groups', icon: Users },
  { id: 'tasks', label: 'TÃ¢ches', to: '/tasks', icon: CheckSquare },
  { id: 'deliverables', label: 'Livrables', to: '/deliverables', icon: FileText },
  { id: 'chat', label: 'Messagerie', to: '/chat', icon: MessageCircle },
];

const StudentTopNav: React.FC<StudentTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [showNotif, setShowNotif] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const { isDark, toggle } = useDarkMode();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  React.useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setNotifications(data);

      channel = supabase
        .channel(`student_notifications_${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n));
        })
        .subscribe();
    };

    initNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

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

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }

    if (n.type === 'MEETING_REQUEST' && n.projet_id) {
      const meetUrl = `https://meet.jit.si/Encadrant_Project_${n.projet_id}`;
      window.open(meetUrl, '_blank');
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE': return <MessageSquare size={14} className="text-blue-500" />;
      case 'COMMENT_LIVRABLE':
      case 'COMMENT_TACHE': return <Mail size={14} className="text-amber-500" />;
      case 'VALIDATION_LIVRABLE': return <FileCheck size={14} className="text-green-500" />;
      case 'VALIDATION_ITERATION': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'MEETING_REQUEST': return <Video size={14} className="text-green-500" />;
      case 'SUBMISSION_LIVRABLE': return <ExternalLink size={14} className="text-purple-500" />;
      default: return <Bell size={14} className="text-[#1E3A5F]" />;
    }
  };

  return (
    <header className="bg-[#F8FAFC] px-4 py-3 md:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-2xl border border-[#C8D6E5]/60 bg-white px-4 py-2 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
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
                    ? 'bg-[#1E3A5F] text-white shadow-[0_2px_8px_rgba(30,58,95,0.25)]'
                    : 'text-[#64748B] hover:bg-[#EEF3F8] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white'
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#64748B] transition hover:bg-[#EEF3F8] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>

          <div className="relative">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#64748B] transition hover:bg-[#EEF3F8] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
              aria-label="Notifications"
              onClick={() => setShowNotif((v) => !v)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ba1a1a] ring-2 ring-white dark:ring-[#1c1b19]" />
              )}
            </button>
             {showNotif && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-[24px] border border-transparent bg-white dark:bg-[#1c1b19] p-4 shadow-[0_8px_32px_rgba(15,23,42,0.15)] backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#1a1c1a] dark:text-[#e8e3da]">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-[#DCEBFA] text-[#1E3A5F] px-2 py-0.5 rounded-full">
                        {unreadCount} nouv.
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                
                <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#64748B]">Aucune notification.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl transition-all text-left group ${
                          !n.is_read ? 'bg-[#EEF3F8] dark:bg-[#2a2927]' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#232220]'
                        }`}
                      >
                        <div className={`mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center rounded-xl ${
                          !n.is_read ? 'bg-white dark:bg-[#1c1b19] shadow-sm' : 'bg-[#EEF3F8] dark:bg-[#2a2927]'
                        }`}>
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold leading-tight ${!n.is_read ? 'text-[#1a1c1a] dark:text-white' : 'text-[#64748B]'}`}>
                            {n.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#64748B] leading-snug line-clamp-2">
                            {n.message}
                          </p>
                          <p className="mt-1.5 text-[9px] font-medium text-[#C8D6E5]">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!n.is_read && (
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-[#1E3A5F]" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle dark mode"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              isDark
                ? 'bg-[#222222] text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                : 'border border-transparent text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#1a1c1a]'
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DCEBFA] bg-[#EEF3F8] px-3 py-2 text-xs font-semibold text-[#1E3A5F] transition hover:border-[#C8D6E5] hover:bg-[#DCEBFA] dark:border-[#274563] dark:bg-[#102033] dark:text-[#DCEBFA] dark:hover:bg-[#173150]"
            onClick={onLogout}
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
};

export default StudentTopNav;
