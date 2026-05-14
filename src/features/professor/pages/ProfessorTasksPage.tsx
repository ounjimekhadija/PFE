import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, X, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import DeliverablesCard from '../../../shared/components/DeliverablesCard';

interface TaskCard {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  priority: string | null;
  dateLabel: string;
  commentCount: number;
  projectTitle: string;
  projectId: string;
  iterationId: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  time: string;
}

interface Project {
  id: string;
  title: string;
}

interface Deliverable {
  id: string;
  title: string;
  description: string;
  file_url: string | null;
  link_url: string | null;
  created_at: string;
}

interface Iteration {
  id: string;
  numero: number;
  objectif: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  projectId: string;
  projectTitle: string;
}

const statusConfig = {
  PENDING:     { label: 'Pending',     color: 'bg-[#f4f3f1] text-[#7f7664]',       dot: '#d1c5b0' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-[#ffd464]/20 text-[#765b00]',    dot: '#ffd464' },
  DONE:        { label: 'Done',        color: 'bg-[#dcfce7] text-[#166534]',        dot: '#22c55e' },
};

const toStatus = (etat: string | null): TaskCard['status'] => {
  if (etat === 'TERMINE') return 'DONE';
  if (etat === 'EN_COURS') return 'IN_PROGRESS';
  return 'PENDING';
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

const Tasks: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [allTasks, setAllTasks] = useState<TaskCard[]>([]);
  const [allIterations, setAllIterations] = useState<Iteration[]>([]);
  const [selectedIterationId, setSelectedIterationId] = useState<string | null>(null);
  const [currentIteration, setCurrentIteration] = useState<Iteration | null>(null);
  const [validatedIterations, setValidatedIterations] = useState<Iteration[]>([]);
  const [selectedValidatedIter, setSelectedValidatedIter] = useState<Iteration | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);

  const [showIterModal, setShowIterModal] = useState(false);
  const [iterForm, setIterForm] = useState({ projectId: '', numero: 1, objectif: '', dateDebut: '', dateFin: '', statut: 'A_FAIRE' });
  const [iterSaving, setIterSaving] = useState(false);
  const [iterError, setIterError] = useState<string | null>(null);

  const handleCreateIteration = async () => {
    if (!iterForm.projectId || !iterForm.dateDebut || !iterForm.dateFin) {
      setIterError('Le groupe, la date de début et la date de fin sont requis.');
      return;
    }
    if (iterForm.dateFin < iterForm.dateDebut) {
      setIterError('La date de fin doit être après la date de début.');
      return;
    }
    setIterSaving(true);
    setIterError(null);
    const { error } = await supabase.from('iterations').insert({
      projet_id: iterForm.projectId,
      numero: iterForm.numero,
      objectif: iterForm.objectif || null,
      date_debut: iterForm.dateDebut,
      date_fin: iterForm.dateFin,
      statut: iterForm.statut,
    });
    setIterSaving(false);
    if (error) { setIterError(error.message); return; }
    setShowIterModal(false);
    setIterForm({ projectId: '', numero: 1, objectif: '', dateDebut: '', dateFin: '', statut: 'A_FAIRE' });
  };

  const handleValidateIteration = async () => {
    if (!currentIteration) return;
    const { error } = await supabase
      .from('iterations')
      .update({ statut: 'VALIDE' })
      .eq('id', currentIteration.id);
    if (!error) {
      // Refresh data or update state locally
      const updatedIters = allIterations.map(it => it.id === currentIteration.id ? { ...it, statut: 'VALIDE' } : it);
      setAllIterations(updatedIters);
      setCurrentIteration(null);
      // Add to validated list
      setValidatedIterations(prev => [...prev, { ...currentIteration, statut: 'VALIDE' }]);
    }
  };

  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: projectRows } = await supabase
          .from('projets').select('id, titre').eq('encadrant_id', user.id);

        if (!projectRows || projectRows.length === 0) { setLoading(false); return; }

        const projectList: Project[] = projectRows.map((p: any) => ({ id: String(p.id), title: p.titre || 'Projet' }));
        setProjects(projectList);

        const projectIds = projectRows.map((p: any) => p.id);
        const projectTitleById: Record<string, string> = {};
        projectRows.forEach((p: any) => { projectTitleById[String(p.id)] = p.titre || 'Projet'; });

        const { data: iterRows } = await supabase
          .from('iterations')
          .select('id, projet_id, numero, objectif, date_debut, date_fin, statut')
          .in('projet_id', projectIds)
          .order('numero', { ascending: true });

        const iterIds = (iterRows || []).map((it: any) => String(it.id));
        const projectByIter: Record<string, string> = {};
        (iterRows || []).forEach((it: any) => { projectByIter[String(it.id)] = String(it.projet_id); });

        const mappedIters: Iteration[] = (iterRows || []).map((it: any) => ({
          id: String(it.id),
          numero: it.numero,
          objectif: it.objectif || '',
          dateDebut: it.date_debut,
          dateFin: it.date_fin,
          statut: it.statut,
          projectId: String(it.projet_id),
          projectTitle: projectTitleById[String(it.projet_id)] || 'Projet',
        }));
        setAllIterations(mappedIters);
        setValidatedIterations(mappedIters.filter(it => it.statut === 'VALIDE'));

        const currentIter = mappedIters.find(it => it.statut === 'EN_COURS');
        setCurrentIteration(currentIter || null);
        setSelectedIterationId(currentIter?.id || 'all');

        if (iterIds.length === 0) { setLoading(false); return; }

        const { data: taskRows } = await supabase
          .from('taches')
          .select(`id, titre, description, priorite, etat, created_at, iteration_id,
            tache_assignations(etudiants(utilisateurs(nom, prenom))),
            tache_commentaires(id)`)
          .in('iteration_id', iterIds)
          .order('created_at', { ascending: false });

        const mapped: TaskCard[] = (taskRows || []).map((t: any) => {
          const assignation = t.tache_assignations?.[0];
          const u = assignation?.etudiants?.utilisateurs;
          const assignee = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Non assigné' : 'Non assigné';
          const projectId = projectByIter[String(t.iteration_id)] || '';
          return {
            id: String(t.id),
            title: t.titre || 'Tâche sans titre',
            description: t.description || 'Aucune description.',
            assignee,
            status: toStatus(t.etat),
            priority: t.priorite,
            dateLabel: t.created_at ? fmt(t.created_at) : '—',
            commentCount: Array.isArray(t.tache_commentaires) ? t.tache_commentaires.length : 0,
            projectTitle: projectTitleById[projectId] || 'Projet',
            projectId,
            iterationId: String(t.iteration_id),
          } as TaskCard & { iterationId: string };
        });

        setAllTasks(mapped);
        setTasks(mapped);
        setSelectedProjectId('all');
        
        const current = mappedIters.find(it => it.statut === 'EN_COURS');
        setCurrentIteration(current || null);
        setSelectedIterationId(current?.id || null);

      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchDeliverables = async () => {
      if (!selectedValidatedIter) {
        setDeliverables([]);
        return;
      }
      setLoadingDeliverables(true);
      const { data, error } = await supabase
        .from('livrables')
        .select('id, titre, description, file_url, link_url, created_at')
        .eq('iteration_id', selectedValidatedIter.id);
      
      if (data) {
        setDeliverables(data.map((d: any) => ({
          id: d.id,
          title: d.titre,
          description: d.description,
          file_url: d.file_url,
          link_url: d.link_url,
          created_at: d.created_at,
        })));
      }
      setLoadingDeliverables(false);
    };
    fetchDeliverables();
  }, [selectedValidatedIter]);

  useEffect(() => {
    if (selectedIterationId) {
      const baseTasks = selectedProjectId === 'all' || !selectedProjectId
        ? allTasks
        : allTasks.filter((t: any) => t.projectId === selectedProjectId);
      
      setTasks(selectedIterationId === 'all'
        ? baseTasks
        : baseTasks.filter((t: any) => t.iterationId === selectedIterationId)
      );
    }
  }, [selectedIterationId, selectedProjectId, allTasks]);

  const visibleIterations = selectedProjectId === 'all' || !selectedProjectId
    ? allIterations
    : allIterations.filter(it => it.projectId === selectedProjectId);

  const handleProjectFilter = (id: string) => {
    setSelectedProjectId(id);
    setSelectedIterationId('all');
    setTasks(id === 'all' ? allTasks : allTasks.filter((t: any) => t.projectId === id));
  };

  const handleIterationFilter = (id: string) => {
    setSelectedIterationId(id);
  };

  const handleValidatedIterationSelect = (iterId: string) => {
    if (iterId === 'none') {
      setSelectedValidatedIter(null);
    } else {
      const iter = validatedIterations.find(it => it.id === iterId);
      setSelectedValidatedIter(iter || null);
    }
  };

  const statutColor: Record<string, string> = {
    EN_COURS: 'bg-[#ffd464]/20 text-[#765b00] border-[#ffd464]',
    A_FAIRE:  'bg-[#f4f3f1] text-[#7f7664] border-[#d1c5b0]',
    VALIDE:   'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  };

  const openTask = async (task: TaskCard) => {
    setSelectedTask(task);
    setCommentInput('');
    setLoadingComments(true);
    const { data } = await supabase
      .from('tache_commentaires')
      .select('id, contenu, created_at, utilisateurs(nom, prenom)')
      .eq('tache_id', task.id)
      .order('created_at', { ascending: true });

    setComments((data || []).map((c: any) => {
      const u = Array.isArray(c.utilisateurs) ? c.utilisateurs[0] : c.utilisateurs;
      return {
        id: String(c.id),
        author: u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Utilisateur',
        content: c.contenu,
        time: fmt(c.created_at),
      };
    }));
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!commentInput.trim() || !selectedTask) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const { data, error } = await supabase
      .from('tache_commentaires')
      .insert({ tache_id: selectedTask.id, auteur_id: user.id, contenu: commentInput.trim() })
      .select('id, contenu, created_at, utilisateurs(nom, prenom)')
      .single();

    if (!error && data) {
      const u = Array.isArray(data.utilisateurs) ? data.utilisateurs[0] : data.utilisateurs;
      setComments(prev => [...prev, {
        id: String(data.id),
        author: u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Moi',
        content: data.contenu,
        time: fmt(data.created_at),
      }]);
      setSelectedTask(t => t ? { ...t, commentCount: t.commentCount + 1 } : t);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, commentCount: t.commentCount + 1 } : t));
      setCommentInput('');
    }
    setSending(false);
  };

  const columns: { key: TaskCard['status']; label: string; color: string }[] = [
    { key: 'PENDING',     label: 'Pending',     color: '#d1c5b0' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#ffd464' },
    { key: 'DONE',        label: 'Done',        color: '#22c55e' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#faf9f6] p-5" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Task Board</h1>
          <p className="text-sm text-[#7f7664]">Group tasks — view only, leave comments</p>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <div className="relative">
              <select
                value={selectedProjectId || 'all'}
                onChange={(e) => handleProjectFilter(e.target.value)}
                className="appearance-none rounded-xl border border-[#d1c5b0] bg-white py-2 pl-4 pr-9 text-sm font-semibold text-[#4d4636] outline-none focus:border-[#765b00]"
              >
                <option value="all">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7f7664]" />
            </div>
          )}
          <button
            type="button"
            onClick={() => { setIterForm({ projectId: projects[0]?.id || '', numero: 1, objectif: '', dateDebut: '', dateFin: '', statut: 'A_FAIRE' }); setIterError(null); setShowIterModal(true); }}
            disabled={projects.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#765b00] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#594400] disabled:opacity-40"
          >
            <Plus size={15} /> New Iteration
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-[#7f7664]">Chargement des tâches...</p>}
      {!loading && allIterations.length === 0 && (
        <p className="text-sm text-[#7f7664]">Aucune itération trouvée. Créez une itération pour commencer.</p>
      )}

      {/* Iterations strip */}
      {!loading && currentIteration && (
        <div className="mb-4 flex shrink-0 items-center gap-3 overflow-x-auto pb-1">
          {
            (() => {
              const iterationTasks = tasks.filter(t => t.iterationId === currentIteration.id);
              const allTasksDone = iterationTasks.length > 0 && iterationTasks.every(t => t.status === 'DONE');
              
              if (allTasksDone) {
                return (
                  <button
                    onClick={handleValidateIteration}
                    className="rounded-xl bg-green-500 px-4 py-2 text-xs font-bold text-white"
                  >
                    Valider l'itération
                  </button>
                );
              }
              return null;
            })()
          }
        </div>
      )}

      {/* Kanban board — always shown when iterations exist */}
      {!loading && allIterations.length > 0 && (
        <div className="flex min-h-0 gap-4 overflow-x-auto pb-1 justify-center">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="flex w-72 shrink-0 flex-col rounded-2xl border border-[#d1c5b0] bg-white shadow-[0_2px_8px_rgba(118,91,0,0.05)]">
                {/* Column header */}
                <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-[#f4f3f1] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-bold text-[#1a1c1a]">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-[#f4f3f1] px-2 py-0.5 text-[11px] font-bold text-[#7f7664]">{colTasks.length}</span>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-3 overflow-y-auto p-3 max-h-[400px]">
                  {colTasks.length === 0 && (
                    <p className="py-6 text-center text-xs text-[#d1c5b0]">No tasks</p>
                  )}
                  {colTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task)}
                      className="w-full rounded-xl border border-[#f4f3f1] bg-[#faf9f6] p-3 text-left transition hover:border-[#d1c5b0] hover:shadow-sm"
                    >
                      {/* Priority badge */}
                      {task.priority === 'HIGH' && (
                        <span className="mb-2 inline-block rounded-md bg-[#ffdad6] px-2 py-0.5 text-[9px] font-bold uppercase text-[#ba1a1a]">Urgent</span>
                      )}
                      <p className="mb-1 text-sm font-semibold text-[#1a1c1a] leading-snug">{task.title}</p>
                      <p className="mb-2 text-[10px] text-[#765b00] font-medium">{task.projectTitle}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-[#7f7664]">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&size=20&background=random`}
                            alt=""
                            className="h-4 w-4 rounded-full"
                          />
                          <span className="truncate max-w-[90px]">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#7f7664]">
                          <MessageSquare size={11} />
                          {task.commentCount}
                        </div>
                      </div>
                      <p className="mt-2 text-[9px] text-[#d1c5b0]">{task.dateLabel}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {selectedValidatedIter && (
            <DeliverablesCard
              iterationNumber={selectedValidatedIter.numero}
              deliverables={deliverables}
            />
          )}
        </div>
      )}
      {/* end kanban */}

      {/* Create Iteration Modal */}
      {showIterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]" onClick={() => setShowIterModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#d1c5b0] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1a1c1a]">New Iteration</h2>
              <button onClick={() => setShowIterModal(false)} className="text-[#7f7664] hover:text-[#1a1c1a]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">Group / Project</label>
                <div className="relative">
                  <select
                    value={iterForm.projectId}
                    onChange={e => setIterForm(f => ({ ...f, projectId: e.target.value }))}
                    className="w-full appearance-none rounded-xl border border-[#d1c5b0] bg-[#faf9f6] py-2.5 pl-4 pr-9 text-sm font-semibold text-[#4d4636] outline-none focus:border-[#765b00]"
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7f7664]" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">Numéro</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ex: 1"
                  value={iterForm.numero}
                  onChange={e => setIterForm(f => ({ ...f, numero: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-4 py-2.5 text-sm text-[#4d4636] outline-none focus:border-[#765b00] placeholder:text-[#d1c5b0]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">Objectif</label>
                <textarea
                  placeholder="Describe the sprint objective..."
                  value={iterForm.objectif}
                  onChange={e => setIterForm(f => ({ ...f, objectif: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-4 py-2.5 text-sm text-[#4d4636] outline-none focus:border-[#765b00] placeholder:text-[#d1c5b0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">Start Date</label>
                  <input
                    type="date"
                    value={iterForm.dateDebut}
                    onChange={e => setIterForm(f => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-3 py-2.5 text-sm text-[#4d4636] outline-none focus:border-[#765b00]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">End Date</label>
                  <input
                    type="date"
                    value={iterForm.dateFin}
                    onChange={e => setIterForm(f => ({ ...f, dateFin: e.target.value }))}
                    className="w-full rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-3 py-2.5 text-sm text-[#4d4636] outline-none focus:border-[#765b00]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#7f7664]">Status</label>
                <div className="relative">
                  <select
                    value={iterForm.statut}
                    onChange={e => setIterForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full appearance-none rounded-xl border border-[#d1c5b0] bg-[#faf9f6] py-2.5 pl-4 pr-9 text-sm font-semibold text-[#4d4636] outline-none focus:border-[#765b00]"
                  >
                    <option value="A_FAIRE">À faire</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="VALIDE">Validé</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7f7664]" />
                </div>
              </div>

              {iterError && <p className="text-xs text-[#ba1a1a]">{iterError}</p>}

              <button
                type="button"
                onClick={handleCreateIteration}
                disabled={iterSaving}
                className="w-full rounded-xl bg-[#765b00] py-2.5 text-sm font-bold text-white transition hover:bg-[#594400] disabled:opacity-50"
              >
                {iterSaving ? 'Création...' : 'Create Iteration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]" onClick={() => setSelectedTask(null)}>
          <div className="relative flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d1c5b0] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Panel header */}
            <div className="flex shrink-0 items-start justify-between border-b border-[#f4f3f1] px-6 py-4">
              <div className="flex-1 pr-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${statusConfig[selectedTask.status].color}`}>
                    {statusConfig[selectedTask.status].label}
                  </span>
                  {selectedTask.priority === 'HIGH' && (
                    <span className="rounded-md bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ba1a1a]">Urgent</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#1a1c1a]">{selectedTask.title}</h2>
                <p className="text-xs text-[#765b00] font-medium">{selectedTask.projectTitle}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-[#7f7664] hover:text-[#1a1c1a] transition">
                <X size={20} />
              </button>
            </div>

            {/* Details */}
            <div className="shrink-0 border-b border-[#f4f3f1] px-6 py-3">
              <div className="flex items-center gap-6 text-xs text-[#7f7664]">
                <span><span className="font-semibold text-[#4d4636]">Assigné à:</span> {selectedTask.assignee}</span>
                <span><span className="font-semibold text-[#4d4636]">Date:</span> {selectedTask.dateLabel}</span>
              </div>
              <p className="mt-2 text-sm text-[#4d4636] leading-relaxed">{selectedTask.description}</p>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">
                Comments ({selectedTask.commentCount})
              </p>
              {loadingComments && <p className="text-xs text-[#7f7664]">Chargement...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-[#d1c5b0]">No comments yet. Be the first!</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&size=28&background=random`}
                    className="h-7 w-7 shrink-0 rounded-full"
                    alt=""
                  />
                  <div className="flex-1 rounded-xl bg-[#faf9f6] px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#1a1c1a]">{c.author}</span>
                      <span className="text-[10px] text-[#7f7664]">{c.time}</span>
                    </div>
                    <p className="text-xs text-[#4d4636]">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <div className="shrink-0 border-t border-[#f4f3f1] px-6 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-3 py-2 focus-within:border-[#765b00]">
                <input
                  type="text"
                  placeholder="Ajouter un commentaire..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendComment(); } }}
                  className="flex-1 bg-transparent text-sm text-[#4d4636] outline-none placeholder:text-[#d1c5b0]"
                />
                <button
                  type="button"
                  onClick={sendComment}
                  disabled={!commentInput.trim() || sending}
                  className="text-[#765b00] transition hover:text-[#594400] disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
