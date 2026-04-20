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
    <div className="flex-1 bg-white p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">My Task Board #{totalTasks > 0 ? '1' : '0'}</h1>
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500 mb-6">Chargement des taches...</p>}
      {!loading && error && <p className="text-sm text-red-500 mb-6">Erreur: {error}</p>}
      {!loading && !error && totalTasks === 0 && (
        <p className="text-sm text-gray-500 mb-6">Aucune tache trouvee pour les projets assignes a cet encadrant.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {columns.map((column) => (
          <div key={column.id} className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{column.title}</h3>
                <p className="text-xs text-gray-400">{column.tasks.length} taches</p>
              </div>
            </div>

            <div className="space-y-4">
              {column.tasks.map((task) => (
                <motion.div
                  key={task.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative group cursor-pointer"
                  onClick={() => handleTaskClick(column)}
                >
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <img src={`https://picsum.photos/seed/task${task.id}/30/30`} alt="Avatar" className="w-8 h-8 rounded-full" />
                      <div className="w-0.5 h-full bg-gray-100 group-last:hidden"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Commits on {task.dateLabel}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 mb-1 leading-tight">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-1">{task.assignee}</p>
                      <p className="text-[11px] text-gray-400 mb-4">{task.projectTitle}</p>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                            task.status === 'DONE'
                              ? 'bg-green-100 text-green-600'
                              : task.status === 'URGENT'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-600'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[3px]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 min-w-[350px] max-w-lg w-full relative border border-gray-100">
            <button onClick={closeModal} className="absolute top-4 right-6 text-gray-400 hover:text-red-500 text-3xl font-bold">&times;</button>
            <h2 className="text-2xl font-extrabold mb-7 text-gray-900 tracking-tight">
              Taches du groupe : <span className="text-indigo-600">{modalTitle}</span>
            </h2>
            <ul className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {modalTasks.map((t) => (
                <li key={t.id} className="pb-4 border-b last:border-b-0 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-800 text-lg flex-1">{t.title}</div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm select-none tracking-wide ${
                        t.status === 'DONE'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : t.status === 'URGENT'
                          ? 'bg-red-100 text-red-600 border border-red-200'
                          : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-1 font-medium">
                    Assigne a : <span className="text-gray-700 font-semibold">{t.assignee}</span>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-1 font-medium">
                    Projet : <span className="text-gray-700 font-semibold">{t.projectTitle}</span>
                  </div>
                  <div className="text-[13px] text-gray-600">{t.description}</div>
                  <div className="relative flex items-center mt-1">
                    <input
                      type="text"
                      placeholder="Ajouter un commentaire..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] bg-gray-50 focus:outline-none transition-all shadow-sm placeholder:text-gray-400 pr-12"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800 p-2 rounded-lg transition-all focus:outline-none bg-transparent shadow-none"
                      title="Envoyer le commentaire"
                    >
                      <Send size={22} />
                    </button>
                  </div>
                  <div className="text-[12px] text-gray-400 flex items-center gap-1">
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
