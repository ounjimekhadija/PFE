import React from 'react';
import {
  Bell,
  CheckSquare,
  Home,
  Layers,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';

interface AdminTopNavProps {
  onLogout?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface AdminProfile {
  name: string;
  email: string;
  avatar: string;
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', to: '/dashboard', icon: Home },
  { id: 'users', label: 'Utilisateurs', to: '/users', icon: Users },
  { id: 'projects', label: 'Projets', to: '/projects', icon: Layers },
  { id: 'members', label: 'Membres', to: '/members', icon: CheckSquare },
];

const fallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=DCEBFA&color=1E3A5F`;

const resolveAvatar = (value: string | null | undefined, name: string) => {
  if (!value) return fallbackAvatar(name);
  const raw = value.trim();
  if (!raw) return fallbackAvatar(name);
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
  return data?.publicUrl || fallbackAvatar(name);
};

const AdminTopNav: React.FC<AdminTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const [showNotif, setShowNotif] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [profile, setProfile] = React.useState<AdminProfile>({
    name: 'Admin',
    email: '',
    avatar: fallbackAvatar('Admin'),
  });
  const { isDark, toggle } = useDarkMode();

  const compact = collapsed && !hoverOpen;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) setNotifications(data);
  }, []);

  React.useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('utilisateurs')
          .select('nom, prenom, email, avatar_url')
          .eq('id', user.id)
          .single();

        if (userData) {
          const name = `${userData.prenom || ''} ${userData.nom || ''}`.trim() || 'Admin';
          setProfile({
            name,
            email: userData.email || '',
            avatar: resolveAvatar(userData.avatar_url, name),
          });
        }
      }

      await fetchNotifications();
      channel = supabase
        .channel('admin_notifications_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, fetchNotifications)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, fetchNotifications)
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
    if (!error) setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markIndividualAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  return (
    <aside
      className={`flex h-dvh shrink-0 flex-col border-r border-[#DCEBFA] bg-white py-4 shadow-[2px_0_18px_rgba(15,23,42,0.04)] transition-[width,padding] duration-300 ${
        compact ? 'w-20 px-3' : 'w-64 px-4'
      }`}
      onMouseEnter={() => collapsed && setHoverOpen(true)}
      onMouseLeave={() => {
        setHoverOpen(false);
        setShowNotif(false);
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

      <div className="mt-4 space-y-3">
        <div className="relative">
          <button
            type="button"
            className={`relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[#172D49] transition hover:bg-[#EEF3F8] ${
              compact ? 'justify-center' : 'justify-start'
            }`}
            aria-label="Notifications"
            onClick={() => setShowNotif((value) => !value)}
          >
            <Bell size={18} />
            {!compact && <span className="truncate text-sm font-bold">Notifications</span>}
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1D71F2] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute bottom-0 left-[calc(100%+0.75rem)] z-50 w-[calc(100vw-6rem)] max-w-96 rounded-2xl border border-[#DCEBFA] bg-white p-3 shadow-[0_16px_42px_rgba(15,23,42,0.16)]">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-[#1a1c1a]">Notifications</h3>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs font-bold text-[#1D71F2] hover:underline">
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
                      onClick={() => !notification.is_read && markIndividualAsRead(notification.id)}
                      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                        !notification.is_read ? 'bg-[#EEF3F8]' : 'hover:bg-[#F8FAFC]'
                      }`}
                      type="button"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#1E3A5F] shadow-sm">
                        <Bell size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#1a1c1a]">{notification.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#64748B]">{notification.message}</p>
                        <p className="mt-1.5 text-[10px] font-medium text-[#94A3B8]">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
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
                <p className="truncate text-[10px] font-medium text-[#64748B]">Administrateur</p>
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

export default AdminTopNav;
