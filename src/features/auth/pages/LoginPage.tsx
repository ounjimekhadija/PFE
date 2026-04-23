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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-800 to-black relative overflow-hidden">
      {/* Blurred circles for background */}
      <div className="absolute w-[600px] h-[600px] bg-blue-700/40 rounded-full opacity-40 blur-3xl top-[-200px] left-[-200px] z-0"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-400/40 rounded-full opacity-40 blur-3xl bottom-[-100px] right-[-100px] z-0"></div>
      <div className="absolute w-[200px] h-[200px] bg-black/40 rounded-full opacity-30 blur-2xl top-20 right-32 z-0"></div>
      <div className="absolute w-[120px] h-[120px] bg-white/20 rounded-xl opacity-20 blur-2xl top-32 left-1/2 z-0"></div>

      {/* Blurred translucent squares for glassmorphism effect, plus variés et nombreux */}
      <div className="absolute w-28 h-28 bg-blue-200/30 rounded-3xl backdrop-blur-md top-8 left-1/4 z-10 shadow-xl"></div>
      <div className="absolute w-12 h-12 bg-blue-100/30 rounded-3xl backdrop-blur-md top-1/2 left-32 z-10 shadow-xl"></div>
      <div className="absolute w-24 h-24 bg-white/20 rounded-3xl backdrop-blur-md bottom-16 right-24 z-10 shadow-xl"></div>
      <div className="absolute w-16 h-16 bg-blue-300/30 rounded-3xl backdrop-blur-md top-20 right-16 z-10 shadow-xl"></div>
      <div className="absolute w-10 h-10 bg-white/20 rounded-3xl backdrop-blur-md bottom-24 left-1/3 z-10 shadow-xl"></div>
      {/* Petits carrés ronds */}
      <div className="absolute w-8 h-8 bg-blue-100/20 rounded-full backdrop-blur-md top-40 left-10 z-10 shadow-lg"></div>
      <div className="absolute w-6 h-6 bg-blue-200/20 rounded-full backdrop-blur-md bottom-40 right-10 z-10 shadow-lg"></div>
      <div className="absolute w-10 h-10 bg-white/10 rounded-full backdrop-blur-md top-1/3 right-1/4 z-10 shadow-lg"></div>
      <div className="absolute w-14 h-14 bg-blue-100/20 rounded-full backdrop-blur-md bottom-1/4 left-1/5 z-10 shadow-lg"></div>
      {/* Carrés bleutés pour effet varié */}
      <div className="absolute w-20 h-20 bg-blue-400/40 rounded-3xl backdrop-blur-md bottom-10 right-40 z-10 shadow-xl"></div>
      <div className="absolute w-10 h-10 bg-blue-900/40 rounded-3xl backdrop-blur-md bottom-8 right-20 z-10 shadow-xl"></div>
      <div className="absolute w-16 h-16 bg-blue-800/30 rounded-3xl backdrop-blur-md top-10 right-1/5 z-10 shadow-xl"></div>
      {/* Autres tailles et positions */}
      <div className="absolute w-14 h-14 bg-white/30 rounded-3xl backdrop-blur-md top-1/4 left-10 z-10 shadow-xl"></div>
      <div className="absolute w-7 h-7 bg-white/30 rounded-3xl backdrop-blur-md bottom-1/3 left-1/6 z-10 shadow-xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl p-16 flex flex-col items-center border border-white/30"
      >
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Login Form</h1>
        <div className="w-16 h-1 bg-white/80 rounded-full mb-8 mx-auto"></div>

        {/* Role Selector */}
        <div className="flex gap-3 mb-8 w-full">
          {[
            { id: 'student', icon: GraduationCap, label: 'Student' },
            { id: 'professor', icon: UserCog, label: 'Professor' },
            { id: 'admin', icon: ShieldCheck, label: 'Admin' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id as UserRole)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider ${
                role === r.id
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
              }`}
            >
              <r.icon size={18} />
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          {error && <div className="text-red-300 text-sm text-center font-semibold bg-red-900/40 p-2 border border-red-500/50 rounded-lg">{error}</div>}
          {info && <div className="text-green-200 text-sm text-center font-semibold bg-green-900/30 p-2 border border-green-500/40 rounded-lg">{info}</div>}
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-transparent rounded-none py-4 px-2 text-white placeholder-white/80 text-base font-medium focus:outline-none focus:ring-0 shadow-none border-b border-white/40 focus:border-white transition-all"
            placeholder="Adresse email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent rounded-none py-4 px-2 text-white placeholder-white/80 text-base font-medium focus:outline-none focus:ring-0 shadow-none border-b border-white/40 focus:border-white transition-all"
            placeholder="Mot de passe"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-1/2 mx-auto bg-white text-black font-bold py-3 px-6 rounded-full text-lg shadow-lg hover:bg-pink-100 transition-all disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Login'}
          </button>
        </form>
        <div className="w-full flex flex-col items-center mt-6 gap-2">
          <span className="text-white/80 text-sm">
            Forgot Password? <button type="button" onClick={handleForgotPassword} className="underline hover:text-white ml-1">Click Here</button>
          </span>
          <span className="text-white/80 text-sm">
            Don’t have an account ? <button className="underline hover:text-white ml-1">Sign up</button>
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
