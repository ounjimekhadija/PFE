import React from 'react';
import { Bell, CheckSquare, Home, Layers, LogOut, Moon, Settings, Sun, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminTopNavProps {
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: Home },
  { id: 'users', label: 'People', to: '/users', icon: Users },
  { id: 'projects', label: 'Projects', to: '/projects', icon: Layers },
  { id: 'members', label: 'Members', to: '/members', icon: CheckSquare },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const AdminTopNav: React.FC<AdminTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [showNotif, setShowNotif] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const { isDark, toggle } = useDarkMode();

  const fetchNotifications = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!error && data) {
      setNotifications(data);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    // Set up real-time subscription
    const channel = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async () => {
    if (unreadCount > 0) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    }
  };

  const markIndividualAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  return (
    <header className="bg-[#faf9f6] px-4 py-3 md:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-[28px] border border-transparent bg-white px-4 py-2 shadow-[0_4px_16px_rgba(118,91,0,0.06)]" style={{ transition: 'background-color 0.2s' }}>
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

          <div className="relative">
             <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
              aria-label="Notifications"
              onClick={() => {
                setShowNotif((v) => !v);
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1c1b19]"></span>
              )}
            </button>
             {showNotif && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#f4f3f1] bg-white dark:bg-[#1c1b19] shadow-[0_8px_32px_rgba(118,91,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-[#f4f3f1] p-4 bg-[#faf9f6]/50">
                  <h3 className="text-sm font-bold text-[#1a1c1a] dark:text-[#e8e3da]">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAsRead}
                      className="text-[10px] font-bold text-[#765b00] hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-[#7f7664]">No new notifications.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`group relative border-b border-[#f4f3f1] p-4 last:border-0 transition-colors hover:bg-[#faf9f6] ${!n.is_read ? 'bg-[#ffd464]/5' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs font-bold text-[#1a1c1a] dark:text-[#e8e3da] flex items-center gap-2">
                              {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-[#765b00]"></span>}
                              {n.title}
                            </p>
                            <p className="text-xs text-[#4d4636] dark:text-[#c4b99a] leading-relaxed">{n.message}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="shrink-0 text-[10px] text-[#7f7664]">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                            </span>
                            {!n.is_read && (
                              <button
                                onClick={() => markIndividualAsRead(n.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-[#765b00]/10 text-[#765b00] hover:bg-[#765b00] hover:text-white"
                                title="Marquer comme lu"
                              >
                                <CheckSquare size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
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

export default AdminTopNav;
