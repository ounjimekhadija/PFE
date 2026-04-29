import React from 'react';
import { Bell, CheckSquare, FileText, Home, LogOut, MessageCircle, Moon, Settings, Sun, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';

interface StudentTopNavProps {
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: Home },
  { id: 'groups', label: 'Groups', to: '/groups', icon: Users },
  { id: 'tasks', label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { id: 'deliverables', label: 'Deliverables', to: '/deliverables', icon: FileText },
  { id: 'chat', label: 'Inbox', to: '/chat', icon: MessageCircle },
];

const StudentTopNav: React.FC<StudentTopNavProps> = ({ onLogout }) => {
  const location = useLocation();
  const [showNotif, setShowNotif] = React.useState(false);
  const { isDark, toggle } = useDarkMode();

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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] dark:hover:bg-[#2a2927] hover:text-[#1a1c1a] dark:hover:text-white"
              aria-label="Notifications"
              onClick={() => setShowNotif((v) => !v)}
            >
              <Bell size={16} />
            </button>
            {showNotif && (
              <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-transparent bg-white dark:bg-[#1c1b19] p-4 shadow-[0_4px_16px_rgba(118,91,0,0.1)]">
                <h3 className="text-sm font-semibold text-[#1a1c1a] dark:text-[#e8e3da]">Notifications</h3>
                <p className="mt-3 text-sm text-[#7f7664]">No new notifications.</p>
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

export default StudentTopNav;
