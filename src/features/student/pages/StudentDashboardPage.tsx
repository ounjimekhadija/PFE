import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, ListTodo, MessageSquare, Target, UserRound } from 'lucide-react';
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
  iterationLivrables: DashboardDeliverable[];
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
        let iterationLivrables: DashboardDeliverable[] = [];
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
            iterationLivrables = livrables.map((item: any) => ({
              id: String(item.id),
              title: item.titre || 'Deliverable',
              type: item.type_document || 'DOC',
              createdAt: item.created_at,
              status: item.statut || 'PENDING',
            }));

            const livrableIds = livrables.map((l: any) => String(l.id));
            if (livrableIds.length > 0) {
              const threejoursAgo = new Date();
              threejoursAgo.setDate(threejoursAgo.getDate() - 3);

              const { count, error: countErr } = await supabase
                .from('livrable_commentaires')
                .select('*', { count: 'exact', head: true })
                .in('livrable_id', livrableIds)
                .gte('created_at', threejoursAgo.toISOString());

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
          iterationLivrables,
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
  const normalizeDeliverableStatut = (status: string) => {
    const s = (status || '').trim().toUpperCase();
    if (s === 'VALIDE') return 'VALIDATED';
    if (s === 'REJETE') return 'REJECTED';
    return s;
  };

  const validatedLivrables = (data?.iterationLivrables || []).filter((item) =>
    normalizeDeliverableStatut(item.status) === 'VALIDATED'
  ).length;
  const pendingLivrables = (data?.iterationLivrables || []).filter((item) =>
    normalizeDeliverableStatut(item.status) === 'PENDING'
  ).length;
  const lateLivrables = (data?.iterationLivrables || []).filter((item) =>
    normalizeDeliverableStatut(item.status) === 'LATE'
  ).length;
  const rejectedLivrables = (data?.iterationLivrables || []).filter((item) =>
    normalizeDeliverableStatut(item.status) === 'REJECTED'
  ).length;

  let daysRemaining = 0;
  if (data?.project?.deadline_globale) {
    const end = new Date(data.project.deadline_globale).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  let timelineProgression = 0;
  if (data?.project?.date_debut && data?.project?.deadline_globale) {
    const startMs = new Date(data.project.date_debut).getTime();
    const endMs = new Date(data.project.deadline_globale).getTime();
    const nowMs = Date.now();
    if (endMs > startMs) {
      timelineProgression = Math.round(((nowMs - startMs) / (endMs - startMs)) * 100);
      if (timelineProgression < 0) timelineProgression = 0;
      if (timelineProgression > 100) timelineProgression = 100;
    }
  }
  const timelineBarColor = '#1E3A5F';

  const threejoursAgo = new Date();
  threejoursAgo.setDate(threejoursAgo.getDate() - 3);

  const recentCompletedTasks = (data?.completedTasks || []).filter((task) => {
    const dateStr = task.updated_at || task.created_at;
    if (!dateStr) return true;
    return new Date(dateStr) >= threejoursAgo;
  });

  const pendingCount = data?.pendingTasks.length || 0;
  const deliverableCount = data?.iterationLivrables.length || 0;
  const supervisorName = data?.supervisor
    ? `Prof. ${data.supervisor.prenom || ''} ${data.supervisor.nom || ''}`.trim()
    : 'Encadrant non assigné';
  const supervisorInitials = data?.supervisor
    ? `${data.supervisor.prenom?.[0] || ''}${data.supervisor.nom?.[0] || ''}` || 'EN'
    : 'EN';
  const iterationStatut = data?.iteration?.statut || 'A_FAIRE';
  const statusLabel = iterationStatut === 'VALIDE' ? 'Validée' : iterationStatut === 'EN_COURS' ? 'En cours' : 'À faire';
  const statusClass = iterationStatut === 'VALIDE'
    ? 'bg-[#dcfce7] text-[#166534]'
    : iterationStatut === 'EN_COURS'
      ? 'bg-[#DCEBFA] text-[#1E3A5F]'
      : 'bg-[#EEF3F8] text-[#64748B]';
  const startLabel = data?.project?.date_debut ? new Date(data.project.date_debut).toLocaleDateString('fr-FR') : 'N/A';
  const endLabel = data?.project?.deadline_globale ? new Date(data.project.deadline_globale).toLocaleDateString('fr-FR') : 'N/A';

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <header className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold leading-tight text-[#1a1c1a]">Bonjour !</h1>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-[#64748B]">Votre espace de suivi pour l'itération en cours.</p>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Progression', value: `${percentage}%`, icon: Target, tone: 'text-[#1E3A5F]', bg: 'bg-[#DCEBFA]/40' },
          { label: 'Taches restantes', value: String(pendingCount), icon: ListTodo, tone: 'text-[#64748B]', bg: 'bg-[#EEF3F8]' },
          { label: 'Livrables', value: String(deliverableCount), icon: FileText, tone: 'text-[#166534]', bg: 'bg-[#dcfce7]' },
          { label: 'Jours restants', value: `${daysRemaining}j`, icon: Clock3, tone: daysRemaining <= 7 ? 'text-[#ba1a1a]' : 'text-[#1E3A5F]', bg: daysRemaining <= 7 ? 'bg-[#ffdad6]' : 'bg-[#DCEBFA]/40' },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} ${item.tone}`}>
                <item.icon size={18} />
              </div>
              <p className="text-2xl font-bold text-[#1a1c1a]">{item.value}</p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">{item.label}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.45fr_0.75fr_0.8fr]">
        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[#1E3A5F] p-5 text-white shadow-[0_8px_22px_rgba(15,23,42,0.16)]">
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-3 flex items-center gap-2">
              <Target className="text-[#DCEBFA]" size={18} />
              <span className="text-xs font-bold uppercase tracking-widest text-white/70">Objectif de l'itération</span>
            </div>
            <h2 className="line-clamp-4 text-3xl font-extrabold leading-tight text-white">
              {data?.iteration?.objectif || "Aucun objectif défini pour cette itération."}
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-white/72">
              Définie par {supervisorName}. Priorisez les tâches ouvertes et les livrables attendus avant l'échéance.
            </p>
            <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Voir les tâches <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/deliverables')}
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Livrables <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1a1c1a]">Progression</h3>
            <span className="rounded-full bg-[#DCEBFA]/60 px-2 py-1 text-xs font-bold text-[#1E3A5F]">{completedCount}/{data?.totalTasks || 0}</span>
          </div>
          <div className="relative flex flex-1 min-h-[10rem] items-center justify-center">
            <svg className="h-32 w-32 -rotate-90">
              <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-[#E5EDF5]" />
              <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={326.726} strokeDashoffset={(326.726 * (100 - percentage)) / 100} strokeLinecap="round" className="text-[#1E3A5F] transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#1a1c1a]">{percentage}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Termine</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-[#F8FAFC] p-3">
              <p className="font-bold text-[#1a1c1a]">{completedCount}</p>
              <p className="mt-1 text-[#64748B]">Terminées</p>
            </div>
            <div className="rounded-xl bg-[#F8FAFC] p-3">
              <p className="font-bold text-[#1a1c1a]">{pendingCount}</p>
              <p className="mt-1 text-[#64748B]">Ouvertes</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#1a1c1a]">Encadrant</h3>
              <p className="mt-1 text-xs text-[#64748B]">Contact principal du projet</p>
            </div>
            <UserRound size={18} className="text-[#1E3A5F]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCEBFA] text-lg font-bold text-[#1E3A5F]">
              {supervisorInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-[#1a1c1a]">{supervisorName}</p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">Encadrement PFE</p>
            </div>
          </div>
          <button
            className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] py-3 text-sm font-bold text-white transition hover:bg-[#172D49]"
            onClick={handleSendMessage}
            type="button"
          >
            <MessageSquare size={16} />
            Envoyer un message
          </button>
        </section>
      </div>

      <div className="mt-3 grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1.2fr]">
        <button
          className="flex h-40 flex-col rounded-2xl bg-white p-4 text-left shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
          type="button"
          onClick={() => navigate('/tasks')}
        >
          <h3 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-bold text-[#1a1c1a]">
            <CheckCircle2 className="text-green-500" size={16} />
            Taches terminees récemment
          </h3>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {recentCompletedTasks.length === 0 ? (
              <p className="text-xs text-[#64748B]">Aucune tâche terminee récemment.</p>
            ) : (
              recentCompletedTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] p-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                  <span className="line-clamp-1 flex-1 text-xs font-semibold text-[#334155]">{task.titre}</span>
                </div>
              ))
            )}
          </div>
        </button>

        <button
          className="flex h-40 flex-col rounded-2xl bg-white p-4 text-left shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
          type="button"
          onClick={() => navigate('/deliverables')}
        >
          <h3 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-bold text-[#1a1c1a]">
            <FileText className="text-[#1E3A5F]" size={16} />
            Livrables de l'itération
          </h3>
          <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wider">
            <span className="rounded-md bg-[#dcfce7] px-2 py-1 text-[#166534]">Valides {validatedLivrables}</span>
            <span className="rounded-md bg-[#fff4cc] px-2 py-1 text-[#1E3A5F]">En attente {pendingLivrables}</span>
            {lateLivrables > 0 && <span className="rounded-md bg-[#fde68a] px-2 py-1 text-[#92400e]">En retard {lateLivrables}</span>}
            {rejectedLivrables > 0 && <span className="rounded-md bg-[#ffdad6] px-2 py-1 text-[#ba1a1a]">Rejetes {rejectedLivrables}</span>}
          </div>
          {data?.newCommentsCount !== undefined && data.newCommentsCount > 0 && (
            <div className="mt-auto flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2">
              <MessageSquare size={14} className="text-[#1E3A5F]" />
              <span className="text-xs font-bold text-[#1a1c1a]">{data.newCommentsCount} nouveau(x) commentaire(s)</span>
            </div>
          )}
        </button>

        <section className="h-40 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Chronologie</p>
              <p className="mt-1 text-xs text-[#64748B]">{startLabel} - {endLabel}</p>
            </div>
            <span className="text-sm font-bold text-[#1E3A5F]">{timelineProgression}%</span>
          </div>
          <div className="relative mt-7 h-2 w-full overflow-hidden rounded-full bg-[#DCEBFA]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${timelineProgression}%`, backgroundColor: timelineBarColor }}
            />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: 'Debut', value: startLabel, icon: CalendarDays },
              { label: 'Restant', value: `${daysRemaining}j`, icon: Clock3 },
              { label: 'Fin', value: endLabel, icon: CalendarDays },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[#64748B]">
                  <item.icon size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="truncate text-xs font-bold text-[#1a1c1a]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;






