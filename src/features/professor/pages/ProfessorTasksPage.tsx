import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Send, X, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { notifyProjectStudents, notifyAdmins } from '../../../lib/notifications';
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
  PENDING:     { label: 'A faire',     color: 'bg-[#EEF3F8] text-[#64748B]',       dot: '#C8D6E5' },
  IN_PROGRESS: { label: 'En cours',    color: 'bg-[#DCEBFA]/20 text-[#1E3A5F]',    dot: '#DCEBFA' },
  DONE:        { label: 'Terminee',    color: 'bg-[#dcfce7] text-[#166534]',        dot: '#22c55e' },
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
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [openIterProjectDropdown, setOpenIterProjectDropdown] = useState(false);
  const [openIterStatusDropdown, setOpenIterStatusDropdown] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const iterProjectDropdownRef = useRef<HTMLDivElement>(null);
  const iterStatusDropdownRef = useRef<HTMLDivElement>(null);

  const [showIterModal, setShowIterModal] = useState(false);
  const [iterForm, setIterForm] = useState({ projectId: '', numero: 1, objectif: '', dateDebut: '', dateFin: '', statut: 'A_FAIRE' });
  const [iterSaving, setIterSaving] = useState(false);
  const [iterError, setIterError] = useState<string | null>(null);

  const handleCreateIteration = async () => {
    if (!iterForm.projectId || !iterForm.dateDebut || !iterForm.dateFin) {
      setIterError('Group, start date, and end date are required.');
      return;
    }
    if (iterForm.dateFin < iterForm.dateDebut) {
      setIterError('The end date must be after the start date.');
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

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Notify admins
        await notifyAdmins({
          senderId: user.id,
          projectId: currentIteration.projectId,
          title: 'Itération Validée',
          message: `L'itération ${currentIteration.numero} du projet "${currentIteration.projectTitle}" a été validée.`,
          type: 'VALIDATION_ITERATION'
        });

        // Notify students
        await notifyProjectStudents({
          projectId: currentIteration.projectId,
          senderId: user.id,
          title: 'Iteration Validated',
          message: `Iteration ${currentIteration.numero} of "${currentIteration.projectTitle}" has been validated.`,
          type: 'VALIDATION_ITERATION'
        });
      }
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

        const currentIter = mappedIters.find((it: any) => it.statut === 'EN_COURS') || mappedIters.find((it: any) => it.statut === 'A_FAIRE');
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
          const assignee = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Unassigned' : 'Unassigned';
          const projectId = projectByIter[String(t.iteration_id)] || '';
          return {
            id: String(t.id),
            title: t.titre || 'Untitled task',
            description: t.description || 'No description.',
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

        const firstProjId = projectList[0]?.id || null;
        setAllTasks(mapped);
        setTasks(firstProjId ? mapped.filter((t: any) => t.projectId === firstProjId) : []);
        setSelectedProjectId(firstProjId);
        const firstProjectIters = firstProjId ? mappedIters.filter((it: any) => it.projectId === firstProjId) : [];
        const current = firstProjectIters.find((it: any) => it.statut === 'EN_COURS') || firstProjectIters.find((it: any) => it.statut === 'A_FAIRE');
        setCurrentIteration(current || null);
        setSelectedIterationId(current?.id || 'all');

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
      const baseTasks = !selectedProjectId
        ? allTasks
        : allTasks.filter((t: any) => t.projectId === selectedProjectId);
      
      setTasks(selectedIterationId === 'all'
        ? baseTasks
        : baseTasks.filter((t: any) => t.iterationId === selectedIterationId)
      );
    }
  }, [selectedIterationId, selectedProjectId, allTasks]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (iterProjectDropdownRef.current && !iterProjectDropdownRef.current.contains(e.target as Node)) {
        setOpenIterProjectDropdown(false);
      }
      if (iterStatusDropdownRef.current && !iterStatusDropdownRef.current.contains(e.target as Node)) {
        setOpenIterStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  const visibleIterations = !selectedProjectId
    ? allIterations
    : allIterations.filter(it => it.projectId === selectedProjectId);
 
  const handleProjectFilter = (id: string) => {
    setSelectedProjectId(id);
    setSelectedIterationId('all');
    setTasks(allTasks.filter((t: any) => t.projectId === id));
    
    const projectIters = allIterations.filter(it => it.projectId === id);
    const current = projectIters.find(it => it.statut === 'EN_COURS') || projectIters.find(it => it.statut === 'A_FAIRE');
    setCurrentIteration(current || null);
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
    EN_COURS: 'bg-[#DCEBFA]/20 text-[#1E3A5F] border-[#DCEBFA]',
    A_FAIRE:  'bg-[#EEF3F8] text-[#64748B] border-[#C8D6E5]',
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

      // Notify students
      await notifyProjectStudents({
        projectId: selectedTask.projectId,
        senderId: user.id,
        title: 'New Comment on Task',
        message: `Professor added a comment on task "${selectedTask.title}".`,
        type: 'COMMENT_TACHE'
      });
    }
    setSending(false);
  };

  const columns: { key: TaskCard['status']; label: string; color: string }[] = [
    { key: 'PENDING',     label: 'A faire',     color: '#C8D6E5' },
    { key: 'IN_PROGRESS', label: 'En cours',    color: '#DCEBFA' },
    { key: 'DONE',        label: 'Terminees',   color: '#22c55e' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-4 sm:px-6 lg:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Taches des groupes</h1>
          <p className="mt-1 text-sm text-[#64748B]">Consultez l'avancement, validez les iterations et laissez des commentaires.</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {projects.length > 1 && (
            <div className="relative" ref={projectDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#C8D6E5] bg-white px-4 py-2 text-sm font-semibold text-[#334155] shadow-sm transition hover:border-[#1E3A5F] hover:shadow-md active:scale-95 sm:min-w-[160px]"
              >
                <span className="truncate">
                  {projects.find(p => p.id === selectedProjectId)?.title || 'Selectionner un projet'}
                </span>
                <ChevronDown size={14} className={`text-[#64748B] transition-transform duration-200 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProjectDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-transparent bg-white/95 p-1.5 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { handleProjectFilter(p.id); setIsProjectDropdownOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${selectedProjectId === p.id ? 'bg-[#DCEBFA]/20 text-[#1E3A5F]' : 'text-[#334155] hover:bg-[#EEF3F8]'}`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${selectedProjectId === p.id ? 'bg-[#1E3A5F]' : 'bg-transparent'}`} />
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setIterForm({ projectId: projects[0]?.id || '', numero: 1, objectif: '', dateDebut: '', dateFin: '', statut: 'A_FAIRE' }); setIterError(null); setShowIterModal(true); }}
            disabled={projects.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172D49] disabled:opacity-40 sm:w-auto"
          >
            <Plus size={15} /> Nouvelle iteration
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-[#64748B]">Chargement des taches...</p>}
      {!loading && allIterations.length === 0 && (
        <p className="text-sm text-[#64748B]">Aucune iteration trouvee. Creez une iteration pour commencer.</p>
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
                    Valider l'iteration
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
        <div className="flex min-h-0 justify-center overflow-x-auto pb-1">
          <div className="flex w-max gap-5">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="flex w-[82vw] max-w-[28rem] shrink-0 flex-col rounded-2xl border border-[#DCEBFA] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)] sm:w-[26rem]">
                {/* Column header */}
                <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-[#EEF3F8] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-bold text-[#1a1c1a]">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[11px] font-bold text-[#64748B]">{colTasks.length}</span>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-3 overflow-y-auto p-3 max-h-[400px]">
                  {colTasks.length === 0 && (
                    <p className="py-6 text-center text-xs text-[#C8D6E5]">Aucune tache</p>
                  )}
                  {colTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task)}
                      className="w-full rounded-xl border border-[#EEF3F8] bg-[#F8FAFC] p-4 text-left transition hover:border-[#C8D6E5] hover:shadow-sm"
                    >
                      {/* Priority badge */}
                      {task.priority === 'HIGH' && (
                        <span className="mb-2 inline-block rounded-md bg-[#ffdad6] px-2 py-0.5 text-[9px] font-bold uppercase text-[#ba1a1a]">Urgent</span>
                      )}
                      <p className="mb-1 text-sm font-semibold text-[#1a1c1a] leading-snug">{task.title}</p>
                      <p className="mb-2 text-[10px] text-[#1E3A5F] font-medium">{task.projectTitle}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&size=20&background=random`}
                            alt=""
                            className="h-4 w-4 rounded-full"
                          />
                          <span className="truncate max-w-[90px]">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                          <MessageSquare size={11} />
                          {task.commentCount}
                        </div>
                      </div>
                      <p className="mt-2 text-[9px] text-[#C8D6E5]">{task.dateLabel}</p>
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
        </div>
      )}
      {/* end kanban */}

      {/* Create Iteration Modal */}
      {showIterModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md transition-all animate-in fade-in duration-300 sm:items-center" onClick={() => setShowIterModal(false)}>
          <div className="my-4 max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-transparent bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.15)] sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1a1c1a]">New Iteration</h2>
              <button onClick={() => setShowIterModal(false)} className="text-[#64748B] hover:text-[#1a1c1a]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">Group / Project</label>
                <div className="relative" ref={iterProjectDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOpenIterProjectDropdown(!openIterProjectDropdown)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] py-2.5 pl-4 pr-3 text-sm font-semibold text-[#334155] outline-none transition hover:border-[#1E3A5F]"
                  >
                    <span className="truncate">
                      {projects.find(p => p.id === iterForm.projectId)?.title || 'Select Project'}
                    </span>
                    <ChevronDown size={14} className={`text-[#64748B] transition-transform ${openIterProjectDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {openIterProjectDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full origin-top rounded-xl border border-[#EEF3F8] bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setIterForm(f => ({ ...f, projectId: p.id })); setOpenIterProjectDropdown(false); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${iterForm.projectId === p.id ? 'bg-[#DCEBFA]/20 text-[#1E3A5F]' : 'text-[#334155] hover:bg-[#EEF3F8]'}`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${iterForm.projectId === p.id ? 'bg-[#1E3A5F]' : 'bg-transparent'}`} />
                          <span className="truncate">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">Number</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ex: 1"
                  value={iterForm.numero}
                  onChange={e => setIterForm(f => ({ ...f, numero: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#334155] outline-none focus:border-[#1E3A5F] placeholder:text-[#C8D6E5]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">Objectif</label>
                <textarea
                  placeholder="Describe the sprint objective..."
                  value={iterForm.objectif}
                  onChange={e => setIterForm(f => ({ ...f, objectif: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#334155] outline-none focus:border-[#1E3A5F] placeholder:text-[#C8D6E5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">Start Date</label>
                  <input
                    type="date"
                    value={iterForm.dateDebut}
                    onChange={e => setIterForm(f => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#334155] outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">End Date</label>
                  <input
                    type="date"
                    value={iterForm.dateFin}
                    onChange={e => setIterForm(f => ({ ...f, dateFin: e.target.value }))}
                    className="w-full rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#334155] outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#64748B]">Status</label>
                <div className="relative" ref={iterStatusDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOpenIterStatusDropdown(!openIterStatusDropdown)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] py-2.5 pl-4 pr-3 text-sm font-semibold text-[#334155] outline-none transition hover:border-[#1E3A5F]"
                  >
                    <span className="truncate">
                      {iterForm.statut === 'A_FAIRE' ? 'To Do' : iterForm.statut === 'EN_COURS' ? 'In Progress' : 'Validated'}
                    </span>
                    <ChevronDown size={14} className={`text-[#64748B] transition-transform ${openIterStatusDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {openIterStatusDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full origin-top rounded-xl border border-[#EEF3F8] bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                      {[
                        { v: 'A_FAIRE', l: 'To Do' },
                        { v: 'EN_COURS', l: 'In Progress' },
                        { v: 'VALIDE', l: 'Validated' }
                      ].map(o => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => { setIterForm(f => ({ ...f, statut: o.v })); setOpenIterStatusDropdown(false); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${iterForm.statut === o.v ? 'bg-[#DCEBFA]/20 text-[#1E3A5F]' : 'text-[#334155] hover:bg-[#EEF3F8]'}`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${iterForm.statut === o.v ? 'bg-[#1E3A5F]' : 'bg-transparent'}`} />
                          {o.l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {iterError && <p className="text-xs text-[#ba1a1a]">{iterError}</p>}

              <button
                type="button"
                onClick={handleCreateIteration}
                disabled={iterSaving}
                className="w-full rounded-xl bg-[#1E3A5F] py-2.5 text-sm font-bold text-white transition hover:bg-[#172D49] disabled:opacity-50"
              >
                {iterSaving ? 'Creating...' : 'Create Iteration'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Task detail panel */}
      {selectedTask && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md transition-all animate-in fade-in duration-300 sm:items-center" onClick={() => setSelectedTask(null)}>
          <div className="relative my-4 flex h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)] sm:h-[80vh]" onClick={e => e.stopPropagation()}>

            {/* Panel header */}
            <div className="flex shrink-0 items-start justify-between border-b border-[#EEF3F8] px-6 py-4">
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
                <p className="text-xs text-[#1E3A5F] font-medium">{selectedTask.projectTitle}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-[#64748B] hover:text-[#1a1c1a] transition">
                <X size={20} />
              </button>
            </div>

            {/* Details */}
            <div className="shrink-0 border-b border-[#EEF3F8] px-6 py-3">
              <div className="flex flex-col gap-2 text-xs text-[#64748B] sm:flex-row sm:items-center sm:gap-6">
                <span><span className="font-semibold text-[#334155]">Assigned to:</span> {selectedTask.assignee}</span>
                <span><span className="font-semibold text-[#334155]">Date:</span> {selectedTask.dateLabel}</span>
              </div>
              <p className="mt-2 text-sm text-[#334155] leading-relaxed">{selectedTask.description}</p>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                Comments ({selectedTask.commentCount})
              </p>
              {loadingComments && <p className="text-xs text-[#64748B]">Loading...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-[#C8D6E5]">No comments yet. Be the first!</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&size=28&background=random`}
                    className="h-7 w-7 shrink-0 rounded-full"
                    alt=""
                  />
                  <div className="flex-1 rounded-xl bg-[#F8FAFC] px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#1a1c1a]">{c.author}</span>
                      <span className="text-[10px] text-[#64748B]">{c.time}</span>
                    </div>
                    <p className="text-xs text-[#334155]">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <div className="shrink-0 border-t border-[#EEF3F8] px-6 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#C8D6E5] bg-[#F8FAFC] px-3 py-2 focus-within:border-[#1E3A5F]">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendComment(); } }}
                  className="flex-1 bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#C8D6E5]"
                />
                <button
                  type="button"
                  onClick={sendComment}
                  disabled={!commentInput.trim() || sending}
                  className="text-[#1E3A5F] transition hover:text-[#172D49] disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tasks;
