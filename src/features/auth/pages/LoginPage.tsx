import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

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
        throw new Error('Veuillez saisir votre email et votre mot de passe.');
      }

      // 1. Connexion via Supabase Auth
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
      console.error('Connexion error:', err);
      const message = err?.message || 'Identifiants incorrects';
      if (message.toLowerCase().includes('invalid login credentials')) {
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
          if (existingUser.role === 'ENCADRANT') {
            setError('Compte encadrant trouvé. Mot de passe incorrect. Utilisez la récupération pour le réinitialiser.');
          } else {
            setError('Compte trouvé. Mot de passe incorrect ou compte non synchronisé. Utilisez la récupération pour le réinitialiser.');
          }
        } else {
          setError('Email ou mot de passe incorrect. Si le problème persiste, utilisez la récupération du mot de passe.');
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
      setError("Saisissez d'abord votre email, puis lancez la récupération du mot de passe.");
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) throw resetError;
      setInfo('Email de réinitialisation envoyé. Vérifiez votre boîte de réception.');
    } catch (err: any) {
      setError(err?.message || "Impossible d'envoyer l'email de réinitialisation.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7FB] text-[#0F172A]">
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto grid min-h-screen w-full grid-cols-1 lg:grid-cols-[54%_46%]"
      >
        <section className="relative flex min-h-[38vh] items-center justify-center overflow-hidden bg-[#0F2A44] px-8 py-10 text-white sm:px-12 lg:min-h-screen lg:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(191,215,239,0.18),transparent_30%),linear-gradient(135deg,rgba(30,58,95,0.72),rgba(15,42,68,0.96))]" />
          <div className="relative flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 shadow-[0_18px_40px_rgba(3,7,18,0.18)]">
              <img src="/logo.png" alt="PFE Space" className="h-12 w-12 object-contain" />
            </div>
            <h1 className="max-w-lg text-4xl font-bold leading-tight text-white sm:text-5xl">
              PFE Space
            </h1>
            <p className="mt-4 max-w-md text-base font-medium leading-7 text-[#D8E6F5]">
              Un espace centralisé pour suivre les projets, collaborer avec les équipes et gérer les livrables.
            </p>
            <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#BFD7EF]">Suivi</p>
                <p className="mt-1 text-sm font-semibold text-white">Projets et livrables</p>
              </div>
              <div className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#BFD7EF]">Collaboration</p>
                <p className="mt-1 text-sm font-semibold text-white">Étudiants et encadrants</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[62vh] items-center justify-center px-6 py-10 lg:min-h-screen lg:px-16">
          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C8D6E5] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#1E3A5F] shadow-sm">
                <ShieldCheck size={15} />
                Accès sécurisé
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">Connexion</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Connectez-vous avec votre compte universitaire.
              </p>
            </div>

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

              <label htmlFor="email" className="block">
                <span className="mb-2 block text-sm font-bold text-[#334155]">Adresse email</span>
                <span className="relative block">
                  <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="email"
                    id="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 w-full rounded-xl border border-[#C8D6E5] bg-white pl-12 pr-4 text-base font-semibold text-[#0F172A] shadow-sm outline-none transition placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:ring-4 focus:ring-[#1E3A5F]/10"
                    placeholder="name@university.ma"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>

              <label htmlFor="password" className="block">
                <span className="mb-2 block text-sm font-bold text-[#334155]">Mot de passe</span>
                <span className="relative block">
                  <LockKeyhole size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 w-full rounded-xl border border-[#C8D6E5] bg-white pl-12 pr-12 text-base font-semibold text-[#0F172A] shadow-sm outline-none transition placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:ring-4 focus:ring-[#1E3A5F]/10"
                    placeholder="Votre mot de passe"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#EEF3F8] hover:text-[#1E3A5F]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-base font-bold text-white shadow-[0_12px_24px_rgba(30,58,95,0.22)] transition hover:bg-[#172D49] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
                {!loading && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="mx-auto mt-2 text-sm font-bold text-[#1E3A5F] transition hover:text-[#172D49] hover:underline"
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


