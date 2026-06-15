import React from 'react';
import {
  Bell,
  CheckCircle,
  CheckSquare,
  ExternalLink,
  FileCheck,
  FileText,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Users,
  Video,
} from 'lucide-react';
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

interface StudentProfile {
  name: string;
  email: string;
  avatar: string;
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', to: '/dashboard', icon: Home },
  { id: 'groups', label: 'Groupes', to: '/groups', icon: Users },
  { id: 'tasks', label: 'Taches', to: '/tasks', icon: CheckSquare },
  { id: 'deliverables', label: 'Livrables', to: '/deliverables', icon: FileText },
  { id: 'chat', label: 'Messages', to: '/chat', icon: MessageCircle },
];

const StudentTopNav: React.FC<StudentTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(true);
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const [showNotif, setShowNotif] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [profile, setProfile] = React.useState<StudentProfile>({
    name: 'Etudiant',
    email: '',
    avatar: 'https://ui-avatars.com/api/?name=Etudiant&background=DCEBFA&color=1E3A5F',
  });
  const { isDark, toggle } = useDarkMode();

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const compact = collapsed && !hoverOpen;

  React.useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('utilisateurs')
        .select('nom, prenom, email, avatar_url')
        .eq('id', user.id)
        .single();

      if (userData) {
        const name = `${userData.prenom || ''} ${userData.nom || ''}`.trim() || 'Etudiant';
        setProfile({
          name,
          email: userData.email || '',
          avatar: userData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=DCEBFA&color=1E3A5F`,
        });
      }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setNotifications(data);

      channel = supabase
        .channel(`student_notifications_${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          if ((payload.new as Notification & { sender_id?: string }).sender_id === user.id) return;
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications((prev) => prev.map((notification) => (
            notification.id === payload.new.id ? { ...notification, ...payload.new } : notification
          )));
        })
        .subscribe();
    };

    init();

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
      setNotifications((prev) => prev.map((notification) => (
        notification.id === id ? { ...notification, is_read: true } : notification
      )));
    }
  };

  const handleMarkAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    const meetingWindow =
      notification.type === 'MEETING_REQUEST' && notification.projet_id
        ? window.open('about:blank', '_blank')
        : null;

    if (!notification.is_read) await markAsRead(notification.id);

    if (notification.type === 'MEETING_REQUEST' && notification.projet_id) {
      const meetingUrl = `https://meet.jit.si/PFEspace_Project_${notification.projet_id}`;
      if (meetingWindow) {
        meetingWindow.location.href = meetingUrl;
      } else {
        window.open(meetingUrl, '_blank');
      }
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
    <aside
      className={`flex h-dvh shrink-0 flex-col border-r border-[#DCEBFA] bg-white py-4 shadow-[2px_0_18px_rgba(15,23,42,0.04)] transition-[width,padding] duration-300 ${
        compact ? 'w-20 px-3' : 'w-64 px-4'
      }`}
      onMouseEnter={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const isInsideSidebar =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;

        if (collapsed && isInsideSidebar) setHoverOpen(true);
      }}
      onMouseLeave={() => {
        setHoverOpen(false);
      }}
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <div className={`mb-6 flex items-center gap-3 ${compact ? 'justify-center' : 'justify-between'}`}>
        <Link to="/dashboard" className={`flex min-w-0 items-center gap-3 rounded-xl text-[#0F2442] ${compact ? 'justify-center' : ''}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1E3A5F] shadow-[0_8px_18px_rgba(30,58,95,0.22)]">
            <img src="/logo.png" alt="PFEspace" className="h-9 w-9 object-contain" />
          </div>
          {!compact && <span className="truncate text-xl font-extrabold tracking-tight">PFEspace</span>}
        </Link>

        {!compact && (
          <button
            type="button"
            onClick={() => {
              setCollapsed((value) => !value);
              setHoverOpen(false);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#EEF3F8] hover:text-[#172D49]"
            aria-label={collapsed ? 'Garder la barre laterale ouverte' : 'Replier la barre laterale'}
            title={collapsed ? 'Garder ouverte' : 'Replier'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              title={item.label}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                compact ? 'justify-center' : 'justify-start'
              } ${
                isActive
                  ? 'bg-[#1E3A5F] text-white shadow-[0_6px_16px_rgba(30,58,95,0.22)]'
                  : 'text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#172D49]'
              }`}
            >
              <Icon size={18} />
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-3">
        <div
          className="fixed bottom-6 right-6 z-50"
          onMouseEnter={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCEBFA] bg-white text-[#172D49] shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:bg-[#F8FAFC]"
            aria-label="Notifications"
            onClick={() => setShowNotif((value) => !value)}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1D71F2] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute bottom-full right-0 z-50 mb-3 w-[calc(100vw-2rem)] max-w-96 rounded-2xl border border-[#DCEBFA] bg-white p-3 shadow-[0_16px_42px_rgba(15,23,42,0.16)]">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-[#1a1c1a]">Notifications</h3>
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead} className="text-xs font-bold text-[#1D71F2] hover:underline">
                    Tout lire
                  </button>
                )}
              </div>

              <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#64748B]">Aucune notification.</p>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                        !notification.is_read ? 'bg-[#EEF3F8]' : 'hover:bg-[#F8FAFC]'
                      }`}
                      type="button"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        {getNotifIcon(notification.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#1a1c1a]">{notification.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#64748B]">{notification.message}</p>
                        <p className="mt-1.5 text-[10px] font-medium text-[#94A3B8]">
                          {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!notification.is_read && <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#1D71F2]" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link
          to="/settings"
          className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
            compact ? 'justify-center' : 'justify-start'
          } ${
            location.pathname === '/settings'
              ? 'bg-[#1E3A5F] text-white shadow-[0_6px_16px_rgba(30,58,95,0.22)]'
              : 'text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#172D49]'
          }`}
          aria-label="Parametres"
        >
          <Settings size={18} />
          {!compact && <span className="truncate">Parametres</span>}
        </Link>

        <button
          type="button"
          onClick={toggle}
          aria-label="Mode sombre"
          className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
            compact ? 'justify-center' : 'justify-start'
          } ${
            isDark ? 'bg-[#172D49] text-white' : 'text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#172D49]'
          }`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {!compact && <span className="truncate">{isDark ? 'Mode clair' : 'Mode sombre'}</span>}
        </button>

        <div className="rounded-2xl border border-[#DCEBFA] bg-[#F8FAFC] p-2">
          <div className={`flex items-center gap-3 ${compact ? 'justify-center' : 'justify-start'}`}>
            <img src={profile.avatar} alt={profile.name} className="h-10 w-10 rounded-xl object-cover" />
            {!compact && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#0F2442]">{profile.name}</p>
              <p className="truncate text-[10px] font-medium text-[#64748B]">Etudiant</p>
            </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#64748B] transition hover:bg-[#FFE4E0] hover:text-[#ba1a1a] ${
            compact ? 'justify-center' : 'justify-start'
          }`}
          onClick={onLogout}
          aria-label="Deconnexion"
        >
          <LogOut size={18} />
          {!compact && <span className="truncate">Deconnexion</span>}
        </button>
      </div>
    </aside>
  );
};

export default StudentTopNav;


