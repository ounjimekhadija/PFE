import { useState, useEffect } from 'react';
import { UserRole, Page } from '../types';
import { supabase } from '../../lib/supabase';

export const useAppController = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);

  // Vérifier la session Supabase au chargement
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // L'utilisateur est connecté dans Supabase, on récupère son rôle
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
        console.error("Erreur lors de l'initialisation de l'auth:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();

    // Écouter les changements d'authentification (ex: déconnexion depuis un autre onglet)
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
