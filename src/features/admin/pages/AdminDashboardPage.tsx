import React, { useEffect, useMemo, useState } from 'react';
import { Users, Layers, TrendingUp, Clock, PieChart as PieIcon, BarChart as BarIcon, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
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
  const now = Date.now();
  const diff = now - deadline;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
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

        const [{ count: studentCount, error: studentsError }, { data: projectRows, error: projectsError }] = await Promise.all([
          supabase
            .from('etudiants')
            .select('id', { count: 'exact', head: true }),
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
          supabase
            .from('etudiants')
            .select('id, projet_id')
            .in('projet_id', projectIds),
          supabase
            .from('iterations')
            .select('id, projet_id, statut, date_debut')
            .in('projet_id', projectIds)
            .order('date_debut', { ascending: false }),
          encadrantIds.length > 0
            ? supabase
                .from('utilisateurs')
                .select('id, nom, prenom')
                .in('id', encadrantIds)
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
        console.error('Erreur chargement admin dashboard:', err);
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

  const delayedProjects = useMemo(() => {
    return projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80);
  }, [projects]);

  const avgDelay = useMemo(() => {
    if (delayedProjects.length === 0) return 0;
    const totalDelay = delayedProjects.reduce((sum, p) => sum + toDaysDelay(p.deadline), 0);
    return Number((totalDelay / delayedProjects.length).toFixed(1));
  }, [delayedProjects]);

  const stats = [
    { label: 'Total Students', value: String(totalStudents), icon: Users, color: 'bg-blue-500' },
    { label: 'Active Projects', value: String(projects.length), icon: Layers, color: 'bg-purple-500' },
    { label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Avg. Delay', value: `${avgDelay} days`, icon: Clock, color: 'bg-red-500' },
  ];

  const projectStatusData = [
    {
      name: 'Completed',
      value: projectsFiliere.filter((p) => p.progress >= 80).length,
      color: '#10b981',
    },
    {
      name: 'In Progress',
      value: projectsFiliere.filter((p) => p.progress > 0 && p.progress < 80).length,
      color: '#6366f1',
    },
    {
      name: 'Delayed',
      value: projectsFiliere.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80).length,
      color: '#ef4444',
    },
    {
      name: 'Pending',
      value: projectsFiliere.filter((p) => p.progress === 0).length,
      color: '#f59e0b',
    },
  ];

  const notifications: NotificationItem[] = [
    { id: 1, type: 'group', message: `${projects.length} projects loaded from database.` },
    { id: 2, type: 'project', message: `${projectStatusData[0].value} projects are completed.` },
  ];
  const [showNotif, setShowNotif] = useState(false);

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Statistics</h1>
          <p className="text-gray-500 mt-1">Overview of the entire platform's performance and progress.</p>
        </div>
        <div>
          <button
            className="fixed top-6 right-6 z-50 bg-gray-100 p-3 rounded-full shadow hover:bg-gray-200 transition"
            onClick={() => setShowNotif(v => !v)}
            aria-label="Notifications"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
          >
            <Bell className="w-7 h-7 text-gray-500" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{notifications.length}</span>
            )}
          </button>
          {showNotif && (
            <div
              className="z-50"
              style={{
                position: 'fixed',
                top: '70px',
                right: '1rem',
                left: 'auto',
                width: 'min(95vw, 20rem)',
                background: '#fff',
                borderRadius: '1rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid #f3f4f6',
              }}
            >
              <div className="p-4">
                <h4 className="font-bold text-gray-800 mb-2">Notifications</h4>
                {notifications.map(n => (
                  <div key={n.id} className="flex items-center gap-2 mb-2 last:mb-0">
                    {n.type === 'group' && <Users className="w-5 h-5 text-blue-500" />}
                    {n.type === 'project' && <Layers className="w-5 h-5 text-green-500" />}
                    <span className="text-sm text-gray-700">{n.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {loading && (
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading dashboard data from database...
        </div>
      )}

      {!loading && error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Database error while loading dashboard.</p>
          {missingColumns.length > 0 ? (
            <p className="mt-1">Missing column(s): {missingColumns.join(', ')}</p>
          ) : (
            <p className="mt-1">{error}</p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-2xl text-white`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"
        >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <PieIcon className="text-indigo-500" />
                  Project Distribution
                </h3>
                {/* Sélection de filière à droite du titre */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <select
                      className="appearance-none bg-transparent pr-6 pl-2 py-2 text-gray-800 font-semibold focus:outline-none cursor-pointer"
                      value={selectedFiliere}
                      onChange={e => {
                        setSelectedFiliere(e.target.value);
                        setSelectedStatus(null);
                      }}
                      style={{ minWidth: 0 }}
                    >
                      {filieres.length === 0 && <option value="">No categories</option>}
                      {filieres.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <svg className="w-4 h-4 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedStatus(entry.name)}
                      opacity={selectedStatus && selectedStatus !== entry.name ? 0.4 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {projectStatusData.map((item) => (
              <button
                key={item.name}
                className={`flex items-center gap-2 focus:outline-none ${selectedStatus === item.name ? 'font-bold text-black' : 'text-gray-600'}`}
                onClick={() => setSelectedStatus(item.name)}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-sm font-medium">{item.name}: {item.value}%</span>
              </button>
            ))}
          </div>

          {/* Liste des projets filtrés avec nom, encadrant et groupe */}
          {selectedStatus && (
            <div className="mt-8">
              <h4 className="text-lg font-bold mb-2">Projects: {selectedStatus}</h4>
              <div className="space-y-3">
                {projectsFiliere
                  .filter(p => {
                    if (selectedStatus === 'Completed') return p.progress >= 80;
                    if (selectedStatus === 'In Progress') return p.progress > 0 && p.progress < 80;
                    if (selectedStatus === 'Delayed') return toDaysDelay(p.deadline) > 0 && p.progress < 80;
                    if (selectedStatus === 'Pending') return p.progress === 0;
                    return false;
                  })
                  .map((p, idx) => {
                    const group = p.studentCount > 0 ? `${p.studentCount} student(s)` : 'No group assigned';
                    const encadrant = p.supervisor;
                    return (
                      <div key={`${p.id}-${idx}`} className="bg-white/90 rounded-2xl p-6 border border-gray-100 shadow flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:shadow-lg transition-all">
                        <div className="flex flex-col gap-1">
                          <div className="font-bold text-gray-800 text-lg tracking-wide">{p.title}</div>
                          <div className="text-xs text-blue-600 font-semibold">{group !== 'N/A' ? group : 'No group assigned'}</div>
                        </div>
                        <div className="flex flex-col md:items-end gap-1">
                          <span className="text-base font-semibold text-green-600">Progress: <span className="font-bold text-gray-900">{p.progress}%</span></span>
                          <span className="text-xs text-gray-500">Encadrant: <span className="font-medium text-indigo-600">{encadrant}</span></span>
                        </div>
                      </div>
                    );
                  })}
                {projectsFiliere.filter(p => {
                  if (selectedStatus === 'Completed') return p.progress >= 80;
                  if (selectedStatus === 'In Progress') return p.progress > 0 && p.progress < 80;
                  if (selectedStatus === 'Delayed') return toDaysDelay(p.deadline) > 0 && p.progress < 80;
                  if (selectedStatus === 'Pending') return p.progress === 0;
                  return false;
                }).length === 0 && (
                  <div className="text-gray-400 italic">No projects found for this status.</div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
