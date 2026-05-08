import React, { useState } from 'react';
import { Mail, Lock, Github, Facebook, Chrome, GraduationCap, UserCog, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../../../shared/types';
import { supabase } from '../../../lib/supabase';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
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
        throw new Error('Veuillez saisir un email et un mot de passe.');
      }

      // 1. Connexion via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: userPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Récupérer le rôle de l'utilisateur depuis la table utilisateurs
        const { data: userData, error: userError } = await supabase
          .from('utilisateurs')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (userError) throw userError;

        // Mapper le rôle Supabase (ADMINISTRATEUR, ENCADRANT, ETUDIANT) vers nos UserRoles internes
        const userRole = mapDbRoleToUserRole(userData.role);

        if (userRole !== role) {
          await supabase.auth.signOut();
          throw new Error("Le rôle sélectionné ne correspond pas à ce compte.");
        }
        
        // 3. Déclencher onLogin avec le vrai rôle
        onLogin(userRole);
      }
    } catch (err: any) {
      console.error('Erreur de connexion:', err);
      const message = err?.message || 'Identifiants incorrects';
      if (message.toLowerCase().includes('invalid login credentials')) {
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
          if (existingUser.role === 'ENCADRANT') {
            setError("Compte encadrant trouvé. Mot de passe incorrect. Utilisez 'Forgot Password' pour réinitialiser.");
          } else {
            setError("Compte trouvé. Mot de passe incorrect ou compte Auth non synchronisé. Utilisez 'Forgot Password'.");
          }
        } else {
          setError("Email ou mot de passe incorrect. Si le problème persiste, utilisez 'Forgot Password'.");
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
      setError('Saisissez d\'abord votre email, puis cliquez sur Forgot Password.');
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) throw resetError;
      setInfo('Email de réinitialisation envoyé. Vérifiez votre boîte mail.');
    } catch (err: any) {
      setError(err?.message || 'Impossible d\'envoyer l\'email de réinitialisation.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-warm-surface relative overflow-hidden">
      {/* Background texture and gradients */}
      <div
        className="absolute inset-0 opacity-50"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d1c5b0\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
      ></div>
      <div className="absolute top-[-20%] left-[-20%] w-2/5 h-2/5 bg-gradient-radial from-warm-primary-container/40 to-transparent to-70% animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-2/5 h-2/5 bg-gradient-radial from-warm-tertiary-container/40 to-transparent to-70% animate-pulse-slow"></div>

      {/* Decorative shapes */}
      <div className="absolute w-28 h-28 bg-warm-primary-container/30 rounded-3xl backdrop-blur-sm top-8 left-1/4 z-10 shadow-lg animate-spin-slow"></div>
      <div className="absolute w-24 h-24 bg-warm-secondary-container/20 rounded-2xl backdrop-blur-md bottom-16 right-24 z-10 shadow-xl"></div>
      <div className="absolute w-16 h-16 bg-warm-primary/20 rounded-full backdrop-blur-sm top-20 right-16 z-10 shadow-lg animate-pulse"></div>
      <div className="absolute w-14 h-14 bg-warm-surface-container/40 rounded-xl backdrop-blur-sm top-1/4 left-10 z-10 shadow-md"></div>
      {/* More rounded squares */}
      <div className="absolute w-20 h-20 bg-warm-tertiary-container/20 rounded-2xl backdrop-blur-lg top-1/2 right-1/3 z-10 shadow-lg animate-pulse"></div>
      <div className="absolute w-12 h-12 bg-warm-primary-container/20 rounded-full backdrop-blur-sm bottom-10 left-1/3 z-10 shadow-md animate-spin-slow"></div>
      <div className="absolute w-32 h-32 bg-warm-secondary-container/10 rounded-3xl backdrop-blur-xl bottom-[-50px] left-[-50px] z-10 shadow-2xl"></div>
      <div className="absolute w-16 h-16 bg-warm-primary/10 rounded-2xl backdrop-blur-md top-[-30px] right-1/4 z-10 shadow-lg"></div>
      <div className="absolute w-8 h-8 bg-warm-tertiary-container/30 rounded-full backdrop-blur-sm bottom-20 right-10 z-10 shadow-sm animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-xl bg-warm-surface-container-lowest/70 backdrop-blur-2xl rounded-3xl shadow-2xl p-16 flex flex-col items-center border border-warm-surface-container-high/30 shadow-warm-secondary/10"
      >
        <div className="absolute inset-0 rounded-3xl shadow-inner-lg shadow-warm-surface-container-high/50 pointer-events-none"></div>
        <h1 className="text-4xl font-bold text-warm-on-surface mb-2 text-center font-jakarta">Login Form</h1>
        <div className="w-20 h-1.5 bg-warm-primary rounded-full mb-10 mx-auto"></div>

        {/* Role Selector */}
        <div className="flex gap-4 mb-10 w-full">
          {[
            { id: 'student', icon: GraduationCap, label: 'Student' },
            { id: 'professor', icon: UserCog, label: 'Professor' },
            { id: 'admin', icon: ShieldCheck, label: 'Admin' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id as UserRole)}
              className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-300 text-sm font-bold uppercase tracking-wider shadow-md hover:shadow-xl hover:-translate-y-1 ${
                role === r.id
                  ? 'bg-warm-secondary text-warm-on-secondary border-warm-secondary/80 shadow-warm-secondary/30'
                  : 'bg-warm-surface-container text-warm-on-surface-variant border-warm-surface-container-high hover:bg-warm-surface-container-high'
              }`}
            >
              <r.icon size={20} />
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
          {error && <div className="text-warm-on-error text-sm text-center font-semibold bg-warm-error-container/80 p-3 border border-warm-error/50 rounded-lg">{error}</div>}
          {info && <div className="text-green-800 text-sm text-center font-semibold bg-green-200/80 p-3 border border-green-500/40 rounded-lg">{info}</div>}
          <div className="relative">
            <input
              type="email"
              id="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="peer w-full bg-warm-surface-container rounded-lg py-4 px-4 text-warm-on-surface placeholder-transparent text-base font-medium focus:outline-none transition-all"
              placeholder="Adresse email"
              required
            />
            <label
              htmlFor="email"
              className={`absolute left-4 pointer-events-none transition-all duration-300 
                ${username ? 'text-sm -top-3.5 text-warm-primary' : 'text-base top-4 text-warm-on-surface-variant/80'}
                peer-focus:text-sm peer-focus:-top-3.5 peer-focus:text-warm-primary`}
            >
              Adresse email
            </label>
          </div>
          <div className="relative">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer w-full bg-warm-surface-container rounded-lg py-4 px-4 text-warm-on-surface placeholder-transparent text-base font-medium focus:outline-none transition-all"
              placeholder="Mot de passe"
              required
            />
            <label
              htmlFor="password"
              className={`absolute left-4 pointer-events-none transition-all duration-300 
                ${password ? 'text-sm -top-3.5 text-warm-primary' : 'text-base top-4 text-warm-on-surface-variant/80'}
                peer-focus:text-sm peer-focus:-top-3.5 peer-focus:text-warm-primary`}
            >
              Mot de passe
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-warm-primary text-warm-on-primary font-bold py-4 px-6 rounded-xl text-lg shadow-lg shadow-warm-primary/30 hover:bg-warm-primary-dim transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:-translate-y-1"
          >
            {loading ? 'Connexion...' : 'Login'}
          </button>
        </form>
        
      </motion.div>
    </div>
  );
};

export default Login;
