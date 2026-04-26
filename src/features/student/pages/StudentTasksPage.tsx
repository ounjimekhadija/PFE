import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import CommentModal from '../../../shared/components/CommentModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../../../lib/supabase';

interface TaskS {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  assignee: string;
  assigneeStudentId?: string;
  comments: number;
  attachments: number;
  db_id?: string;
}

interface Column {
  id: string;
  title: string;
  tasks: TaskS[];
}

const DraggableComponent = Draggable as any;
const DroppableComponent = Droppable as any;

const StudentTasks: React.FC = () => {
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assignee: '', description: '' });
  const [assigneeOptions, setAssigneeOptions] = useState<{id: string, name: string}[]>([]);
  const [currentIterationId, setCurrentIterationId] = useState<string | null>(null);

  const [columns, setColumns] = useState<Column[]>([
    { id: 'todo', title: 'À faire', tasks: [] },
    { id: 'inprogress', title: 'En cours', tasks: [] },
    { id: 'done', title: 'Terminé', tasks: [] },
  ]);

  useEffect(() => {
    const fetchTasksAndStudents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: studentData, error: studentError } = await supabase
          .from('etudiants')
          .select('projet_id')
          .eq('id', user.id)
          .single();

        if (studentError || !studentData?.projet_id) return;
        const projectId = studentData.projet_id;

        const { data: projectMembers, error: membersError } = await supabase
          .from('etudiants')
          .select('id, utilisateurs!inner(nom, prenom)')
          .eq('projet_id', projectId);

        if (membersError) {
          console.error("Erreur récupération membres:", membersError);
        }

        if (projectMembers) {
          const formattedMembers = projectMembers.map((m: any) => {
            const userObj = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
            const isMe = m.id === user.id;
            return {
              id: m.id,
              name: userObj
                ? `${userObj.prenom} ${userObj.nom} ${isMe ? '(Moi)' : ''}`
                : (isMe ? 'Moi' : 'Membre Inconnu')
            };
          });
          setAssigneeOptions(formattedMembers);
        }

        const { data: iteration } = await supabase
          .from('iterations')
          .select('id')
          .eq('projet_id', projectId)
          .eq('statut', 'EN_COURS')
          .single();

        if (!iteration) return;
        setCurrentIterationId(iteration.id);

        const { data: tasksData, error: tasksError } = await supabase
          .from('taches')
          .select(`
            *,
            tache_assignations (
              etudiant_id,
              etudiants (
                utilisateurs(nom, prenom)
              )
            ),
            tache_commentaires ( id )
          `)
          .eq('iteration_id', iteration.id);

        if (tasksError) {
          console.error("Error fetching tasks:", tasksError);
        }

        const taskRows = tasksData || [];
        const todo: TaskS[] = [];
        const inprogress: TaskS[] = [];
        const done: TaskS[] = [];

        taskRows.forEach((t: any) => {
          const firstAssignation = t.tache_assignations?.[0] ?? null;
          const assignedStudentId = firstAssignation?.etudiant_id ?? undefined;
          const assignedUser = firstAssignation?.etudiants?.utilisateurs;
          const dbPriority = (t.priorite || 'MEDIUM') as string;

          let uiPriority: TaskS['priority'] = 'Medium';
          if (dbPriority === 'HIGH') uiPriority = 'High';
          if (dbPriority === 'LOW') uiPriority = 'Low';

          const taskObj: TaskS = {
            id: t.id.toString(),
            db_id: t.id,
            title: t.titre,
            description: t.description || 'Aucune description',
            priority: uiPriority,
            assigneeStudentId: assignedStudentId,
            assignee: assignedUser ? `${assignedUser.prenom} ${assignedUser.nom}` : 'Non assigné',
            comments: t.tache_commentaires ? t.tache_commentaires.length : 0,
            attachments: 0,
          };

          if (t.etat === 'A_FAIRE') todo.push(taskObj);
          else if (t.etat === 'EN_COURS') inprogress.push(taskObj);
          else if (t.etat === 'TERMINE') done.push(taskObj);
          else todo.push(taskObj);
        });

        setColumns([
          { id: 'todo', title: 'À faire', tasks: todo },
          { id: 'inprogress', title: 'En cours', tasks: inprogress },
          { id: 'done', title: 'Terminé', tasks: done },
        ]);
      } catch (err) {
        console.error('Failed to load tasks', err);
      }
    };
    fetchTasksAndStudents();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    if (!currentIterationId) {
      alert("Impossible de créer la tâche : Il n'y a pas d'itération (Sprint) active 'EN_COURS' pour votre projet.");
      return;
    }

    try {
      const { data: newDbTask, error } = await supabase
        .from('taches')
        .insert({
          iteration_id: currentIterationId,
          titre: newTask.title,
          description: newTask.description,
          priorite: 'MEDIUM',
          etat: 'A_FAIRE'
        })
        .select('*')
        .single();

      if (error) {
        console.error("Erreur lors de la création", error);
        alert("Erreur de création de tâche.");
        return;
      }

      if (newTask.assignee) {
        const { error: assignError } = await supabase
          .from('tache_assignations')
          .insert({ tache_id: newDbTask.id, etudiant_id: newTask.assignee });

        if (assignError) {
          console.error("Erreur lors de l'assignation", assignError);
        }
      }

      const selectedAssignee = assigneeOptions.find((opt) => opt.id === newTask.assignee);
      const assigneeName = selectedAssignee?.name || 'Non assigné';

      const taskObj: TaskS = {
        id: newDbTask.id.toString(),
        db_id: newDbTask.id,
        title: newDbTask.titre,
        description: newDbTask.description || 'Aucune description',
        assigneeStudentId: newTask.assignee || undefined,
        priority: 'Medium',
        assignee: assigneeName,
        comments: 0,
        attachments: 0,
      };

      setColumns(cols => cols.map(col =>
        col.id === 'todo' ? { ...col, tasks: [...col.tasks, taskObj] } : col
      ));

      setShowCreateTask(false);
      setNewTask({ title: '', assignee: '', description: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColIndex = columns.findIndex(col => col.id === source.droppableId);
    const destColIndex = columns.findIndex(col => col.id === destination.droppableId);

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];

    const sourceTasks = [...sourceCol.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destCol.tasks];

    const [removed] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, removed);

    const newColumns = [...columns];
    newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    newColumns[destColIndex] = { ...destCol, tasks: destTasks };

    const previousColumns = [...columns];
    setColumns(newColumns);

    if (source.droppableId !== destination.droppableId && removed.db_id) {
      let newState = 'A_FAIRE';
      if (destination.droppableId === 'inprogress') newState = 'EN_COURS';
      if (destination.droppableId === 'done') newState = 'TERMINE';

      try {
        const { error } = await supabase
          .from('taches')
          .update({ etat: newState })
          .eq('id', removed.db_id);

        if (error) throw error;
      } catch (error: any) {
        console.error("Update task status failed", error);
        alert("Erreur de sauvegarde: impossible de déplacer la tâche (Avez-vous configuré les Policies Supabase ?)");
        setColumns(previousColumns);
      }
    }
  };

  return (
    <div className="flex-1 bg-[#faf9f6] p-8 flex flex-col overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1c1a]">Tasks Board</h1>
          <p className="text-[#7f7664] mt-1">Manage your team's tasks and sub-tasks.</p>
        </div>
        <button
          className="bg-[#1a1c1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-[#4d4636] transition-all shadow-md min-w-0"
          onClick={() => setShowCreateTask(true)}
        >
          <Plus size={16} />
          <span>Créer une tâche</span>
        </button>
      </header>

      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative border border-[#d1c5b0]">
            <button
              className="absolute top-4 right-4 text-[#7f7664] hover:text-[#4d4636] text-2xl font-bold"
              onClick={() => setShowCreateTask(false)}
              aria-label="Fermer"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-6 text-[#1a1c1a]">Créer une tâche</h2>
            <form onSubmit={handleCreateTask} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#4d4636]">Titre de la tâche</label>
                <input
                  type="text"
                  className="w-full border border-[#d1c5b0] rounded-xl px-4 py-2 focus:outline-none focus:border-[#765b00]"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#4d4636]">Description</label>
                <textarea
                  className="w-full border border-[#d1c5b0] rounded-xl px-4 py-2 focus:outline-none focus:border-[#765b00] resize-none min-h-[60px]"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#4d4636]">Assigner à</label>
                <select
                  className="w-full border border-[#d1c5b0] rounded-xl px-4 py-2 focus:outline-none focus:border-[#765b00]"
                  value={newTask.assignee}
                  onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                >
                  <option value="">Non assigné</option>
                  {assigneeOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-[#765b00] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#594400] transition-all"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 justify-center">
          {columns.map((column) => (
            <div key={column.id} className="w-[370px] flex flex-col flex-1 max-w-[370px] min-h-[420px]">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-[#4d4636]">{column.title}</h3>
                  <span className="bg-[#d1c5b0] text-[#7f7664] text-xs font-bold px-2 py-0.5 rounded-full">
                    {column.tasks.length}
                  </span>
                </div>
              </div>

              <DroppableComponent droppableId={column.id}>
                {(provided: any, snapshot: any) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 space-y-4 overflow-y-auto pr-2 transition-colors rounded-2xl ${
                      snapshot.isDraggingOver ? 'bg-[#ffd464]/10' : ''
                    }`}
                  >
                    {column.tasks.map((task, index) => (
                      <DraggableComponent key={task.id} draggableId={task.id} index={index}>
                        {(provided: any, snapshot: any) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-[24px] p-6 border border-[#d1c5b0] transition-all ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-[#765b00]/20 scale-105 rotate-2 z-50' : 'shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="mb-4"></div>

                            <h4 className="font-bold text-[#1a1c1a] mb-2">{task.title}</h4>
                            <p className="text-sm text-[#7f7664] mb-6 line-clamp-2">{task.description}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-[#d1c5b0]">
                              <div className="flex items-center gap-2">
                                <img
                                  src={`https://picsum.photos/seed/${task.assignee}/100/100`}
                                  alt={task.assignee}
                                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                />
                                <span className="text-xs font-semibold text-[#4d4636]">{task.assignee}</span>
                              </div>

                              <div className="flex items-center gap-4 text-[#7f7664]">
                                <button
                                  className="flex items-center gap-1 text-xs font-bold focus:outline-none"
                                  onClick={() => {
                                    setSelectedTaskId(task.db_id || null);
                                    setIsCommentOpen(true);
                                  }}
                                  type="button"
                                >
                                  <MessageSquare size={14} />
                                  {task.comments}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </DraggableComponent>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </DroppableComponent>
            </div>
          ))}
        </div>
      </DragDropContext>
      <CommentModal
        isOpen={isCommentOpen}
        onClose={() => setIsCommentOpen(false)}
        taskId={selectedTaskId}
        readOnly={true}
      />
    </div>
  );
};

export default StudentTasks;
