import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckSquare, FileText, Home, LogOut, MessageCircle, Moon, Settings, Sun, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';

interface ProfessorTopNavProps {
  onLogout?: () => void;
}

interface NotifItem {
  id: string;
  type: 'message' | 'deliverable';
  name: string;
  content: string;
  time: string;
  avatar: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: Home },
  { id: 'members', label: 'People', to: '/members', icon: Users },
  { id: 'tasks', label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { id: 'deliverables', label: 'Deliverables', to: '/deliverables', icon: FileText },
  { id: 'chat', label: 'Inbox', to: '/chat', icon: MessageCircle },
];

const toShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const ProfessorTopNav: React.FC<ProfessorTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const { isDark, toggle } = useDarkMode();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectRows } = await supabase
        .from('projets')
        .select('id')
        .eq('encadrant_id', user.id);

      if (!projectRows || projectRows.length === 0) { setNotifs([]); return; }
      const projectIds = projectRows.map((p: any) => p.id);

      const [{ data: msgRows }, { data: delRows }] = await Promise.all([
        supabase
          .from('messages')
          .select('id, contenu, created_at, auteur_id, utilisateurs(nom, prenom)')
          .in('projet_id', projectIds)
          .neq('auteur_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('livrables')
          .select('id, titre, created_at')
          .in('projet_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const msgNotifs: NotifItem[] = (msgRows || []).map((m: any) => {
        const u = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
        const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Etudiant';
        return {
          id: `msg-${m.id}`,
          type: 'message',
          name,
          content: m.contenu,
          time: toShortDate(m.created_at),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        };
      });

      const delNotifs: NotifItem[] = (delRows || []).map((d: any) => ({
        id: `del-${d.id}`,
        type: 'deliverable' as const,
        name: 'Livrable',
        content: d.titre,
        time: toShortDate(d.created_at),
        avatar: `https://ui-avatars.com/api/?name=Livrable&background=ffd464&color=765b00`,
      }));

      const merged = [...msgNotifs, ...delNotifs]
        .sort((a, b) => 0)
        .slice(0, 10);

      setNotifs(merged);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleBellClick = () => {
    setShowNotif((v) => {
      if (!v) fetchNotifications();
      return !v;
    });
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

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
              aria-label="Notifications"
              onClick={handleBellClick}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#765b00] text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-[#f4f3f1] bg-white shadow-[0_8px_24px_rgba(118,91,0,0.12)]">
                <div className="flex items-center justify-between border-b border-[#f4f3f1] px-4 py-3">
                  <h3 className="text-sm font-bold text-[#1a1c1a]">Notifications</h3>
                  <span className="text-[11px] text-[#7f7664]">{new Date().toLocaleDateString('fr-FR')}</span>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifLoading && (
                    <p className="py-6 text-center text-sm text-[#7f7664]">Chargement...</p>
                  )}
                  {!notifLoading && notifs.length === 0 && (
                    <p className="py-6 text-center text-sm text-[#7f7664]">Aucune notification.</p>
                  )}
                  {notifs.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 border-b border-[#f4f3f1] px-4 py-3 last:border-0 hover:bg-[#faf9f6] transition-colors">
                      <img src={n.avatar} alt={n.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#1a1c1a]">{n.name}</p>
                          <span className="shrink-0 text-[10px] text-[#7f7664]">{n.time}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#7f7664]">
                          {n.type === 'deliverable' ? '📎 ' : '💬 '}{n.content}
                        </p>
                      </div>
                    </div>
                  ))}
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

export default ProfessorTopNav;
