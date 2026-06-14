import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CheckCircle, Clock3, FolderPlus, MoreVertical, Plus, Search, Trash2, TrendingUp, Users, X } from 'lucide-react';
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '';

const toText = (v: string | null | undefined, fallback = 'N/A') => (v?.trim() ? v.trim() : fallback);

const getEncadrantInitials = (name: string): string => {
  if (!name || name === 'N/A') return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getColorFromString = (str: string): string => {
  const colors = ['#1E3A5F', '#065F46', '#9A3412', '#1e40af', '#6d28d9', '#0f766e'];
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
  const [deleteConfirmId, setSupprimerConfirmId] = useState<string | null>(null);
  const [deleteLoading, setSupprimerLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEncadrantDropdown, setShowEncadrantDropdown] = useState(false);
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

      const calcProgression = (projectId: string): number => {
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
          progress: calcProgression(p.id),
        };
      });

      setProjects(cards);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors du chargement des projets.';
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
      if (!response.ok) throw new Error(body?.error || 'La création a échoué.');
      setFormSuccess('Projet créé avec succès.');
      setShowModal(false);
      setForm({ title: '', domaine: '', encadrantId: '', deadline: '' });
      await fetchData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la création du projet.';
      setFormError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSupprimerProject = async (id: string) => {
    try {
      setSupprimerLoading(true);
      setFormError(null);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'La suppression a échoué.');
      setFormSuccess('Projet supprimé avec succès.');
      setSupprimerConfirmId(null);
      await fetchData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la suppression du projet.';
      setFormError(message);
      setSupprimerConfirmId(null);
    } finally {
      setSupprimerLoading(false);
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
    const avgProgression = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
      : 0;
    return { completed, nearDeadline, avgProgression };
  }, [projects]);

   const inputClass = 'w-full rounded-xl border border-[#D8E2EC] bg-[#F8FAFC] px-4 py-3 text-sm text-[#1a1c1a] shadow-sm outline-none transition-all placeholder:text-[#94A3B8] hover:border-[#BFD7EF] focus:border-[#1E3A5F] focus:bg-white focus:ring-4 focus:ring-[#DCEBFA] [&>option]:bg-white [&>option]:text-[#1a1c1a]';

  const openCreateModal = () => {
    setFormError(null);
    setFormSuccess(null);
    setForm({ title: '', domaine: '', encadrantId: '', deadline: '' });
    setShowModal(true);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-4 text-[#1a1c1a] sm:px-6 lg:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Projets</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Gérez et suivez les projets actifs de votre organisation.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-[#172D49] sm:w-auto"
        >
          <Plus size={15} /> Créer un projet
        </button>
      </header>

      {/* Banners */}
      {formError && !showModal && <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">{formError}</div>}
      {formSuccess && <div className="mb-3 shrink-0 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm text-green-700">{formSuccess}</div>}
      {loading && <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#EEF3F8] px-4 py-2 text-sm text-[#334155]">Chargement des projets...</div>}
      {!loading && error && <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">{error}</div>}

      {/* Stat Cards */}
      <section className="mb-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]">
                <Users size={18} />
              </div>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Actifs</p>
            </div>
            <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#10B981]">+{Math.max(1, Math.round(projects.length * 0.12))}</span>
          </div>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{projects.length}</p>
        </article>
        <article className="rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]">
                <CheckCircle size={18} />
              </div>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Terminés</p>
            </div>
            <span className="rounded-full bg-[#EEF3F8] px-2 py-0.5 text-xs font-semibold text-[#1E3A5F]">80%</span>
          </div>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{stats.completed}</p>
          <p className="mt-1 text-xs text-[#64748B]">≥ 80% de progression</p>
        </article>
        <article className="rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]">
                <Clock3 size={18} />
              </div>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Échéance proche</p>
            </div>
            <span className="rounded-full bg-[#EEF3F8] px-2 py-0.5 text-xs font-semibold text-[#1E3A5F]">30d</span>
          </div>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{stats.nearDeadline}</p>
          <p className="mt-1 text-xs text-[#64748B]">Dans 30 jours</p>
        </article>
        <article className="rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]">
                <TrendingUp size={18} />
              </div>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Progression moy.</p>
            </div>
            <span className="rounded-full bg-[#DCEBFA] px-2 py-0.5 text-xs font-semibold text-[#1E3A5F]">{stats.avgProgression}%</span>
          </div>
          <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{stats.avgProgression}%</p>
        </article>
      </section>

      {/* Search */}
      <div className="mb-4 flex w-full shrink-0 items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 shadow-sm focus-within:border-[#1E3A5F] sm:w-64">
        <Search size={14} className="text-[#64748B] shrink-0" />
        <input
          type="text"
          placeholder="Rechercher des projets..."
          className="flex-1 bg-transparent text-sm text-[#1a1c1a] outline-none placeholder:text-[#64748B]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Project Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 gap-4 pb-2 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -3 }}
              className="flex flex-col rounded-2xl border border-[#E5EDF5] bg-[#F8FAFC] p-4 shadow-sm transition hover:border-[#BFD7EF]"
            >
              {/* Top row: category + 3-dot menu */}
              <div className="mb-3 flex items-start justify-between">
                <span className="rounded-full border border-transparent px-2.5 py-0.5 text-[10px] font-semibold text-[#334155]">
                  {project.category}
                </span>
                <div className="relative" ref={openMenuId === project.id ? menuRef : null}>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EEF3F8] transition"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {openMenuId === project.id && (
                    <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-transparent bg-white shadow-[0_4px_16px_rgba(15,23,42,0.12)]">
                      <button
                        type="button"
                        onClick={() => { setSupprimerConfirmId(project.id); setOpenMenuId(null); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[#ba1a1a] transition hover:bg-[#ffdad6]"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="mb-3 text-base font-bold leading-snug text-[#1E3A5F]">{project.title}</h3>

              {/* Encadrant */}
              <div className="mb-2">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#64748B]">Encadrant</p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: getColorFromString(project.supervisor) }}
                  >
                    {getEncadrantInitials(project.supervisor)}
                  </div>
                  <span className="truncate text-sm font-semibold text-[#1a1c1a]">{project.supervisor}</span>
                </div>
              </div>

              {/* Group */}
              <div className="mb-3 flex-1">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#64748B]">Groupe</p>
                <div className="flex items-center gap-2">
                  <Users size={14} className="shrink-0 text-[#64748B]" />
                  <span className="truncate text-sm font-semibold text-[#1a1c1a]">{project.group}</span>
                </div>
              </div>

              {/* Progression */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B]">Progression</span>
                  <span className="text-xs font-bold text-[#1a1c1a]">{project.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e3da]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: project.progress >= 80 ? '#10B981' : project.progress > 0 ? '#1E3A5F' : '#C8D6E5',
                    }}
                  />
                </div>
              </div>

              {/* Footer: deadline */}
              {project.deadline && (
                <div className="flex items-center gap-1.5 border-t border-[#e8e3da] pt-2.5">
                  <Calendar size={12} className="shrink-0 text-[#ba1a1a]" />
                  <span className="text-xs font-medium text-[#ba1a1a]">
                    Échéance {formatDeadlineDate(project.deadline)}
                  </span>
                </div>
              )}
            </motion.div>
          ))}

          {/* New Project card */}
          <button
            type="button"
            onClick={openCreateModal}
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-transparent p-4 transition hover:border-[#1E3A5F] hover:bg-[#DCEBFA]/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-transparent">
              <Plus size={18} className="text-[#64748B]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#334155]">Nouveau projet</p>
              <p className="mt-0.5 text-xs text-[#64748B]">Cliquez ici pour créer un nouvel espace collaboratif</p>
            </div>
          </button>
        </div>
      </div>

      {/* Créer Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F172A]/35 p-4 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#EEF3F8] bg-white px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#DCEBFA] text-[#1E3A5F]">
                  <FolderPlus size={22} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[#1a1c1a]">Créer un projet</h2>
                  <p className="mt-1 text-sm text-[#64748B]">Définissez le périmètre et l'encadrant du nouveau projet.</p>
                </div>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#64748B] transition-colors hover:text-[#1a1c1a]"
                onClick={() => setShowModal(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-5 px-6 py-6">
              {formError && (
                <div className="rounded-xl border border-[#fecaca] bg-[#ffdad6] px-4 py-3 text-sm text-[#ba1a1a] flex items-center gap-2 animate-in slide-in-from-top-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#334155]">
                  Nom du projet <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Entrer le titre du projet"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#334155]">Catégorie / Domaine</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="ex: Informatique, IA, IoT..."
                  value={form.domaine}
                  onChange={(e) => setForm((f) => ({ ...f, domaine: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#334155]">Encadrant</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEncadrantDropdown(!showEncadrantDropdown)}
                    className={inputClass + ' flex items-center justify-between text-left'}
                  >
                    <span className={!form.encadrantId ? 'text-[#64748B]' : 'text-[#1a1c1a]'}>
                      {form.encadrantId 
                        ? encadrantOptions.find(e => e.id === form.encadrantId)?.displayName 
                        : '-- Aucun --'}
                    </span>
                    <MoreVertical size={14} className={`rotate-90 text-[#64748B] transition-transform ${showEncadrantDropdown ? 'rotate-[270deg]' : ''}`} />
                  </button>

                  {showEncadrantDropdown && (
                    <div className="mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[#D8E2EC] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-all animate-in fade-in slide-in-from-top-1">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, encadrantId: '' }));
                          setShowEncadrantDropdown(false);
                        }}
                        className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors ${!form.encadrantId ? 'bg-[#1E3A5F] text-white' : 'text-[#1a1c1a] hover:bg-[#1E3A5F]/5'}`}
                      >
                        -- Aucun --
                      </button>
                      {encadrantOptions.map((enc) => (
                        <button
                          key={enc.id}
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, encadrantId: enc.id }));
                            setShowEncadrantDropdown(false);
                          }}
                          className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors ${form.encadrantId === enc.id ? 'bg-[#1E3A5F] text-white' : 'text-[#1a1c1a] hover:bg-[#1E3A5F]/5'}`}
                        >
                          {enc.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#334155]">Date limite</label>
                <div className="relative">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#EEF3F8] pt-5">
                <button
                  type="button"
                  className="rounded-xl bg-[#EEF3F8] px-5 py-3 text-sm font-bold text-[#334155] transition-colors hover:bg-[#E2E8F0]"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#172D49] disabled:bg-[#BFD7EF]"
                  disabled={createLoading}
                >
                  {createLoading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Supprimer Confirm Modal */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md transition-all animate-in fade-in duration-300 sm:items-center">
          <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl border border-transparent bg-white p-6 shadow-xl sm:p-8">
            <h2 className="text-xl font-bold text-[#1a1c1a]">Confirmer la suppression</h2>
            <p className="text-sm text-[#64748B]">Cette action supprimera le projet, ses itérations, ses tâches et détachera ses étudiants. Elle est irréversible.</p>
            {formError && <div className="rounded-xl border border-[#fecaca] bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{formError}</div>}
            <div className="mt-2 flex justify-end gap-3">
              <button type="button" className="rounded-xl bg-[#E5EDF5] px-5 py-2 text-sm font-semibold text-[#334155] hover:bg-[#D5E1ED]" onClick={() => setSupprimerConfirmId(null)} disabled={deleteLoading}>Annuler</button>
              <button type="button" className="rounded-xl bg-[#ba1a1a] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#93000a] disabled:opacity-50" onClick={() => handleSupprimerProject(deleteConfirmId)} disabled={deleteLoading}>
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminProjects;







