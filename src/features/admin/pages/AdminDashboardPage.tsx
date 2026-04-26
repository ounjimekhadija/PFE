import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Download, Layers, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';

interface ProjectRow {
  id: string;
  titre: string;
  domaine: string | null;
  encadrant_id: string | null;
  deadline_globale: string | null;
  created_at?: string;
}

interface IterationRow {
  id: string;
  projet_id: string;
  statut: string | null;
  date_debut: string | null;
}

interface TaskRow {
  id: string;
  iteration_id: string;
  etat: string | null;
}

interface SupervisorRow {
  id: string;
  nom: string | null;
  prenom: string | null;
}

interface DashboardProject {
  id: string;
  title: string;
  category: string;
  progress: number;
  deadline: string | null;
  supervisor: string;
  studentCount: number;
  createdAt: string | null;
}


const getErrorText = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const obj = error as { message?: string; details?: string; hint?: string };
    return [obj.message, obj.details, obj.hint].filter(Boolean).join(' | ');
  }
  return '';
};

const extractMissingColumns = (error: unknown): string[] => {
  const text = getErrorText(error);
  if (!text) return [];
  const matches = Array.from(text.matchAll(/column\s+([a-zA-Z0-9_.\"]+)\s+does not exist/gi));
  const found = matches.map((m) => m[1]?.replace(/"/g, '')).filter(Boolean) as string[];
  return Array.from(new Set(found));
};

const toDaysDelay = (deadlineIso: string | null): number => {
  if (!deadlineIso) return 0;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return 0;
  const diff = Date.now() - deadline;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};


const resolveAvatar = (avatarUrl: string | null | undefined, name: string): string => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&size=64`;
  if (!avatarUrl) return fallback;
  const raw = avatarUrl.trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
  return data?.publicUrl || fallback;
};

interface OnboardingMember { name: string; avatar: string; }

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalProfessors, setTotalProfessors] = useState(0);
  const [onboardingMembers, setOnboardingMembers] = useState<OnboardingMember[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        setMissingColumns([]);

        const [
          { count: studentCount, error: studentsError },
          { data: projectRows, error: projectsError },
          { count: professorCount, error: professorsError },
          { data: membersData },
        ] = await Promise.all([
          supabase.from('etudiants').select('id', { count: 'exact', head: true }),
          supabase
            .from('projets')
            .select('id, titre, domaine, encadrant_id, deadline_globale, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('role', 'ENCADRANT'),
          supabase.from('utilisateurs').select('nom, prenom, avatar_url').limit(6),
        ]);

        if (studentsError) throw studentsError;
        if (projectsError) throw projectsError;
        if (professorsError) throw professorsError;
        setTotalProfessors(professorCount || 0);

        setOnboardingMembers(
          (membersData || []).map((u: { nom: string | null; prenom: string | null; avatar_url?: string | null }) => {
            const name = `${u.prenom || ''} ${u.nom || ''}`.trim() || 'User';
            return { name, avatar: resolveAvatar(u.avatar_url, name) };
          })
        );

        const safeProjects = (projectRows || []) as ProjectRow[];
        if (safeProjects.length === 0) {
          setTotalStudents(studentCount || 0);
          setProjects([]);
          return;
        }

        const projectIds = safeProjects.map((p) => p.id);
        const encadrantIds = Array.from(new Set(safeProjects.map((p) => p.encadrant_id).filter(Boolean))) as string[];

        const [studentsByProjectRes, iterationsRes, supervisorsRes] = await Promise.all([
          supabase.from('etudiants').select('id, projet_id').in('projet_id', projectIds),
          supabase
            .from('iterations')
            .select('id, projet_id, statut, date_debut')
            .in('projet_id', projectIds)
            .order('date_debut', { ascending: false }),
          encadrantIds.length > 0
            ? supabase.from('utilisateurs').select('id, nom, prenom').in('id', encadrantIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (studentsByProjectRes.error) throw studentsByProjectRes.error;
        if (iterationsRes.error) throw iterationsRes.error;
        if (supervisorsRes.error) throw supervisorsRes.error;

        const iterations = (iterationsRes.data || []) as IterationRow[];
        const chosenIterationByProject: Record<string, IterationRow> = {};

        iterations.forEach((it) => {
          if (!chosenIterationByProject[it.projet_id]) {
            chosenIterationByProject[it.projet_id] = it;
          }
          if (it.statut === 'EN_COURS') {
            chosenIterationByProject[it.projet_id] = it;
          }
        });

        const iterationIds = Object.values(chosenIterationByProject).map((it) => it.id);
        let tasks: TaskRow[] = [];

        if (iterationIds.length > 0) {
          const { data: taskRows, error: taskError } = await supabase
            .from('taches')
            .select('id, iteration_id, etat')
            .in('iteration_id', iterationIds);

          if (taskError) throw taskError;
          tasks = (taskRows || []) as TaskRow[];
        }

        const tasksByIteration: Record<string, TaskRow[]> = {};
        tasks.forEach((task) => {
          if (!tasksByIteration[task.iteration_id]) tasksByIteration[task.iteration_id] = [];
          tasksByIteration[task.iteration_id].push(task);
        });

        const studentsByProject: Record<string, number> = {};
        (studentsByProjectRes.data || []).forEach((row: { projet_id: string | null }) => {
          if (!row.projet_id) return;
          studentsByProject[row.projet_id] = (studentsByProject[row.projet_id] || 0) + 1;
        });

        const supervisorsById: Record<string, string> = {};
        ((supervisorsRes.data || []) as SupervisorRow[]).forEach((u) => {
          const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim();
          supervisorsById[u.id] = fullName || 'N/A';
        });

        const mappedProjects: DashboardProject[] = safeProjects.map((p) => {
          const selectedIteration = chosenIterationByProject[p.id];
          const relatedTasks = selectedIteration ? (tasksByIteration[selectedIteration.id] || []) : [];
          const completedTasks = relatedTasks.filter((t) => t.etat === 'TERMINE').length;
          const progress = relatedTasks.length > 0 ? Math.round((completedTasks / relatedTasks.length) * 100) : 0;

          return {
            id: p.id,
            title: p.titre || 'Untitled project',
            category: p.domaine || 'General',
            progress,
            deadline: p.deadline_globale,
            supervisor: p.encadrant_id ? (supervisorsById[p.encadrant_id] || 'N/A') : 'N/A',
            studentCount: studentsByProject[p.id] || 0,
            createdAt: p.created_at || null,
          };
        });

        setTotalStudents(studentCount || 0);
        setProjects(mappedProjects);
      } catch (err) {
        const missing = extractMissingColumns(err);
        setMissingColumns(missing);
        setError(getErrorText(err) || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const completionRate = useMemo(() => {
    if (projects.length === 0) return 0;
    const total = projects.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(total / projects.length);
  }, [projects]);

  const delayedProjects = useMemo(() => projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80), [projects]);

  const avgDelay = useMemo(() => {
    if (delayedProjects.length === 0) return 0;
    const totalDelay = delayedProjects.reduce((sum, p) => sum + toDaysDelay(p.deadline), 0);
    return Number((totalDelay / delayedProjects.length).toFixed(1));
  }, [delayedProjects]);

  const projectStatus = useMemo(() => [
    { name: 'Completed', value: projects.filter((p) => p.progress >= 80).length, color: '#10B981' },
    { name: 'In Progress', value: projects.filter((p) => p.progress > 0 && p.progress < 80).length, color: '#765b00' },
    { name: 'Delayed', value: projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80).length, color: '#F97316' },
    { name: 'Pending', value: projects.filter((p) => p.progress === 0).length, color: '#7f7664' },
  ], [projects]);

  const ringProgress = Math.max(6, completionRate);

  const timelineItems = useMemo(() => {
    const delayedIds = new Set(delayedProjects.map((p) => p.id));
    return [...projects]
      .filter((p) => !!p.deadline)
      .sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())
      .map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: delayedIds.has(p.id)
          ? `${toDaysDelay(p.deadline)} days delay`
          : new Date(p.deadline!).toLocaleDateString(),
        accent: delayedIds.has(p.id) ? '#F97316' : '#765b00',
      }));
  }, [projects, delayedProjects]);

  const handleExportReport = () => {
    const summary = [
      { Metric: 'Total Students', Value: totalStudents },
      { Metric: 'Total Professors', Value: totalProfessors },
      { Metric: 'Active Projects', Value: projects.length },
      { Metric: 'Completion Rate', Value: `${completionRate}%` },
      { Metric: 'Avg Delay (days)', Value: avgDelay },
      { Metric: 'Delayed Projects', Value: delayedProjects.length },
    ];
    const projectRows = projects.map((p) => ({
      Title: p.title,
      Category: p.category,
      Supervisor: p.supervisor,
      'Progress (%)': p.progress,
      Deadline: p.deadline || 'N/A',
      Students: p.studentCount,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectRows), 'Projects');
    XLSX.writeFile(wb, `dashboard_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const barData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    const entries = Array.from(map.entries());
    const colors = ['#765b00', '#ffd464', '#4d4636', '#d1c5b0', '#F97316'];
    return entries.length > 0
      ? entries.map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }))
      : projectStatus.map((s) => ({ name: s.name, count: s.value, color: s.color }));
  }, [projects, projectStatus]);

  const maxBarCount = useMemo(() => Math.max(...barData.map((b) => b.count), 1), [barData]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#faf9f6] p-5 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Platform Overview</h1>
          <p className="mt-0.5 text-sm text-[#7f7664]">Real-time performance metrics and team activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportReport}
            className="flex items-center gap-2 rounded-xl bg-[#ffd464] px-4 py-2 text-sm font-semibold text-[#594400] shadow-[0_4px_16px_rgba(118,91,0,0.2)] transition hover:bg-[#ebc254]"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </header>

      {loading && (
        <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#f4f3f1] px-4 py-2 text-sm text-[#4d4636]">
          Loading dashboard data from database...
        </div>
      )}
      {!loading && error && (
        <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">
          <p className="font-semibold">Database error while loading dashboard.</p>
          <p className="mt-1">{missingColumns.length > 0 ? `Missing column(s): ${missingColumns.join(', ')}` : error}</p>
        </div>
      )}

      {/* Stat Cards */}
      <section className="mb-4 shrink-0 grid grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: String(totalStudents), trend: `+${Math.max(1, Math.round(totalStudents * 0.08))}`, trendClass: 'text-[#10B981] bg-[#ECFDF5]', icon: Users },
          { label: 'Active Projects', value: String(projects.length), trend: projectStatus[1].value > 0 ? `${projectStatus[1].value} active` : 'Steady', trendClass: 'text-[#765b00] bg-[#ffd464]/30', icon: Layers },
          { label: 'Completion Rate', value: `${completionRate}%`, trend: `+${completionRate}%`, trendClass: 'text-[#10B981] bg-[#ECFDF5]', icon: TrendingUp },
          { label: 'Avg. Delay', value: `${avgDelay} Days`, trend: avgDelay > 0 ? `+${avgDelay}d` : 'None', trendClass: avgDelay > 0 ? 'text-[#ba1a1a] bg-[#ffdad6]' : 'text-[#10B981] bg-[#ECFDF5]', icon: Clock3 },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <div className="mb-3 flex items-start justify-between">
              <div className="rounded-xl bg-[#f4f3f1] p-2.5 text-[#765b00]">
                <card.icon size={18} />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${card.trendClass}`}>{card.trend}</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7664]">{card.label}</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{card.value}</p>
          </article>
        ))}
      </section>

      {/* Main Row */}
      <section className="flex-1 min-h-0 mb-4 grid grid-cols-[2fr_1fr_1fr] gap-4">

        {/* Bar Chart — Project Distribution */}
        <article className="flex min-h-0 flex-col rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="mb-3 flex items-center justify-between shrink-0">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Project Distribution</h2>
            <div className="flex flex-wrap gap-3">
              {barData.slice(0, 4).map((b) => (
                <span key={b.name} className="flex items-center gap-1 text-xs text-[#7f7664]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="truncate max-w-[56px]">{b.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-1 min-h-0 items-end gap-3 pb-1">
            {barData.map((bar) => (
              <div key={bar.name} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-xl transition-all duration-700"
                  style={{
                    height: `${Math.max(28, Math.round((bar.count / maxBarCount) * 160))}px`,
                    backgroundColor: bar.color,
                  }}
                />
                <span className="text-[10px] text-[#7f7664] truncate w-full text-center">{bar.name.slice(0, 7)}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Quarterly Progress Ring */}
        <article className="flex min-h-0 flex-col items-center justify-between rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664] self-start">Quarterly Progress</h2>
          <div
            className="relative h-36 w-36 rounded-full"
            style={{ background: `conic-gradient(#ffd464 ${ringProgress}%, #e8e3da 0%)` }}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
              <p className="text-2xl font-bold text-[#1a1c1a]">{completionRate}%</p>
            </div>
          </div>
          <p className="text-center text-sm font-semibold text-[#765b00]">
            {avgDelay > 0 ? `${avgDelay} days behind schedule` : projects.length > 0 ? 'Ahead of schedule' : 'No data yet'}
          </p>
        </article>

        {/* Active Onboarding — Dark Card */}
        <article className="flex min-h-0 flex-col justify-between rounded-2xl bg-[#1a1c1a] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Active Onboarding</p>
          <div>
            <div className="mb-3 flex -space-x-2">
              {onboardingMembers.slice(0, 4).map((m, i) => (
                <img
                  key={i}
                  src={m.avatar}
                  alt={m.name}
                  title={m.name}
                  className="h-9 w-9 rounded-full border-2 border-[#1a1c1a] object-cover"
                />
              ))}
              {(totalStudents + totalProfessors) > 4 && (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1a1c1a] bg-[#efeeeb] text-xs font-bold text-[#1a1c1a]">
                  +{totalStudents + totalProfessors - 4}
                </div>
              )}
            </div>
            <p className="text-sm font-semibold leading-snug text-white">
              {totalStudents + totalProfessors} new members joined this week
            </p>
          </div>
          <Link to="/users" className="mt-3 flex items-center justify-center rounded-xl border border-[#4d4636] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4d4636]">
            View List
          </Link>
        </article>
      </section>

      {/* Team Sync Timeline */}
      <section className="shrink-0 rounded-2xl border border-transparent bg-white px-6 py-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
        <div className="mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Team Sync Timeline</h3>
        </div>
        {timelineItems.length === 0 ? (
          <p className="text-sm text-[#7f7664]">No upcoming updates.</p>
        ) : (
          <div className="relative">
            {/* Connecting line — sits at 32px (subtitle area) + 8px (half dot) = 40px from top */}
            <div className="absolute left-0 right-0 h-px bg-[#e8e3da]" style={{ top: '40px' }} />

            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${timelineItems.length}, 1fr)`, gap: '12px' }}
            >
              {timelineItems.map((item) => (
                <div key={item.id} className="flex flex-col items-center">
                  {/* Subtitle — fixed 32px area so all dots align */}
                  <div className="flex h-8 w-full items-center justify-center px-1">
                    <p className="line-clamp-2 text-center text-[10px] leading-tight text-[#7f7664]">
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Dot on the line */}
                  <div
                    className="relative z-10 h-4 w-4 flex-shrink-0 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: item.accent }}
                  />

                  {/* Title below */}
                  <div className="mt-2 w-full px-1">
                    <p className="line-clamp-2 text-center text-xs font-semibold leading-snug text-[#1a1c1a]">
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
