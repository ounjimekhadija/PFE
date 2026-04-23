import React from 'react';
import { Bell, LogOut, Settings, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface AdminTopNavProps {
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { id: 'users', label: 'People', to: '/users' },
  { id: 'projects', label: 'Projects', to: '/projects' },
  { id: 'members', label: 'Members', to: '/members' },
  { id: 'settings', label: 'Setting', to: '/settings' },
];

const AdminTopNav: React.FC<AdminTopNavProps> = ({ onLogout }) => {
  const location = useLocation();

  return (
    <header className="border-b border-[#E2E8F0] bg-[#F8FAFF] px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-[22px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#1E293B] text-white'
                    : 'text-[#475569] hover:bg-[#F8FAFF] hover:text-[#0F172A]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-2 flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] text-[#64748B] transition hover:bg-[#F8FAFF]"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] text-[#64748B] transition hover:bg-[#F8FAFF]"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] text-[#64748B] transition hover:bg-[#F8FAFF]"
            aria-label="Profile"
          >
            <User size={16} />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
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
