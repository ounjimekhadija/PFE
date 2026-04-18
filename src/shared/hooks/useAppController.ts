import { useState, useEffect } from 'react';
import { UserRole, Page } from '../types';



export const useAppController = () => {
  // Toujours démarrer déconnecté (afficher login à chaque fois)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');


  // Persist auth state to localStorage
  useEffect(() => {
    localStorage.setItem('auth', JSON.stringify({
      isAuthenticated,
      userRole,
    }));
  }, [isAuthenticated, userRole]);

  const login = (role: UserRole) => {
    setUserRole(role);
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
    setUserRole('student');
    localStorage.removeItem('auth');
  };

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
  };

  return {
    isAuthenticated,
    userRole,
    currentPage,
    login,
    logout,
    navigateTo,
  };
};
