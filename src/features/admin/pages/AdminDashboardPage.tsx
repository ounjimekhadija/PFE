import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, Layers, TrendingUp, Users } from 'lucide-react';
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
}

interface NotificationItem {
  id: number;
  type: 'group' | 'project';
  message: string;
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

const normalizeDelayToPercent = (days: number): number => {
  // 120 days and above is considered a full risk score.
  return Math.min(100, Math.round((days / 120) * 100));
};

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);

  const filieres = useMemo(() => Array.from(new Set(projects.map((p) => p.category))), [projects]);
  const [selectedFiliere, setSelectedFiliere] = useState<string>(filieres[0] || '');

  useEffect(() => {
    if (!selectedFiliere && filieres.length > 0) {
      setSelectedFiliere(filieres[0]);
    }
  }, [filieres, selectedFiliere]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        setMissingColumns([]);

        const [{ count: studentCount, error: studentsError }, { data: projectRows, error: projectsError }] =
          await Promise.all([
            supabase.from('etudiants').select('id', { count: 'exact', head: true }),
            supabase
              .from('projets')
              .select('id, titre, domaine, encadrant_id, deadline_globale, created_at')
              .order('created_at', { ascending: false }),
          ]);

        if (studentsError) throw studentsError;
        if (projectsError) throw projectsError;

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

  const projectsFiliere = projects.filter((p) => p.category === selectedFiliere);

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

  const projectStatus = useMemo(() => {
    const source = projectsFiliere.length > 0 ? projectsFiliere : projects;
    return [
      {
        name: 'Completed',
        value: source.filter((p) => p.progress >= 80).length,
        color: '#10B981',
      },
      {
        name: 'In Progress',
        value: source.filter((p) => p.progress > 0 && p.progress < 80).length,
        color: '#6366F1',
      },
      {
        name: 'Delayed',
        value: source.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80).length,
        color: '#F97316',
      },
      {
        name: 'Pending',
        value: source.filter((p) => p.progress === 0).length,
        color: '#94A3B8',
      },
    ];
  }, [projects, projectsFiliere]);

  const statusTotal = Math.max(1, projectStatus.reduce((sum, item) => sum + item.value, 0));

  const statusFilteredProjects = useMemo(() => {
    if (!selectedStatus) return [];
    const source = projectsFiliere.length > 0 ? projectsFiliere : projects;

    return source.filter((p) => {
      if (selectedStatus === 'Completed') return p.progress >= 80;
      if (selectedStatus === 'In Progress') return p.progress > 0 && p.progress < 80;
      if (selectedStatus === 'Delayed') return toDaysDelay(p.deadline) > 0 && p.progress < 80;
      if (selectedStatus === 'Pending') return p.progress === 0;
      return false;
    });
  }, [selectedStatus, projects, projectsFiliere]);

  const ringProgress = Math.max(6, completionRate);
  const ringDelay = Math.max(6, normalizeDelayToPercent(avgDelay));

  const notifications: NotificationItem[] = [
    { id: 1, type: 'group', message: `${projects.length} projects synced from database.` },
    { id: 2, type: 'project', message: `${projectStatus[0].value} projects are currently completed.` },
  ];

  const timelineItems = useMemo(() => {
    const delayed = delayedProjects.slice(0, 2).map((p) => ({
      id: `delay-${p.id}`,
      title: `${p.title} is delayed`,
      subtitle: `${toDaysDelay(p.deadline)} days delay`,
      accent: '#F97316',
    }));

    const upcoming = [...projects]
      .filter((p) => !!p.deadline)
      .sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())
      .slice(0, 3)
      .map((p) => ({
        id: `due-${p.id}`,
        title: `Deadline: ${p.title}`,
        subtitle: p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No date',
        accent: '#6366F1',
      }));

    return [...delayed, ...upcoming].slice(0, 5);
  }, [delayedProjects, projects]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFF] p-6 md:p-8 text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Global Statistics</h1>
          <p className="mt-2 text-sm font-normal text-[#64748B]">Overview of the entire platform performance and progress.</p>
        </div>
        <div className="relative">
          <button
            className="relative rounded-full border border-[#E2E8F0] bg-white p-3 text-[#64748B] shadow-[0_8px_20px_rgba(0,0,0,0.05)]"
            onClick={() => setShowNotif((v) => !v)}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {notifications.length}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 z-30 mt-3 w-80 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Notifications</h3>
              <div className="mt-3 space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2">
                    <div className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: n.type === 'group' ? '#6366F1' : '#10B981' }} />
                    <p className="text-sm text-[#334155]">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {loading && (
        <div className="mb-6 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
          Loading dashboard data from database...
        </div>
      )}

      {!loading && error && (
        <div className="mb-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          <p className="font-semibold">Database error while loading dashboard.</p>
          {missingColumns.length > 0 ? (
            <p className="mt-1">Missing column(s): {missingColumns.join(', ')}</p>
          ) : (
            <p className="mt-1">{error}</p>
          )}
        </div>
      )}

      <section className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        {[
          {
            label: 'Total Students',
            value: String(totalStudents),
            trend: `${Math.max(1, Math.round(totalStudents * 0.08))} new this week`,
            icon: Users,
          },
          {
            label: 'Active Projects',
            value: String(projects.length),
            trend: `${projectStatus[1].value} in progress`,
            icon: Layers,
          },
          {
            label: 'Completion Rate',
            value: `${completionRate}%`,
            trend: `${projectStatus[0].value} completed`,
            icon: TrendingUp,
          },
          {
            label: 'Avg. Delay',
            value: `${avgDelay} days`,
            trend: `${delayedProjects.length} projects delayed`,
            icon: Clock3,
          },
        ].map((card) => (
          <article key={card.label} className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-normal text-[#64748B]">{card.label}</p>
                <p className="mt-3 text-[2rem] font-bold leading-none text-[#0F172A]">{card.value}</p>
                <p className="mt-2 text-xs text-[#64748B]">{card.trend}</p>
              </div>
              <div className="rounded-xl bg-[#EEF2FF] p-3 text-[#6366F1]">
                <card.icon size={20} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)] xl:col-span-2">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold text-[#0F172A]">Project Distribution</h2>
            <select
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
              value={selectedFiliere}
              onChange={(e) => {
                setSelectedFiliere(e.target.value);
                setSelectedStatus(null);
              }}
            >
              {filieres.length === 0 && <option value="">No categories</option>}
              {filieres.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <div className="mb-4 overflow-hidden rounded-full bg-[#F1F5F9]">
                <div className="flex h-4">
                  {projectStatus.map((item) => (
                    <button
                      key={item.name}
                      className="transition-opacity hover:opacity-80"
                      style={{
                        width: `${(item.value / statusTotal) * 100}%`,
                        backgroundColor: item.color,
                        opacity: selectedStatus && selectedStatus !== item.name ? 0.45 : 1,
                      }}
                      onClick={() => setSelectedStatus(item.name)}
                      aria-label={`Filter ${item.name}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {projectStatus.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedStatus(item.name)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      selectedStatus === item.name
                        ? 'border-[#6366F1] bg-[#EEF2FF]'
                        : 'border-[#E2E8F0] bg-[#F8FAFF] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <span className="mb-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <p className="text-sm font-medium text-[#0F172A]">{item.name}</p>
                    <p className="text-xs text-[#64748B]">{item.value} projects</p>
                  </button>
                ))}
              </div>

              {selectedStatus && (
                <div className="mt-5 space-y-3">
                  {statusFilteredProjects.length === 0 && <p className="text-sm text-[#64748B]">No projects found for this status.</p>}
                  {statusFilteredProjects.slice(0, 4).map((p) => (
                    <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0F172A]">{p.title}</p>
                          <p className="text-xs text-[#64748B]">{p.supervisor} · {p.studentCount} students</p>
                        </div>
                        <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">{p.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
              <p className="text-sm text-[#64748B]">Completion ring</p>
              <div className="mt-4 flex items-center justify-center">
                <div
                  className="relative h-56 w-56 rounded-full md:h-64 md:w-64"
                  style={{
                    background: `conic-gradient(#6366F1 ${ringProgress}%, #E2E8F0 0%)`,
                  }}
                >
                  <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-[#0F172A] md:text-4xl">{completionRate}%</p>
                      <p className="text-sm text-[#64748B]">Output</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-6">
          <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-2xl font-semibold text-[#0F172A]">Onboarding Snapshot</h3>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[#EEF2FF] px-3 py-2">
                <span className="text-sm text-[#4338CA]">Students</span>
                <span className="font-semibold text-[#1E1B4B]">{totalStudents}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#ECFDF5] px-3 py-2">
                <span className="text-sm text-[#065F46]">Projects</span>
                <span className="font-semibold text-[#064E3B]">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#FFF7ED] px-3 py-2">
                <span className="text-sm text-[#9A3412]">Completion</span>
                <span className="font-semibold text-[#7C2D12]">{completionRate}%</span>
              </div>
            </div>
          </article>

          <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-[#0F172A]">Progress</h3>
              <span className="text-xs text-[#64748B]">Project completion rate</span>
            </div>
            <p className="text-sm text-[#64748B]">Work Time this week was adapted to completion analytics.</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${Math.max(8, completionRate)}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Avg. Delay</span>
              <span className="font-semibold text-[#0F172A]">{avgDelay} days</span>
            </div>
          </article>

          <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-2xl font-semibold text-[#0F172A]">Weekly Team Sync</h3>
            <div className="mt-4 space-y-3">
              {timelineItems.length === 0 && <p className="text-sm text-[#64748B]">No upcoming updates.</p>}
              {timelineItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.accent }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{item.title}</p>
                    <p className="text-xs text-[#64748B]">{item.subtitle}</p>
                  </div>
                  <CheckCircle2 size={16} className="ml-auto mt-0.5 text-[#94A3B8]" />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
