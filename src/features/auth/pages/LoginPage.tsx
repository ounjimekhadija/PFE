import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserRole } from '../../../shared/types';
import { supabase } from '../../../lib/supabase';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mapDbRoleToUserRole = (dbRole: string): UserRole => {
    if (dbRole === 'ADMINISTRATEUR') return 'admin';
    if (dbRole === 'ENCADRANT') return 'professor';
    return 'student';
  };

  const findUserByEmail = async (email: string) => {
    const normalized = email.trim().toLowerCase();

    // Prefer exact match first.
    const { data: exactMatch } = await supabase
      .from('utilisateurs')
      .select('id, role, email')
      .eq('email', normalized)
      .maybeSingle();

    if (exactMatch) return exactMatch;

    // Fallback to case-insensitive match for legacy/mixed-case records.
    const { data: ciMatches } = await supabase
      .from('utilisateurs')
      .select('id, role, email')
      .ilike('email', normalized)
      .limit(1);

    return Array.isArray(ciMatches) && ciMatches.length > 0 ? ciMatches[0] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const email = username.trim().toLowerCase();

    try {
      const userPassword = password;

      if (!email || !userPassword) {
        throw new Error('Please enter an email and password.');
      }

      // 1. Login via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: userPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Get user role from the users table
        const { data: userData, error: userError } = await supabase
          .from('utilisateurs')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (userError) throw userError;

        // Map Supabase role (ADMINISTRATEUR, ENCADRANT, ETUDIANT) to our internal UserRoles
        const userRole = mapDbRoleToUserRole(userData.role);
        
        // 3. Trigger onLogin with the automatically detected true role
        onLogin(userRole);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const message = err?.message || 'Incorrect credentials';
      if (message.toLowerCase().includes('invalid login credentials')) {
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
          if (existingUser.role === 'ENCADRANT') {
            setError("Supervisor account found. Incorrect password. Use 'Forgot Password' to reset.");
          } else {
            setError("Account found. Incorrect password or Auth account not synced. Use 'Forgot Password'.");
          }
        } else {
          setError("Incorrect email or password. If the problem persists, use 'Forgot Password'.");
        }
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = username.trim().toLowerCase();
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Enter your email first, then click Forgot Password.');
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) throw resetError;
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError(err?.message || 'Unable to send password reset email.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-[#050505]">
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[58%_42%]"
      >
        <section className="flex min-h-[42vh] items-center justify-center px-8 py-10 sm:px-12 lg:min-h-screen lg:px-14">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-auto w-full max-w-[360px] object-contain sm:max-w-[460px] lg:max-w-[560px]"
          />

        </section>

        <section className="flex min-h-[58vh] items-center justify-center border-t border-[#DADDE1] px-6 py-10 lg:min-h-screen lg:border-l lg:border-t-0 lg:px-16">
          <div className="w-full max-w-[520px]">
            <h2 className="mb-7 text-2xl font-bold text-[#050505]">Se connecter</h2>

            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                  {info}
                </div>
              )}

              <input
                type="email"
                id="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-20 w-full rounded-[22px] border border-[#CCD0D5] bg-white px-6 text-xl font-medium text-[#050505] outline-none transition focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]"
                placeholder="E-mail ou numéro de mobile"
                required
              />

              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-20 w-full rounded-[22px] border border-[#CCD0D5] bg-white px-6 text-xl font-medium text-[#050505] outline-none transition focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]"
                placeholder="Mot de passe"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-3 h-14 w-full rounded-full bg-[#1877F2] px-6 text-xl font-bold text-white transition hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="mx-auto mt-5 text-lg font-bold text-[#050505] transition hover:text-[#1877F2]"
              >
                Mot de passe oublié ?
              </button>
            </form>
          </div>
        </section>
      </motion.main>
    </div>
  );
};

export default Login;
