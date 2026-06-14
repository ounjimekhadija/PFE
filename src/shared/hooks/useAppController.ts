import { useState, useEffect } from 'react';
import { UserRole, Page } from '../types';
import { supabase } from '../../lib/supabase';

export const useAppController = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);

  // Check Supabase session on load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is logged in to Supabase, we fetch their role
          const { data: userData } = await supabase
            .from('utilisateurs')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            let role: UserRole = 'student';
            if (userData.role === 'ADMINISTRATEUR') role = 'admin';
            else if (userData.role === 'ENCADRANT') role = 'professor';
            
            setUserRole(role);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();

    // Listen for authentication changes (e.g. logout from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserRole('student');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = (role: UserRole) => {
    setUserRole(role);
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
    setUserRole('student');
  };

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
  };

  return {
    isAuthenticated,
    isInitializing,
    userRole,
    currentPage,
    login,
    logout,
    navigateTo,
  };
};


