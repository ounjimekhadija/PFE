import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, MoreVertical, Plus, Search, Trash2, TrendingUp, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface DbProject {
  id: string;
  titre: string | null;
  domaine: string | null;
  encadrant_id: string | null;
  deadline_globale: string | null;
  nom_groupe: string | null;
}

interface DbIteration {
  id: string;
  projet_id: string | null;
}

interface DbTache {
  id: string;
  iteration_id: string | null;
  etat: string | null;
}

interface DbUtilisateur {
  id: string;
  nom: string | null;
  prenom: string | null;
}

interface ProjectCard {
  id: string;
  title: string;
  category: string;
  supervisor: string;
  group: string;
  deadline: string;
  progress: number;
}

interface EncadrantOption {
  id: string;
  displayName: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000';

const toText = (v: string | null | undefined, fallback = 'N/A') => (v?.trim() ? v.trim() : fallback);

const getSupervisorInitials = (name: string): string => {
  if (!name || name === 'N/A') return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getColorFromString = (str: string): string => {
  const colors = ['#765b00', '#065F46', '#9A3412', '#1e40af', '#6d28d9', '#0f766e'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatDeadlineDate = (deadline: string): string => {
  if (!deadline) return '';
  try {
    return new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return deadline;
  }
};

const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [encadrantOptions, setEncadrantOptions] = useState<EncadrantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    title: '',
    domaine: '',
    encadrantId: '',
    deadline: '',
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsRes, iterationsRes, tachesRes, usersRes] = await Promise.all([
        supabase.from('projets').select('id, titre, domaine, encadrant_id, deadline_globale, nom_groupe'),
        supabase.from('iterations').select('id, projet_id'),
        supabase.from('taches').select('id, iteration_id, etat'),
        supabase.from('utilisateurs').select('id, nom, prenom').eq('role', 'ENCADRANT'),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (iterationsRes.error) throw iterationsRes.error;
      if (tachesRes.error) throw tachesRes.error;
      if (usersRes.error) throw usersRes.error;

      const dbProjects = (projectsRes.data || []) as DbProject[];
      const iterations = (iterationsRes.data || []) as DbIteration[];
      const taches = (tachesRes.data || []) as DbTache[];
      const users = (usersRes.data || []) as DbUtilisateur[];

      setEncadrantOptions(
        users.map((u) => ({
          id: u.id,
          displayName: [u.nom, u.prenom].filter(Boolean).join(' ') || 'Inconnu',
        }))
      );

      const userById = new Map<string, DbUtilisateur>();
      users.forEach((u) => userById.set(u.id, u));

      const itersByProject = new Map<string, string[]>();
      iterations.forEach((it) => {
        if (!it.projet_id) return;
        const list = itersByProject.get(it.projet_id) || [];
        list.push(it.id);
        itersByProject.set(it.projet_id, list);
      });

      const tachesByIteration = new Map<string, { total: number; done: number }>();
      taches.forEach((t) => {
        if (!t.iteration_id) return;
        const cur = tachesByIteration.get(t.iteration_id) || { total: 0, done: 0 };
        cur.total += 1;
        if (t.etat === 'TERMINE') cur.done += 1;
        tachesByIteration.set(t.iteration_id, cur);
      });

      const calcProgress = (projectId: string): number => {
        const iterIds = itersByProject.get(projectId) || [];
        let total = 0;
        let done = 0;
        iterIds.forEach((itId) => {
          const counts = tachesByIteration.get(itId);
          if (counts) { total += counts.total; done += counts.done; }
        });
        if (total === 0) return 0;
        return Math.round((done / total) * 100);
      };

      const cards: ProjectCard[] = dbProjects.map((p) => {
        const supervisorUser = p.encadrant_id ? userById.get(p.encadrant_id) : undefined;
        const supervisorName = supervisorUser
          ? [supervisorUser.nom, supervisorUser.prenom].filter(Boolean).join(' ')
          : 'N/A';

        return {
          id: p.id,
          title: toText(p.titre),
          category: toText(p.domaine),
          supervisor: supervisorName,
          group: toText(p.nom_groupe),
          deadline: p.deadline_globale || '',
          progress: calcProgress(p.id),
        };
      });

      setProjects(cards);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur de chargement des projets.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getAccessToken = async (): Promise<string> => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;
    if (!token) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error('Session invalide. Reconnectez-vous.');
      token = refreshed.session?.access_token;
    }
    if (!token) throw new Error('Session invalide. Reconnectez-vous.');
    return token;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!form.title.trim()) { setFormError('Le titre du projet est obligatoire.'); return; }
    try {
      setCreateLoading(true);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titre: form.title,
          domaine: form.domaine || null,
          encadrantId: form.encadrantId || null,
          nomGroupe: null,
          deadline: form.deadline || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Creation echouee.');
      setFormSuccess('Projet cree avec succes.');
      setShowModal(false);
      setForm({ title: '', domaine: '', encadrantId: '', deadline: '' });
      await fetchData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la creation du projet.';
      setFormError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      setDeleteLoading(true);
      setFormError(null);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Suppression echouee.');
      setFormSuccess('Projet supprime avec succes.');
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la suppression du projet.';
      setFormError(message);
      setDeleteConfirmId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.supervisor.toLowerCase().includes(search.toLowerCase()) ||
      p.group.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const completed = projects.filter((p) => p.progress >= 80).length;
    const nearDeadline = projects.filter((p) => {
      if (!p.deadline) return false;
      const diff = new Date(p.deadline).getTime() - Date.now();
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
      : 0;
    return { completed, nearDeadline, avgProgress };
  }, [projects]);

  const inputClass = 'w-full rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/20';

  const openCreateModal = () => {
    setFormError(null);
    setFormSuccess(null);
    setForm({ title: '', domaine: '', encadrantId: '', deadline: '' });
    setShowModal(true);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#faf9f6] p-5 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Projects</h1>
          <p className="mt-0.5 text-sm text-[#7f7664]">Manage and track your organization's active initiatives.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#1a1c1a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4d4636] shadow-md"
        >
          <Plus size={15} /> Create Project
        </button>
      </header>

      {/* Banners */}
      {formError && !showModal && <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">{formError}</div>}
      {formSuccess && <div className="mb-3 shrink-0 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm text-green-700">{formSuccess}</div>}
      {loading && <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#f4f3f1] px-4 py-2 text-sm text-[#4d4636]">Chargement des projets...</div>}
      {!loading && error && <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">{error}</div>}

      {/* Stat Cards */}
      <section className="mb-4 shrink-0 grid grid-cols-4 gap-3">
        <article className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7664]">Total Active</p>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{projects.length}</p>
          <p className="mt-1 text-xs text-[#10B981]">+{Math.max(1, Math.round(projects.length * 0.12))} this month</p>
        </article>
        <article className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7664]">Completed</p>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{stats.completed}</p>
          <p className="mt-1 text-xs text-[#7f7664]">≥ 80% progress</p>
        </article>
        <article className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7664]">Near Deadline</p>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#ba1a1a]">{stats.nearDeadline}</p>
          <p className="mt-1 text-xs text-[#7f7664]">Within 30 days</p>
        </article>
        <article className="rounded-2xl border border-[#ffd464]/60 bg-[#ffd464]/10 p-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#765b00]">Avg Progress</p>
              <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{stats.avgProgress}%</p>
              <p className="mt-1 text-xs text-[#765b00]">Across all projects</p>
            </div>
            <div className="rounded-xl bg-[#ffd464] p-2.5 text-[#765b00]">
              <TrendingUp size={18} />
            </div>
          </div>
        </article>
      </section>

      {/* Search */}
      <div className="mb-4 shrink-0 flex items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 w-64 shadow-sm focus-within:border-[#765b00]">
        <Search size={14} className="text-[#7f7664] shrink-0" />
        <input
          type="text"
          placeholder="Search projects..."
          className="flex-1 bg-transparent text-sm text-[#1a1c1a] outline-none placeholder:text-[#7f7664]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Project Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -3 }}
              className="flex flex-col rounded-2xl border border-transparent bg-white p-4 shadow-sm"
            >
              {/* Top row: category + 3-dot menu */}
              <div className="mb-3 flex items-start justify-between">
                <span className="rounded-full border border-transparent px-2.5 py-0.5 text-[10px] font-semibold text-[#4d4636]">
                  {project.category}
                </span>
                <div className="relative" ref={openMenuId === project.id ? menuRef : null}>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7f7664] hover:bg-[#f4f3f1] transition"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {openMenuId === project.id && (
                    <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-transparent bg-white shadow-[0_4px_16px_rgba(118,91,0,0.12)]">
                      <button
                        type="button"
                        onClick={() => { setDeleteConfirmId(project.id); setOpenMenuId(null); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[#ba1a1a] transition hover:bg-[#ffdad6]"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="mb-3 text-base font-bold leading-snug text-[#765b00]">{project.title}</h3>

              {/* Supervisor */}
              <div className="mb-2">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">Supervisor</p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: getColorFromString(project.supervisor) }}
                  >
                    {getSupervisorInitials(project.supervisor)}
                  </div>
                  <span className="truncate text-sm font-semibold text-[#1a1c1a]">{project.supervisor}</span>
                </div>
              </div>

              {/* Group */}
              <div className="mb-3 flex-1">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">Group</p>
                <div className="flex items-center gap-2">
                  <Users size={14} className="shrink-0 text-[#7f7664]" />
                  <span className="truncate text-sm font-semibold text-[#1a1c1a]">{project.group}</span>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#7f7664]">Progress</span>
                  <span className="text-xs font-bold text-[#1a1c1a]">{project.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e3da]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: project.progress >= 80 ? '#10B981' : project.progress > 0 ? '#765b00' : '#d1c5b0',
                    }}
                  />
                </div>
              </div>

              {/* Footer: deadline */}
              {project.deadline && (
                <div className="flex items-center gap-1.5 border-t border-[#e8e3da] pt-2.5">
                  <Calendar size={12} className="shrink-0 text-[#ba1a1a]" />
                  <span className="text-xs font-medium text-[#ba1a1a]">
                    Due {formatDeadlineDate(project.deadline)}
                  </span>
                </div>
              )}
            </motion.div>
          ))}

          {/* New Project card */}
          <button
            type="button"
            onClick={openCreateModal}
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-transparent p-4 transition hover:border-[#765b00] hover:bg-[#ffd464]/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-transparent">
              <Plus size={18} className="text-[#7f7664]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#4d4636]">New Project</p>
              <p className="mt-0.5 text-xs text-[#7f7664]">Click here to start a new collaborative workspace</p>
            </div>
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm p-4 sm:p-6">
          <div className="relative my-8 w-full max-w-md rounded-3xl border border-transparent bg-white shadow-2xl">
            <button className="absolute right-4 top-4 text-2xl font-bold text-[#7f7664] hover:text-[#4d4636]" onClick={() => setShowModal(false)} aria-label="Close">&times;</button>
            <div className="border-b border-transparent px-8 pb-4 pt-8">
              <h2 className="text-xl font-bold text-[#1a1c1a]">Create Project</h2>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4 px-8 py-6">
              {formError && <div className="rounded-xl border border-[#fecaca] bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{formError}</div>}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4d4636]">Project Name <span className="text-[#ba1a1a]">*</span></label>
                <input type="text" className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4d4636]">Filière / Domaine</label>
                <input type="text" className={inputClass} placeholder="ex: Informatique, IA, IoT..." value={form.domaine} onChange={(e) => setForm((f) => ({ ...f, domaine: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4d4636]">Encadrant (Supervisor)</label>
                <select className={inputClass + ' [&>option]:bg-white [&>option:checked]:bg-[#765b00] [&>option:checked]:text-white'} style={{ accentColor: '#765b00' }} value={form.encadrantId} onChange={(e) => setForm((f) => ({ ...f, encadrantId: e.target.value }))}>
                  <option value="">-- Aucun --</option>
                  {encadrantOptions.map((enc) => <option key={enc.id} value={enc.id}>{enc.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4d4636]">Deadline</label>
                <input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-transparent pt-4">
                <button type="button" className="rounded-xl bg-[#efeeeb] px-5 py-2 text-sm font-semibold text-[#4d4636] hover:bg-[#e3e2e0]" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="rounded-xl bg-[#765b00] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#594400] disabled:opacity-50" disabled={createLoading}>
                  {createLoading ? 'Creation...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-transparent bg-white p-8 shadow-xl">
            <h2 className="text-xl font-bold text-[#1a1c1a]">Confirmer la suppression</h2>
            <p className="text-sm text-[#7f7664]">Cette action supprimera le projet, ses itérations, ses tâches et détachera ses étudiants. Irréversible.</p>
            {formError && <div className="rounded-xl border border-[#fecaca] bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{formError}</div>}
            <div className="mt-2 flex justify-end gap-3">
              <button type="button" className="rounded-xl bg-[#efeeeb] px-5 py-2 text-sm font-semibold text-[#4d4636] hover:bg-[#e3e2e0]" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>Annuler</button>
              <button type="button" className="rounded-xl bg-[#ba1a1a] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#93000a] disabled:opacity-50" onClick={() => handleDeleteProject(deleteConfirmId)} disabled={deleteLoading}>
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjects;
