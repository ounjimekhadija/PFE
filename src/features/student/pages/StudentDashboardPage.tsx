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
  iterationDeliverables: DashboardDeliverable[];
}

interface DashboardDeliverable {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  status: string;
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
        let iterationDeliverables: DashboardDeliverable[] = [];

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

          const { data: livrables, error: livrablesError } = await supabase
            .from('livrables')
            .select('id, titre, type_document, created_at, statut')
            .eq('projet_id', student.projet_id)
            .order('created_at', { ascending: false });

          if (livrablesError) {
            console.error('Error fetching deliverables:', livrablesError);
          } else if (livrables) {
            iterationDeliverables = livrables.map((item: any) => ({
              id: String(item.id),
              title: item.titre || 'Livrable',
              type: item.type_document || 'DOC',
              createdAt: item.created_at,
              status: item.statut || 'PENDING',
            }));
          }
        }

        setData({ iteration, supervisor, completedTasks, pendingTasks, totalTasks, iterationDeliverables });
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
  const normalizeDeliverableStatus = (status: string) => {
    const s = (status || '').trim().toUpperCase();
    if (s === 'VALIDE') return 'VALIDATED';
    if (s === 'REJETE') return 'REJECTED';
    return s;
  };

  const validatedDeliverables = (data?.iterationDeliverables || []).filter((item) =>
    normalizeDeliverableStatus(item.status) === 'VALIDATED'
  ).length;
  const pendingDeliverables = (data?.iterationDeliverables || []).filter((item) =>
    normalizeDeliverableStatus(item.status) === 'PENDING'
  ).length;
  const lateDeliverables = (data?.iterationDeliverables || []).filter((item) =>
    normalizeDeliverableStatus(item.status) === 'LATE'
  ).length;
  const rejectedDeliverables = (data?.iterationDeliverables || []).filter((item) =>
    normalizeDeliverableStatus(item.status) === 'REJECTED'
  ).length;

  let daysRemaining = 0;
  if (data?.iteration?.date_fin) {
    const end = new Date(data.iteration.date_fin).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  let timelineProgress = 0;
  if (data?.iteration?.date_debut && data?.iteration?.date_fin) {
    const startMs = new Date(data.iteration.date_debut).getTime();
    const endMs = new Date(data.iteration.date_fin).getTime();
    const nowMs = Date.now();
    if (endMs > startMs) {
      timelineProgress = Math.round(((nowMs - startMs) / (endMs - startMs)) * 100);
      if (timelineProgress < 0) timelineProgress = 0;
      if (timelineProgress > 100) timelineProgress = 100;
    }
  }
  const timelineLightness = Math.max(28, 70 - timelineProgress * 0.4);
  const timelineBarColor = `hsl(36, 60%, ${timelineLightness}%)`;

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[#faf9f6] px-4 py-3 text-[#1a1c1a]"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <header className="mb-3 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[#1a1c1a]">Student Dashboard</h1>
            {data?.iteration?.statut && (
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  data.iteration.statut === 'VALIDE'
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : data.iteration.statut === 'EN_COURS'
                      ? 'bg-[#fff4cc] text-[#765b00]'
                      : 'bg-[#e5e7eb] text-[#4b5563]'
                }`}
              >
                {data.iteration.statut === 'VALIDE'
                  ? 'Valide'
                  : data.iteration.statut === 'EN_COURS'
                    ? 'En cours'
                    : data.iteration.statut}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#7f7664]">Welcome back! Here is what is happening in your current iteration.</p>
        </div>
        {data?.iteration?.date_fin && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-1.5 ${daysRemaining > 0 ? 'border-transparent bg-[#ffd464]/20' : 'border-transparent bg-[#ffdad6]'}`}>
            <div className="text-right">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${daysRemaining > 0 ? 'text-[#765b00]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? "Iteration Ends In" : "Iteration Status"}
              </p>
              <p className={`text-base font-bold ${daysRemaining > 0 ? 'text-[#594400]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? `${daysRemaining} Days` : "Terminée"}
              </p>
            </div>
            <Clock className={daysRemaining > 0 ? "text-[#594400]" : "text-[#ba1a1a]"} size={18} />
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <section className="relative h-full overflow-hidden rounded-2xl border border-transparent bg-[#1a1c1a] p-6 text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="text-[#ffd464]" size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/70">Current Objective</span>
                </div>
                <h2 className="mb-2 text-3xl font-extrabold leading-tight text-white">
                  {data?.iteration?.objectif || "Aucun objectif défini pour cette itération."}
                </h2>
                <p className="mb-4 max-w-xl text-xs text-white/70">
                  Defined by {data?.supervisor ? `Prof. ${data.supervisor.prenom} ${data.supervisor.nom}` : "votre encadrant"}. Focus on delivering the expected results on time.
                </p>
              </div>
              <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-white/5 blur-3xl"></div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="mb-6 h-full rounded-2xl border border-transparent bg-white p-5 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
              <h3 className="mb-3 text-sm font-bold text-[#1a1c1a]">Iteration Progress</h3>
              <div className="relative h-28 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#d1c5b0]" />
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.327} strokeDashoffset={(251.327 * (100 - percentage)) / 100} strokeLinecap="round" className="text-[#765b00] transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-[#1a1c1a]">{percentage}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Done</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#7f7664]">Tasks Completed</span>
                  <span className="font-bold">{completedCount}/{data?.totalTasks || 0}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#7f7664]">Days Remaining</span>
                  <span className="font-bold text-[#ba1a1a]">{daysRemaining} Days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <button
            className="mb-6 h-[190px] rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition hover:border-transparent"
            type="button"
            onClick={() => navigate('/tasks')}
          >
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={16} />
              Completed Tasks
            </h3>
            <div className="space-y-2.5">
              {data?.completedTasks.length === 0 ? (
                <p className="text-xs text-[#7f7664]">Aucune tache terminee.</p>
              ) : (
                data?.completedTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 rounded-2xl border border-transparent bg-[#f4f3f1] p-2.5">
                    <div className="min-w-[8px] h-2 w-2 rounded-full bg-[#22C55E]"></div>
                    <span className="line-clamp-1 text-xs font-medium text-[#4d4636]">{task.titre}</span>
                  </div>
                ))
              )}
            </div>
          </button>

          <button
            className="mb-6 rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition hover:border-transparent"
            type="button"
            onClick={() => navigate('/deliverables')}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={16} />
                Livrables (iteration)
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[#166534]">Valide {validatedDeliverables}</span>
                <span className="rounded-full bg-[#fff4cc] px-2 py-0.5 text-[#765b00]">En attente {pendingDeliverables}</span>
                <span className="rounded-full bg-[#fde68a] px-2 py-0.5 text-[#92400e]">En retard {lateDeliverables}</span>
                <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[#ba1a1a]">Rejete {rejectedDeliverables}</span>
              </div>
            </div>
          </button>

          <div className="mb-6 flex h-full flex-col justify-between rounded-2xl border border-transparent bg-[#765b00] p-5 text-white shadow-[0_4px_16px_rgba(118,91,0,0.25)]">
            <div>
              <h3 className="text-sm font-bold mb-3">Supervisor</h3>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${data?.supervisor?.prenom}+${data?.supervisor?.nom}&background=random`}
                  alt="Prof"
                  className="w-10 h-10 rounded-2xl object-cover border-2 border-white/20"
                />
                <div>
                  <p className="text-sm font-bold">Prof. {data?.supervisor?.prenom} {data?.supervisor?.nom}</p>
                  <p className="text-[10px] text-white/70">Software Engineering</p>
                </div>
              </div>
            </div>
            <button
              className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl font-bold text-xs transition-all"
              onClick={handleSendMessage}
            >
              Send Message
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7f7664]">Chronology</p>
            <span className="text-xs font-bold text-[#1a1c1a]">{timelineProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#f4f3f1] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${timelineProgress}%`, backgroundColor: timelineBarColor }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#7f7664]">
            <span>{data?.iteration?.date_debut ? new Date(data.iteration.date_debut).toLocaleDateString('fr-FR') : 'N/A'}</span>
            <span>{data?.iteration?.date_fin ? new Date(data.iteration.date_fin).toLocaleDateString('fr-FR') : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
