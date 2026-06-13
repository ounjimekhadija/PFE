import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, FileText, MessageSquare, Plus, Settings, Target, Upload, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface DashboardData {
  project: {
    date_debut: string | null;
    deadline_globale: string | null;
  } | null;
  iteration: any;
  supervisor: any;
  completedTasks: any[];
  pendingTasks: any[];
  totalTasks: number;
  iterationDeliverables: DashboardDeliverable[];
  newCommentsCount: number;
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

        if (studentError || !student?.projet_id) throw new Error("Project not found.");

        const { data: project } = await supabase
          .from('projets')
          .select('encadrant_id, date_debut, deadline_globale')
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
        let newCommentsCount = 0;

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
              title: item.titre || 'Deliverable',
              type: item.type_document || 'DOC',
              createdAt: item.created_at,
              status: item.statut || 'PENDING',
            }));

            const livrableIds = livrables.map((l: any) => String(l.id));
            if (livrableIds.length > 0) {
              const threeDaysAgo = new Date();
              threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

              const { count, error: countErr } = await supabase
                .from('livrable_commentaires')
                .select('*', { count: 'exact', head: true })
                .in('livrable_id', livrableIds)
                .gte('created_at', threeDaysAgo.toISOString());

              if (!countErr && count !== null) {
                newCommentsCount = count;
              }
            }
          }
        }

        setData({
          project: project ? {
            date_debut: project.date_debut ?? null,
            deadline_globale: project.deadline_globale ?? null,
          } : null,
          iteration,
          supervisor,
          completedTasks,
          pendingTasks,
          totalTasks,
          iterationDeliverables,
          newCommentsCount,
        });
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
    return <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#64748B]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>Chargement du tableau de bord...</div>;
  }

  const completedCount = data?.completedTasks.length || 0;
  const percentage = data?.totalTasks ? Math.round((completedCount / data.totalTasks) * 100) : 0;
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
  if (data?.project?.deadline_globale) {
    const end = new Date(data.project.deadline_globale).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  let timelineProgress = 0;
  if (data?.project?.date_debut && data?.project?.deadline_globale) {
    const startMs = new Date(data.project.date_debut).getTime();
    const endMs = new Date(data.project.deadline_globale).getTime();
    const nowMs = Date.now();
    if (endMs > startMs) {
      timelineProgress = Math.round(((nowMs - startMs) / (endMs - startMs)) * 100);
      if (timelineProgress < 0) timelineProgress = 0;
      if (timelineProgress > 100) timelineProgress = 100;
    }
  }
  const timelineBarColor = '#1E3A5F';

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentCompletedTasks = (data?.completedTasks || []).filter((task) => {
    const dateStr = task.updated_at || task.created_at;
    if (!dateStr) return true;
    return new Date(dateStr) >= threeDaysAgo;
  });

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Bonjour Ahmed !</h1>
            {data?.iteration?.statut && (
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  data.iteration.statut === 'VALIDE'
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : data.iteration.statut === 'EN_COURS'
                      ? 'bg-[#DCEBFA] text-[#1E3A5F]'
                      : 'bg-[#e5e7eb] text-[#4b5563]'
                }`}
              >
                {data.iteration.statut === 'VALIDE'
                  ? 'Validee'
                  : data.iteration.statut === 'EN_COURS'
                    ? 'En cours'
                    : data.iteration.statut}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#64748B]">Voici un apercu de l'avancement de votre projet.</p>
        </div>
        <button
          type="button"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DCEBFA] bg-white px-4 text-sm font-bold text-[#172D49] shadow-sm transition hover:bg-[#EEF3F8]"
        >
          <Settings size={16} />
          Personnaliser
        </button>
      </header>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <section className="relative h-full overflow-hidden rounded-2xl border border-[#1E3A5F]/10 bg-[#1E3A5F] p-6 text-white shadow-[0_4px_16px_rgba(15,23,42,0.16)]">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="text-[#DCEBFA]" size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/70">Objectif de l'iteration en cours</span>
                </div>
                <h2 className="mb-2 text-3xl font-extrabold leading-tight text-white">
                  {data?.iteration?.objectif || "Aucun objectif defini pour cette iteration."}
                </h2>
                <p className="mb-4 max-w-xl text-xs text-white/70">
                  Definie par {data?.supervisor ? `Prof. ${data.supervisor.prenom} ${data.supervisor.nom}` : "votre encadrant"}. Concentrez-vous sur les livrables attendus et les echeances.
                </p>
              </div>
              <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-white/5 blur-3xl"></div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="mb-6 h-full rounded-2xl border border-transparent bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
              <h3 className="mb-3 text-sm font-bold text-[#1a1c1a]">Progression de l'iteration</h3>
              <div className="relative h-28 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#C8D6E5]" />
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.327} strokeDashoffset={(251.327 * (100 - percentage)) / 100} strokeLinecap="round" className="text-[#1E3A5F] transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-[#1a1c1a]">{percentage}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Termine</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B]">Taches terminees</span>
                  <span className="font-bold">{completedCount}/{data?.totalTasks || 0}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B]">Jours restants</span>
                  <span className="font-bold text-[#ba1a1a]">{daysRemaining} jours</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <button
            className="mb-6 h-[190px] flex flex-col rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition hover:border-[#BFD7EF]"
            type="button"
            onClick={() => navigate('/tasks')}
          >
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 shrink-0">
              <CheckCircle2 className="text-green-500" size={16} />
              Taches terminees
            </h3>
            <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1 w-full flex-1">
              {recentCompletedTasks.length === 0 ? (
                <p className="text-xs text-[#64748B]">Aucune tache terminee recemment.</p>
              ) : (
                recentCompletedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 rounded-2xl border border-transparent bg-[#EEF3F8] p-2.5 w-full shrink-0 transition-colors hover:border-[#C8D6E5]">
                    <div className="min-w-[8px] h-2 w-2 rounded-full bg-[#22C55E]"></div>
                    <span className="line-clamp-1 text-xs font-medium text-[#334155] flex-1">{task.titre}</span>
                  </div>
                ))
              )}
            </div>
          </button>

          <button
            className="mb-6 h-[190px] flex flex-col rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition hover:border-[#BFD7EF]"
            type="button"
            onClick={() => navigate('/deliverables')}
          >
            <div className="mb-4 shrink-0">
              <h3 className="mb-3 text-sm font-bold flex items-center gap-2 text-[#1a1c1a]">
                <FileText className="text-[#1E3A5F]" size={16} />
                Livrables de l'iteration
              </h3>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                <span className="rounded-md bg-[#dcfce7] px-2 py-1 text-[#166534]">Valides {validatedDeliverables}</span>
                <span className="rounded-md bg-[#fff4cc] px-2 py-1 text-[#1E3A5F]">En attente {pendingDeliverables}</span>
                {lateDeliverables > 0 && <span className="rounded-md bg-[#fde68a] px-2 py-1 text-[#92400e]">En retard {lateDeliverables}</span>}
                {rejectedDeliverables > 0 && <span className="rounded-md bg-[#ffdad6] px-2 py-1 text-[#ba1a1a]">Rejetes {rejectedDeliverables}</span>}
              </div>
            </div>

            {data?.newCommentsCount !== undefined && data.newCommentsCount > 0 && (
              <div className="mt-auto pt-3 border-t border-[#EEF3F8] w-full shrink-0">
                <div className="flex items-center gap-2">
                   <MessageSquare size={14} className="text-[#1E3A5F]" />
                   <span className="text-[10px] font-bold text-[#1a1c1a] uppercase tracking-widest">
                     {data.newCommentsCount === 1 ? 'Nouveau commentaire' : 'Nouveaux commentaires'}
                   </span>
                   <span className="ml-auto rounded-full bg-[#DCEBFA] px-2 py-0.5 text-[10px] font-bold text-[#1E3A5F]">
                     {data.newCommentsCount}
                   </span>
                </div>
              </div>
            )}
          </button>

          <div className="mb-4 flex h-auto flex-col justify-between rounded-2xl border border-[#1E3A5F]/10 bg-[#1E3A5F] p-4 text-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
            <div>
              <h3 className="mb-4 text-xs font-light tracking-tight text-white/95">Encadrant</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[#DCEBFA] text-lg font-semibold text-[#1E3A5F] shadow-[0_6px_18px_rgba(15,23,42,0.14)]">
                  {`${data?.supervisor?.prenom?.[0] || ''}${data?.supervisor?.nom?.[0] || ''}` || 'KA'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight text-white">Prof. {data?.supervisor?.prenom} {data?.supervisor?.nom}</p>
                  <p className="mt-0.5 text-xs font-light text-white/80">Encadrement PFE</p>
                </div>
              </div>
            </div>

            <button
              className="mt-6 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-semibold text-white shadow-inner shadow-white/5 transition hover:bg-white/15"
              onClick={handleSendMessage}
              type="button"
            >
              Envoyer un message
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Chronologie</p>
            <span className="text-xs font-bold text-[#1a1c1a]">{timelineProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#DCEBFA] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${timelineProgress}%`, backgroundColor: timelineBarColor }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
            <span>{data?.project?.date_debut ? new Date(data.project.date_debut).toLocaleDateString() : 'N/A'}</span>
            <span>{data?.project?.deadline_globale ? new Date(data.project.deadline_globale).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
