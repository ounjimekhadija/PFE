import React, { useState } from 'react';
import { Mail, Lock, Github, Facebook, Chrome, GraduationCap, UserCog, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../../../shared/types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(role);
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
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-transparent rounded-none py-4 px-2 text-white placeholder-white/80 text-base font-medium focus:outline-none focus:ring-0 shadow-none border-b border-white/40 focus:border-white transition-all"
            placeholder="User name"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent rounded-none py-4 px-2 text-white placeholder-white/80 text-base font-medium focus:outline-none focus:ring-0 shadow-none border-b border-white/40 focus:border-white transition-all"
            placeholder="Password"
            required
          />
          <button
            type="submit"
            className="w-1/2 mx-auto bg-white text-black font-bold py-3 rounded-full text-lg shadow-lg hover:bg-pink-100 transition-all"
          >
            Login
          </button>
        </form>
        <div className="w-full flex flex-col items-center mt-6 gap-2">
          <span className="text-white/80 text-sm">
            Forgot Password? <button className="underline hover:text-white ml-1">Click Here</button>
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
