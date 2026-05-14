import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './shared/components/Sidebar';
import AdminTopNav from './shared/components/AdminTopNav';
import ProfessorTopNav from './shared/components/ProfessorTopNav';
import StudentTopNav from './shared/components/StudentTopNav';
import LoginPage from './features/auth/pages/LoginPage';
import StudentSettingsPage from './features/student/pages/StudentSettingsPage';
import ProfessorSettingsPage from './features/professor/pages/ProfessorSettingsPage';
import AdminSettingsPage from './features/admin/pages/AdminSettingsPage';
import StudentDashboardPage from './features/student/pages/StudentDashboardPage';
import StudentChatPage from './features/student/pages/StudentChatPage';
import StudentDeliverablesPage from './features/student/pages/StudentDeliverablesPage';
import StudentGroupsPage from './features/student/pages/StudentGroupsPage';
import StudentTasksPage from './features/student/pages/StudentTasksPage';
import ProfessorDashboardPage from './features/professor/pages/ProfessorDashboardPage';
import ProfessorChatPage from './features/professor/pages/ProfessorChatPage';
import ProfessorDeliverablesPage from './features/professor/pages/ProfessorDeliverablesPage';
import ProfessorMembersPage from './features/professor/pages/ProfessorMembersPage';
import ProfessorTasksPage from './features/professor/pages/ProfessorTasksPage';
import AdminDashboardPage from './features/admin/pages/AdminDashboardPage';
import AdminMembersPage from './features/admin/pages/AdminMembersPage';
import AdminProjectsPage from './features/admin/pages/AdminProjectsPage';
import AdminUsersPage from './features/admin/pages/AdminUsersPage';
import { useAppController } from './shared/hooks/useAppController';
import SplashScreen from './shared/components/SplashScreen';
import { useState } from 'react';
const App: React.FC = () => {
  const {
    isAuthenticated,
    isInitializing,
    userRole,
    login,
    logout
  } = useAppController();

  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      {isInitializing ? (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f0f0e]">
          <div className="relative flex flex-col items-center">
            <div className="absolute -inset-20 bg-[#765b00] opacity-10 blur-[100px] animate-pulse"></div>
            <div className="mb-12 relative">
              <h1 className="text-6xl font-bold tracking-tighter text-white">
                Bar<span className="text-[#765b00]">Oun</span>
              </h1>
              <div className="absolute -bottom-2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#765b00] to-transparent"></div>
            </div>
            <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden relative backdrop-blur-sm">
              <div className="h-full bg-gradient-to-r from-[#765b00] to-[#b88c00] animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <p className="mt-4 text-[#7f7664] text-sm tracking-[0.2em] uppercase animate-pulse">
              Initialisation de votre espace
            </p>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className={userRole === 'admin' || userRole === 'professor' || userRole === 'student' ? 'flex flex-col h-screen overflow-hidden bg-[#faf9f6]' : 'flex h-screen bg-white'}>
          {userRole !== 'admin' && userRole !== 'professor' && userRole !== 'student' && <Sidebar role={userRole} onLogout={logout} />}
          <main className="flex-1 flex flex-col overflow-hidden">
            {userRole === 'admin' && <AdminTopNav onLogout={logout} />}
            {userRole === 'professor' && <ProfessorTopNav onLogout={logout} />}
            {userRole === 'student' && <StudentTopNav onLogout={logout} />}
            <Routes>
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />

              {/* Settings page by role */}
              {userRole === 'student' && <Route path="/settings" element={<StudentSettingsPage />} />}
              {userRole === 'professor' && <Route path="/settings" element={<ProfessorSettingsPage />} />}
              {userRole === 'admin' && <Route path="/settings" element={<AdminSettingsPage />} />}

              {/* Student routes */}
              {userRole === 'student' && <>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<StudentDashboardPage />} />
                <Route path="/chat" element={<StudentChatPage />} />
                <Route path="/deliverables" element={<StudentDeliverablesPage />} />
                <Route path="/groups" element={<StudentGroupsPage />} />
                <Route path="/tasks" element={<StudentTasksPage />} />
              </>}

              {/* Professor routes */}
              {userRole === 'professor' && <>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<ProfessorDashboardPage />} />
                <Route path="/chat" element={<ProfessorChatPage />} />
                <Route path="/deliverables" element={<ProfessorDeliverablesPage />} />
                <Route path="/members" element={<ProfessorMembersPage />} />
                <Route path="/tasks" element={<ProfessorTasksPage />} />
              </>}

              {/* Admin routes */}
              {userRole === 'admin' && <>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<AdminDashboardPage />} />
                <Route path="/members" element={<AdminMembersPage />} />
                <Route path="/projects" element={<AdminProjectsPage />} />
                <Route path="/users" element={<AdminUsersPage />} />
              </>}

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </Router>
  );
};

export default App;
