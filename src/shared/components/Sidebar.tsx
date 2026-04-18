import React, { useState } from 'react';
import { Home, User, MessageSquare, CheckSquare, Calendar, Settings, Apple, Users, Layers, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Page, UserRole } from '../types';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  role: UserRole;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, onLogout }) => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  const professorItems = [
    { id: 'dashboard', icon: Home, label: 'HOME' },
    { id: 'members', icon: User, label: 'PROFILE' },
    { id: 'chat', icon: MessageSquare, label: 'INBOX' },
    { id: 'tasks', icon: CheckSquare, label: 'TASKS' },
    { id: 'deliverables', icon: Calendar, label: 'DELIVERABLES' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
    { id: 'logout', icon: LogOut, label: 'LOG OUT' },
  ];

  const studentItems = [
    { id: 'dashboard', icon: Home, label: 'DASHBOARD' },
    { id: 'tasks', icon: CheckSquare, label: 'TASKS' },
    { id: 'groups', icon: Users, label: 'GROUPS' },
    { id: 'deliverables', icon: Calendar, label: 'DELIVERABLES' },
    { id: 'chat', icon: MessageSquare, label: 'CHAT' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
    { id: 'logout', icon: LogOut, label: 'LOG OUT' },
  ];

  const adminItems = [
    { id: 'dashboard', icon: Home, label: 'STATS' },
    { id: 'users', icon: Users, label: 'USERS' },
    { id: 'projects', icon: Layers, label: 'PROJECTS' },
    { id: 'members', icon: User, label: 'MEMBERS' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
    { id: 'logout', icon: LogOut, label: 'LOG OUT' },
  ];

  const getMenuItems = () => {
    if (role === 'student') return studentItems;
    if (role === 'admin') return adminItems;
    return professorItems;
  };

  const menuItems = getMenuItems();

  return (
    <motion.div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={{ width: isHovered ? 240 : 80 }}
      className="bg-[#1a1a1a] flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out overflow-hidden"
    >
      {/* Logo Section */}
      <div className="h-24 flex items-center px-6 gap-4">
        <div className="min-w-[32px]">
          <Apple size={32} className="text-white" />
        </div>
        {isHovered && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-red whitespace-nowrap"
          >
            {role === 'student' ? 'STUDENT HUB' : 'PROFESSOR HUB'}
          </motion.span>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex-1 flex flex-col py-4">
        {/* Logout button au-dessus de Settings */}
        {menuItems.map((item, idx) => {
          if (item.id === 'logout') {
            return (
              <button
                key="logout"
                onClick={onLogout}
                className={`relative w-full flex items-center h-16 px-6 gap-4 text-gray-500 hover:text-red-500 transition-colors duration-300 mb-2`}
                style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer' }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="min-w-[40px] h-10 flex items-center justify-center rounded-full"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {isHovered && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-bold text-xs tracking-widest whitespace-nowrap text-red-500"
                  >
                    LOG OUT
                  </motion.span>
                )}
              </button>
            );
          }
          // Build the route path
          const path = item.id === 'dashboard' ? '/dashboard' : `/${item.id}`;
          const isActive = location.pathname === path;
          return (
            <div className="relative group" key={item.id}>
              {/* Active Background Shape (White to match pages) */}
              {isActive && (
                <div className="absolute inset-0 bg-white rounded-l-[40px] ml-2">
                  {/* Top Curve */}
                  <div className="absolute -top-6 right-0 w-6 h-6 bg-white before:content-[''] before:absolute before:inset-0 before:bg-[#1a1a1a] before:rounded-br-[24px]"></div>
                  {/* Bottom Curve */}
                  <div className="absolute -bottom-6 right-0 w-6 h-6 bg-white before:content-[''] before:absolute before:inset-0 before:bg-[#1a1a1a] before:rounded-tr-[24px]"></div>
                </div>
              )}
              <Link
                to={path}
                className={`relative w-full flex items-center h-16 px-6 gap-4 transition-colors duration-300 ${
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div className={`min-w-[40px] h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                  isActive ? 'bg-[#ff4d4d] text-white shadow-lg shadow-red-500/40' : ''
                }`}>
                  {item.icon && <item.icon size={20} />}
                </div>
                {isHovered && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`font-bold text-xs tracking-widest whitespace-nowrap ${
                      isActive ? 'text-[#ff4d4d]' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Sidebar;
