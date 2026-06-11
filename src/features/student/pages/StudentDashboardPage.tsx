import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, Target, CheckCircle2, AlertCircle, ArrowRight, FileText, MessageSquare } from 'lucide-react';
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
    return <div className="flex flex-1 items-center justify-center bg-[#faf9f6] text-sm font-medium text-[#7f7664]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>Loading data...</div>;
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
  const timelineLightness = Math.max(28, 70 - timelineProgress * 0.4);
  const timelineBarColor = `hsl(36, 60%, ${timelineLightness}%)`;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentCompletedTasks = (data?.completedTasks || []).filter((task) => {
    const dateStr = task.updated_at || task.created_at;
    if (!dateStr) return true;
    return new Date(dateStr) >= threeDaysAgo;
  });

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
                  ? 'Validated'
                  : data.iteration.statut === 'EN_COURS'
                    ? 'In progress'
                    : data.iteration.statut}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#7f7664]">Welcome back! Here is what is happening in your current iteration.</p>
        </div>
        {data?.project?.deadline_globale && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-1.5 ${daysRemaining > 0 ? 'border-transparent bg-[#ffd464]/20' : 'border-transparent bg-[#ffdad6]'}`}>
            <div className="text-right">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${daysRemaining > 0 ? 'text-[#765b00]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? "Project Ends In" : "Project Status"}
              </p>
              <p className={`text-base font-bold ${daysRemaining > 0 ? 'text-[#594400]' : 'text-[#ba1a1a]'}`}>
                {daysRemaining > 0 ? `${daysRemaining} Days` : "Ended"}
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
                  {data?.iteration?.objectif || "No objective defined for this iteration."}
                </h2>
                <p className="mb-4 max-w-xl text-xs text-white/70">
                  Defined by {data?.supervisor ? `Prof. ${data.supervisor.prenom} ${data.supervisor.nom}` : "your supervisor"}. Focus on delivering the expected results on time.
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
            className="mb-6 h-[190px] flex flex-col rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition hover:border-[#ebc254]"
            type="button"
            onClick={() => navigate('/tasks')}
          >
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 shrink-0">
              <CheckCircle2 className="text-green-500" size={16} />
              Completed Tasks
            </h3>
            <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1 w-full flex-1">
              {recentCompletedTasks.length === 0 ? (
                <p className="text-xs text-[#7f7664]">No tasks completed recently.</p>
              ) : (
                recentCompletedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 rounded-2xl border border-transparent bg-[#f4f3f1] p-2.5 w-full shrink-0 transition-colors hover:border-[#d1c5b0]">
                    <div className="min-w-[8px] h-2 w-2 rounded-full bg-[#22C55E]"></div>
                    <span className="line-clamp-1 text-xs font-medium text-[#4d4636] flex-1">{task.titre}</span>
                  </div>
                ))
              )}
            </div>
          </button>

          <button
            className="mb-6 h-[190px] flex flex-col rounded-2xl border border-transparent bg-white p-5 text-left shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition hover:border-[#ebc254]"
            type="button"
            onClick={() => navigate('/deliverables')}
          >
            <div className="mb-4 shrink-0">
              <h3 className="mb-3 text-sm font-bold flex items-center gap-2 text-[#1a1c1a]">
                <FileText className="text-[#765b00]" size={16} />
                Deliverables (iteration)
              </h3>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                <span className="rounded-md bg-[#dcfce7] px-2 py-1 text-[#166534]">Validated {validatedDeliverables}</span>
                <span className="rounded-md bg-[#fff4cc] px-2 py-1 text-[#765b00]">Pending {pendingDeliverables}</span>
                {lateDeliverables > 0 && <span className="rounded-md bg-[#fde68a] px-2 py-1 text-[#92400e]">Late {lateDeliverables}</span>}
                {rejectedDeliverables > 0 && <span className="rounded-md bg-[#ffdad6] px-2 py-1 text-[#ba1a1a]">Rejected {rejectedDeliverables}</span>}
              </div>
            </div>

            {data?.newCommentsCount !== undefined && data.newCommentsCount > 0 && (
              <div className="mt-auto pt-3 border-t border-[#f4f3f1] w-full shrink-0">
                <div className="flex items-center gap-2">
                   <MessageSquare size={14} className="text-[#765b00]" />
                   <span className="text-[10px] font-bold text-[#1a1c1a] uppercase tracking-widest">
                     {data.newCommentsCount === 1 ? 'New comment' : 'New comments'}
                   </span>
                   <span className="ml-auto rounded-full bg-[#ffd464] px-2 py-0.5 text-[10px] font-bold text-[#765b00]">
                     {data.newCommentsCount}
                   </span>
                </div>
              </div>
            )}
          </button>

          <div className="mb-4 flex h-auto flex-col justify-between rounded-[1.5rem] border border-[#9a7b16]/30 bg-[#7b6100] p-4 text-white shadow-[0_16px_40px_rgba(95,71,0,0.28)]">
            <div>
              <h3 className="mb-4 text-xs font-light tracking-tight text-white/95">Supervisor</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#f1c57a]/35 bg-[#f59ac2] text-lg font-semibold text-black shadow-[0_6px_18px_rgba(0,0,0,0.14)]">
                  {`${data?.supervisor?.prenom?.[0] || ''}${data?.supervisor?.nom?.[0] || ''}` || 'KA'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight text-white">Prof. {data?.supervisor?.prenom} {data?.supervisor?.nom}</p>
                  <p className="mt-0.5 text-xs font-light text-white/80">Software Engineering</p>
                </div>
              </div>
            </div>

            <button
              className="mt-6 rounded-2xl border border-[#f1c57a]/20 bg-[#8c6d00]/45 py-2.5 text-sm font-semibold text-white shadow-inner shadow-white/5 transition hover:bg-[#9a7900]/55"
              onClick={handleSendMessage}
              type="button"
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
            <span>{data?.project?.date_debut ? new Date(data.project.date_debut).toLocaleDateString() : 'N/A'}</span>
            <span>{data?.project?.deadline_globale ? new Date(data.project.deadline_globale).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
