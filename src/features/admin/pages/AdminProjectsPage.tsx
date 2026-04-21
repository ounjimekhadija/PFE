import React, { useEffect, useState } from 'react';
import { Plus, User, Target, Clock, Trash2 } from 'lucide-react';
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

  const [form, setForm] = useState({
    title: '',
    domaine: '',
    encadrantId: '',
    nomGroupe: '',
    deadline: '',
  });

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

      // Build encadrant options for the form
      setEncadrantOptions(
        users.map((u) => ({
          id: u.id,
          displayName: [u.nom, u.prenom].filter(Boolean).join(' ') || 'Inconnu',
        }))
      );

      // Build user lookup for supervisor names
      const userById = new Map<string, DbUtilisateur>();
      users.forEach((u) => userById.set(u.id, u));

      // Build iteration → project map
      const itersByProject = new Map<string, string[]>();
      iterations.forEach((it) => {
        if (!it.projet_id) return;
        const list = itersByProject.get(it.projet_id) || [];
        list.push(it.id);
        itersByProject.set(it.projet_id, list);
      });

      // Build tache counts per iteration
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
          if (counts) {
            total += counts.total;
            done += counts.done;
          }
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

  useEffect(() => {
    fetchData();
  }, []);

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

    if (!form.title.trim()) {
      setFormError('Le titre du projet est obligatoire.');
      return;
    }

    try {
      setCreateLoading(true);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titre: form.title,
          domaine: form.domaine || null,
          encadrantId: form.encadrantId || null,
          nomGroupe: form.nomGroupe || null,
          deadline: form.deadline || null,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Creation echouee.');

      setFormSuccess('Projet cree avec succes.');
      setShowModal(false);
      setForm({ title: '', domaine: '', encadrantId: '', nomGroupe: '', deadline: '' });
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

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-500 mt-1">Create projects, assign supervisors, and set global deadlines.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <input
            type="text"
            placeholder="Rechercher..."
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white w-48"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-black transition-all shadow-md"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setForm({ title: '', domaine: '', encadrantId: '', nomGroupe: '', deadline: '' });
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      </header>

      {/* Feedback messages */}
      {formError && !showModal && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}
      {formSuccess && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{formSuccess}</div>
      )}
      {loading && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Chargement des projets...
        </div>
      )}
      {!loading && error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Projects Grid */}
      {!loading && !error && filteredProjects.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">Aucun projet trouve.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <motion.div
            key={project.id}
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg">
                {project.category}
              </span>
              <button
                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-40"
                title="Supprimer le projet"
                onClick={() => setDeleteConfirmId(project.id)}
                disabled={deleteLoading}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-4">{project.title}</h3>

            <div className="space-y-2 mb-6 flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User size={15} className="text-gray-400 shrink-0" />
                <span className="font-medium">Supervisor:</span>
                <span className="text-gray-900 truncate">{project.supervisor}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Target size={15} className="text-gray-400 shrink-0" />
                <span className="font-medium">Group:</span>
                <span className="text-gray-900">{project.group}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={15} className="text-gray-400 shrink-0" />
                <span className="font-medium">Deadline:</span>
                <span className={project.deadline ? 'text-red-500 font-bold' : 'text-gray-400'}>
                  {project.deadline || 'N/A'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</span>
                <span className="text-xs font-bold text-indigo-600">{project.progress}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative my-8">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="px-8 pt-8 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Create Project</h2>
            </div>
            <form onSubmit={handleCreateProject} className="px-8 py-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1">Project Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Filière / Domaine</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  placeholder="ex: Informatique, IA, IoT..."
                  value={form.domaine}
                  onChange={e => setForm(f => ({ ...f, domaine: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Encadrant (Supervisor)</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400 bg-white"
                  value={form.encadrantId}
                  onChange={e => setForm(f => ({ ...f, encadrantId: e.target.value }))}
                >
                  <option value="">-- Aucun --</option>
                  {encadrantOptions.map(enc => (
                    <option key={enc.id} value={enc.id}>{enc.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Nom du groupe</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  placeholder="ex: EventMaster, LearnAI..."
                  value={form.nomGroupe}
                  onChange={e => setForm(f => ({ ...f, nomGroupe: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Deadline</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow disabled:opacity-50"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creation...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-gray-600 text-sm">
              Cette action supprimera le projet, ses itérations, ses tâches et détachera ses étudiants. Irréversible.
            </p>
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
            )}
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteLoading}
              >
                Annuler
              </button>
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow disabled:opacity-50"
                onClick={() => handleDeleteProject(deleteConfirmId)}
                disabled={deleteLoading}
              >
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
