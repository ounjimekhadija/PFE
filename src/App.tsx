import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './shared/components/Sidebar';
import LoginPage from './features/auth/pages/LoginPage';
import SettingsPage from './features/auth/pages/SettingsPage';
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

const App: React.FC = () => {
  const { 
    isAuthenticated, 
    userRole, 
    login, 
    logout
  } = useAppController();

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-white">
        <Sidebar role={userRole} onLogout={logout} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            {/* Common */}
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
    </Router>
  );
};

export default App;
