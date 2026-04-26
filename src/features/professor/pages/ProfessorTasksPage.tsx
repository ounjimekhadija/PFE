import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface TaskCard {
  id: string;
  projectId: string;
  title: string;
  assignee: string;
  status: 'PENDING' | 'DONE' | 'URGENT';
  dateLabel: string;
  comments: number;
  description: string;
  projectTitle: string;
}

interface ColumnDef {
  id: string;
  title: string;
  subtitle: string;
  tasks: TaskCard[];
}

const formatDateLabel = (iso: string | null | undefined): string => {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date inconnue';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const toUiStatus = (etat: string | null | undefined, priorite: string | null | undefined): TaskCard['status'] => {
  if (etat === 'TERMINE') return 'DONE';
  if (priorite === 'HIGH') return 'URGENT';
  return 'PENDING';
};

const emptyColumns = (): ColumnDef[] => [];

const Tasks: React.FC = () => {
  const [columns, setColumns] = useState<ColumnDef[]>(emptyColumns());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalTasks, setModalTasks] = useState<TaskCard[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});

  const handleCommentChange = (taskId: string, value: string) => {
    setComments((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleTaskClick = (column: ColumnDef) => {
    setModalTasks(column.tasks);
    setModalTitle(column.title);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSendComment = async (taskId: string) => {
    const content = (comments[taskId] || '').trim();
    if (!content) return;

    try {
      setSendingTaskId(taskId);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Session non trouvee. Veuillez vous reconnecter.');
      }

      const { error: insertError } = await supabase.from('tache_commentaires').insert({
        tache_id: taskId,
        auteur_id: user.id,
        contenu: content,
      });

      if (insertError) throw insertError;

      setComments((prev) => ({ ...prev, [taskId]: '' }));

      setModalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, comments: t.comments + 1 } : t))
      );

      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => (t.id === taskId ? { ...t, comments: t.comments + 1 } : t)),
        }))
      );
    } catch (err) {
      console.error('Erreur envoi commentaire:', err);
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le commentaire.");
    } finally {
      setSendingTaskId(null);
    }
  };

  useEffect(() => {
    const fetchProfessorProjectIds = async (authUserId: string): Promise<string[]> => {
      const projectIdSet = new Set<string>();

      const { data: directRows, error: directError } = await supabase
        .from('projets')
        .select('id')
        .eq('encadrant_id', authUserId);

      if (directError) throw directError;
      (directRows || []).forEach((row: any) => {
        if (row?.id) projectIdSet.add(String(row.id));
      });

      if (projectIdSet.size > 0) {
        return Array.from(projectIdSet);
      }

      const encadrantIdCandidates = new Set<string>();
      const { data: encById } = await supabase
        .from('encadrants')
        .select('id')
        .eq('id', authUserId)
        .limit(1);

      (encById || []).forEach((row: any) => {
        if (row?.id) encadrantIdCandidates.add(String(row.id));
      });

      const mappingColumns = ['utilisateur_id', 'user_id', 'auth_user_id'];
      for (const column of mappingColumns) {
        const { data } = await supabase
          .from('encadrants')
          .select('id')
          .eq(column, authUserId)
          .limit(1);

        (data || []).forEach((row: any) => {
          if (row?.id) encadrantIdCandidates.add(String(row.id));
        });
      }

      if (encadrantIdCandidates.size === 0) {
        return [];
      }

      const { data: fallbackRows, error: fallbackError } = await supabase
        .from('projets')
        .select('id')
        .in('encadrant_id', Array.from(encadrantIdCandidates));

      if (fallbackError) throw fallbackError;
      (fallbackRows || []).forEach((row: any) => {
        if (row?.id) projectIdSet.add(String(row.id));
      });

      return Array.from(projectIdSet);
    };

    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setColumns(emptyColumns());
          return;
        }

        const projectIds = await fetchProfessorProjectIds(user.id);
        if (projectIds.length === 0) {
          setColumns(emptyColumns());
          return;
        }

        const { data: projectRows, error: projectError } = await supabase
          .from('projets')
          .select('id, titre')
          .in('id', projectIds);

        if (projectError) throw projectError;

        const projectTitleById: Record<string, string> = {};
        (projectRows || []).forEach((p: any) => {
          projectTitleById[String(p.id)] = p.titre || 'Projet';
        });

        const { data: iterationRows, error: iterationError } = await supabase
          .from('iterations')
          .select('id, projet_id')
          .in('projet_id', projectIds);

        if (iterationError) throw iterationError;

        const iterationIds = (iterationRows || []).map((it: any) => String(it.id));
        const projectIdByIterationId: Record<string, string> = {};
        (iterationRows || []).forEach((it: any) => {
          projectIdByIterationId[String(it.id)] = String(it.projet_id);
        });

        if (iterationIds.length === 0) {
          setColumns(emptyColumns());
          return;
        }

        const { data: taskRows, error: taskError } = await supabase
          .from('taches')
          .select(`
            id,
            titre,
            description,
            priorite,
            etat,
            created_at,
            iteration_id,
            tache_assignations(
              etudiant_id,
              etudiants(
                utilisateurs(nom, prenom)
              )
            ),
            tache_commentaires(id)
          `)
          .in('iteration_id', iterationIds)
          .order('created_at', { ascending: false });

        if (taskError) throw taskError;

        const cols = emptyColumns();

        (taskRows || []).forEach((t: any) => {
          const assignation = t.tache_assignations?.[0] ?? null;
          const assignedUser = assignation?.etudiants?.utilisateurs;
          const assignee = assignedUser
            ? `${assignedUser.prenom || ''} ${assignedUser.nom || ''}`.trim() || 'Non assigne'
            : 'Non assigne';

          const projectId = projectIdByIterationId[String(t.iteration_id)];
          const projectTitle = projectId ? projectTitleById[projectId] || 'Projet' : 'Projet';

          const taskCard: TaskCard = {
            id: String(t.id),
            projectId: projectId || 'no-project',
            title: t.titre || 'Tache sans titre',
            assignee,
            status: toUiStatus(t.etat, t.priorite),
            dateLabel: formatDateLabel(t.created_at),
            comments: Array.isArray(t.tache_commentaires) ? t.tache_commentaires.length : 0,
            description: t.description || 'Aucune description',
            projectTitle,
          };

          let groupColumn = cols.find((c) => c.id === taskCard.projectId);
          if (!groupColumn) {
            groupColumn = {
              id: taskCard.projectId,
              title: taskCard.projectTitle,
              subtitle: 'Taches du groupe',
              tasks: [],
            };
            cols.push(groupColumn);
          }

          groupColumn.tasks.push(taskCard);
        });

        setColumns(cols);
      } catch (err) {
        console.error('Erreur chargement tasks encadrant:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement des taches.');
        setColumns(emptyColumns());
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  const totalTasks = useMemo(
    () => columns.reduce((acc, col) => acc + col.tasks.length, 0),
    [columns]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-[#1a1c1a]">My Task Board #{totalTasks > 0 ? '1' : '0'}</h1>
        </div>
      </header>

      {loading && <p className="mb-6 text-sm text-[#7f7664]">Chargement des taches...</p>}
      {!loading && error && <p className="mb-6 text-sm text-[#ba1a1a]">Erreur: {error}</p>}
      {!loading && !error && totalTasks === 0 && (
        <p className="mb-6 text-sm text-[#7f7664]">Aucune tache trouvee pour les projets assignes a cet encadrant.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {columns.map((column) => (
          <div key={column.id} className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <h3 className="text-lg font-bold text-[#1a1c1a]">{column.title}</h3>
                <p className="text-xs text-[#7f7664]">{column.tasks.length} taches</p>
              </div>
            </div>

            <div className="space-y-4">
              {column.tasks.map((task) => (
                <motion.div
                  key={task.id}
                  whileHover={{ scale: 1.02 }}
                  className="group relative mb-6 cursor-pointer rounded-2xl border border-[#d1c5b0] bg-white p-5 shadow-[0_4px_16px_rgba(118,91,0,0.06)]"
                  onClick={() => handleTaskClick(column)}
                >
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <img src={`https://picsum.photos/seed/task${task.id}/30/30`} alt="Avatar" className="h-8 w-8 rounded-full border border-[#d1c5b0]" />
                      <div className="h-full w-0.5 bg-[#d1c5b0] group-last:hidden"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[#7f7664]">Commits on {task.dateLabel}</span>
                      </div>
                      <h4 className="mb-1 text-sm font-bold leading-tight text-[#1a1c1a]">{task.title}</h4>
                      <p className="mb-1 text-xs text-[#7f7664]">{task.assignee}</p>
                      <p className="mb-4 text-[11px] text-[#7f7664]">{task.projectTitle}</p>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                            task.status === 'DONE'
                              ? 'bg-[#DCFCE7] text-[#166534]'
                              : task.status === 'URGENT'
                              ? 'bg-[#ffdad6] text-[#ba1a1a]'
                              : 'bg-[#ffd464] text-[#594400]'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[3px]">
          <div className="relative w-full min-w-[350px] max-w-lg rounded-2xl border border-[#d1c5b0] bg-white p-8 shadow-2xl">
            <button onClick={closeModal} className="absolute right-6 top-4 text-3xl font-bold text-[#7f7664] hover:text-[#ba1a1a]">&times;</button>
            <h2 className="mb-7 text-2xl font-extrabold tracking-tight text-[#1a1c1a]">
              Taches du groupe : <span className="text-[#765b00]">{modalTitle}</span>
            </h2>
            <ul className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {modalTasks.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 border-b border-[#d1c5b0] pb-4 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-lg font-bold text-[#1a1c1a]">{t.title}</div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm select-none tracking-wide ${
                        t.status === 'DONE'
                          ? 'border border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]'
                          : t.status === 'URGENT'
                          ? 'border border-[#fecaca] bg-[#ffdad6] text-[#ba1a1a]'
                          : 'border border-[#ebc254] bg-[#ffd464] text-[#594400]'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="mb-1 text-[13px] font-medium text-[#7f7664]">
                    Assigne a : <span className="font-semibold text-[#4d4636]">{t.assignee}</span>
                  </div>
                  <div className="mb-1 text-[13px] font-medium text-[#7f7664]">
                    Projet : <span className="font-semibold text-[#4d4636]">{t.projectTitle}</span>
                  </div>
                  <div className="text-[13px] text-[#4d4636]">{t.description}</div>
                  <div className="relative flex items-center mt-1">
                    <input
                      type="text"
                      placeholder="Ajouter un commentaire..."
                      className="w-full rounded-lg border border-[#d1c5b0] bg-[#faf9f6] px-3 py-2 pr-12 text-[15px] placeholder:text-[#7f7664] shadow-sm transition-all focus:outline-none focus:border-[#765b00]"
                      value={comments[t.id] || ''}
                      onChange={(e) => handleCommentChange(t.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendComment(t.id);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendComment(t.id)}
                      disabled={sendingTaskId === t.id || !(comments[t.id] || '').trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-transparent p-2 text-[#765b00] shadow-none transition-all hover:text-[#594400] focus:outline-none"
                      title="Envoyer le commentaire"
                    >
                      <Send size={22} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-[#7f7664]">
                    <MessageSquare size={14} />
                    {t.comments} commentaires
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
