import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, Target, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface DashboardData {
  iteration: any;
  supervisor: any;
  completedTasks: any[];
  pendingTasks: any[];
  totalTasks: number;
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: student, error: studentError } = await supabase
          .from('etudiants')
          .select('projet_id')
          .eq('id', user.id)
          .single();

        if (studentError || !student?.projet_id) throw new Error("Projet non trouvé.");

        const { data: project } = await supabase
          .from('projets')
          .select('encadrant_id')
          .eq('id', student.projet_id)
          .single();

        let supervisor = null;
        if (project?.encadrant_id) {
          const { data: prof } = await supabase
            .from('utilisateurs')
            .select('nom, prenom')
            .eq('id', project.encadrant_id)
            .single();
          supervisor = prof;
        }

        const { data: iterRows } = await supabase
          .from('iterations')
          .select('*')
          .eq('projet_id', student.projet_id)
          .order('date_debut', { ascending: false });

        // Pick EN_COURS first, then A_FAIRE, then VALIDE
        const priority = ['EN_COURS', 'A_FAIRE', 'VALIDE'];
        const iteration = iterRows?.sort((a, b) => {
          const ai = priority.indexOf(a.statut);
          const bi = priority.indexOf(b.statut);
          if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          return new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime();
        })[0] ?? null;

        let completedTasks: any[] = [];
        let pendingTasks: any[] = [];
        let totalTasks = 0;

        if (iteration) {
          const { data: tasks } = await supabase
            .from('taches')
            .select('*')
            .eq('iteration_id', iteration.id);

          if (tasks) {
            completedTasks = tasks.filter(t => t.etat === 'TERMINE');
            pendingTasks = tasks.filter(t => t.etat !== 'TERMINE');
            totalTasks = tasks.length;
          }
        }

        setData({ iteration, supervisor, completedTasks, pendingTasks, totalTasks });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleSendMessage = () => {
    navigate('/chat?user=prof.ahmed.alami');
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center bg-[#faf9f6] text-sm font-medium text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>Chargement des donnees...</div>;
  }

  const completedCount = data?.completedTasks.length || 0;
  const percentage = data?.totalTasks ? Math.round((completedCount / data.totalTasks) * 100) : 0;
  const strokeDashoffset = 440 - (440 * percentage) / 100;

  let daysRemaining = 0;
  if (data?.iteration?.date_fin) {
    const end = new Date(data.iteration.date_fin).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1c1a]">Student Dashboard</h1>
          <p className="mt-1 text-sm text-[#7f7664]">Welcome back! Here is what is happening in your current iteration.</p>
        </div>
        {data?.iteration?.date_fin && (
          <div className={`flex items-center gap-4 rounded-2xl border px-6 py-3 ${daysRemaining > 0 ? 'border-[#ebc254] bg-[#ffd464]/20' : 'border-[#fecaca] bg-[#ffdad6]'}`}>
            <div className="text-right">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${daysRemaining > 0 ? 'text-[#765b00]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? "Iteration Ends In" : "Iteration Status"}
              </p>
              <p className={`text-xl font-bold ${daysRemaining > 0 ? 'text-[#594400]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? `${daysRemaining} Days` : "Terminée"}
              </p>
            </div>
            <Clock className={daysRemaining > 0 ? "text-[#594400]" : "text-[#ba1a1a]"} size={24} />
          </div>
        )}
      </header>

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <section className="relative h-full overflow-hidden rounded-2xl border border-[#d1c5b0] bg-white p-10 text-[#1a1c1a] shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Target className="text-[#765b00]" size={24} />
                  <span className="text-sm font-bold uppercase tracking-widest text-[#7f7664]">Current Objective</span>
                </div>
                <h2 className="mb-4 text-4xl font-bold leading-tight text-[#1a1c1a]">
                  {data?.iteration?.objectif || "Aucun objectif défini pour cette itération."}
                </h2>
                <p className="mb-8 max-w-xl text-[#7f7664]">
                  Defined by {data?.supervisor ? `Prof. ${data.supervisor.prenom} ${data.supervisor.nom}` : "votre encadrant"}. Focus on delivering the expected results on time.
                </p>
              </div>
              <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#765b00]/8 blur-3xl"></div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="mb-6 h-full rounded-2xl border border-[#d1c5b0] bg-white p-8 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
              <h3 className="mb-6 text-lg font-bold text-[#1a1c1a]">Iteration Progress</h3>
              <div className="relative h-48 flex items-center justify-center">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-[#d1c5b0]" />
                  <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-[#765b00] transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-[#1a1c1a]">{percentage}%</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#7f7664]">Done</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7f7664]">Tasks Completed</span>
                  <span className="font-bold">{completedCount}/{data?.totalTasks || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7f7664]">Days Remaining</span>
                  <span className="font-bold text-[#ba1a1a]">{daysRemaining} Days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="mb-6 rounded-2xl border border-[#d1c5b0] bg-white p-8 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={20} />
              Completed Tasks
            </h3>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {data?.completedTasks.length === 0 ? (
                <p className="text-sm text-[#7f7664]">Aucune tache terminee.</p>
              ) : (
                data?.completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-[#d1c5b0] bg-[#f4f3f1] p-4">
                    <div className="min-w-[8px] h-2 w-2 rounded-full bg-[#22C55E]"></div>
                    <span className="line-clamp-1 text-sm font-medium text-[#4d4636]">{task.titre}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-[#d1c5b0] bg-white p-8 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <AlertCircle className="text-amber-500" size={20} />
              Pending Actions
            </h3>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {data?.pendingTasks.length === 0 ? (
                <p className="text-sm text-[#7f7664]">Aucune tache en attente.</p>
              ) : (
                data?.pendingTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="group flex cursor-pointer items-center justify-between rounded-2xl border border-[#d1c5b0] bg-[#f4f3f1] p-4 transition-all hover:border-[#ebc254]">
                    <span className="mr-2 line-clamp-1 text-sm font-medium text-[#4d4636]">{task.titre}</span>
                    <ArrowRight size={16} className="shrink-0 text-[#7f7664] transition-all group-hover:text-[#765b00]" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mb-6 flex h-full flex-col justify-between rounded-2xl border border-[#ebc254] bg-[#765b00] p-8 text-white shadow-[0_4px_16px_rgba(118,91,0,0.25)]">
            <div>
              <h3 className="text-lg font-bold mb-6">Supervisor</h3>
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={`https://ui-avatars.com/api/?name=${data?.supervisor?.prenom}+${data?.supervisor?.nom}&background=random`}
                  alt="Prof"
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20"
                />
                <div>
                  <p className="font-bold">Prof. {data?.supervisor?.prenom} {data?.supervisor?.nom}</p>
                  <p className="text-xs text-white/70">Software Engineering</p>
                </div>
              </div>
            </div>
            <button
              className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-sm transition-all"
              onClick={handleSendMessage}
            >
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
