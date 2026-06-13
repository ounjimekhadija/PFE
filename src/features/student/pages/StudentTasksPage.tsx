import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Flag } from 'lucide-react';
import CommentModal from '../../../shared/components/CommentModal';
import TaskCreateModal from '../../../shared/components/TaskCreateModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../../../lib/supabase';
import { taskSchema, Task as TaskType } from '../../../shared/schemas';
import { z } from 'zod';

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

interface AssigneeOption {
  id: string;
  name: string;
}

const DraggableComponent = Draggable as any;
const DroppableComponent = Droppable as any;

const StudentTasks: React.FC = () => {
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [currentIterationId, setCurrentIterationId] = useState<string | null>(null);

  const [columns, setColumns] = useState<Column[]>([
    { id: 'todo', title: 'To Do', tasks: [] },
    { id: 'inprogress', title: 'In Progress', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] },
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
          console.error("Error fetching members:", membersError);
        }

        if (projectMembers) {
          const formattedMembers = projectMembers.map((m: any) => {
            const userObj = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
            const isMe = m.id === user.id;
            return {
              id: m.id,
              name: userObj
                ? `${userObj.prenom} ${userObj.nom} ${isMe ? '(Me)' : ''}`
                : (isMe ? 'Me' : 'Unknown Member')
            };
          });
          setAssigneeOptions(formattedMembers);
        }

        const { data: iterations } = await supabase
          .from('iterations')
          .select('id, statut')
          .eq('projet_id', projectId)
          .in('statut', ['EN_COURS', 'A_FAIRE'])
          .order('numero', { ascending: true });

        if (!iterations || iterations.length === 0) return;
        
        let activeIteration = iterations.find((it: any) => it.statut === 'EN_COURS');
        if (!activeIteration) {
          activeIteration = iterations.find((it: any) => it.statut === 'A_FAIRE');
        }

        if (!activeIteration) return;
        setCurrentIterationId(activeIteration.id);

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
          .eq('iteration_id', activeIteration.id);

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
            description: t.description || 'No description',
            priority: uiPriority,
            assigneeStudentId: assignedStudentId,
            assignee: assignedUser ? `${assignedUser.prenom} ${assignedUser.nom}` : 'Unassigned',
            comments: t.tache_commentaires ? t.tache_commentaires.length : 0,
            attachments: 0,
          };

          if (t.etat === 'A_FAIRE') todo.push(taskObj);
          else if (t.etat === 'EN_COURS') inprogress.push(taskObj);
          else if (t.etat === 'TERMINE') done.push(taskObj);
          else todo.push(taskObj);
        });

        setColumns([
          { id: 'todo', title: 'To Do', tasks: todo },
          { id: 'inprogress', title: 'In Progress', tasks: inprogress },
          { id: 'done', title: 'Done', tasks: done },
        ]);
      } catch (err) {
        console.error('Failed to load tasks', err);
      }
    };
    fetchTasksAndStudents();
  }, []);

  const handleTaskCreated = (newDbTask: any, assignedStudentId: string | undefined) => {
    const selectedAssignee = assigneeOptions.find((opt) => opt.id === assignedStudentId);
    const assigneeName = selectedAssignee?.name || 'Unassigned';

    const dbPriority = (newDbTask.priorite || 'MEDIUM') as string;
    let uiPriority: TaskS['priority'] = 'Medium';
    if (dbPriority === 'HIGH') uiPriority = 'High';
    if (dbPriority === 'LOW') uiPriority = 'Low';

    const taskObj: TaskS = {
      id: newDbTask.id.toString(),
      db_id: newDbTask.id,
      title: newDbTask.titre,
      description: newDbTask.description || 'No description',
      assigneeStudentId: assignedStudentId,
      priority: uiPriority,
      assignee: assigneeName,
      comments: 0,
      attachments: 0,
    };

    setColumns(cols => cols.map(col =>
      col.id === 'todo' ? { ...col, tasks: [...col.tasks, taskObj] } : col
    ));
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
        alert("Save error: unable to move task");
        setColumns(previousColumns);
      }
    }
  };

  return (
    // h-screen + flex-col : le board occupe exactement la hauteur du viewport
    <div
      className="bg-[#F8FAFC] p-8 flex flex-col"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', height: '100vh' }}
    >
      {/* Header — hauteur fixe, ne rétrécit jamais */}
      <header className="mb-8 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1c1a]">Tasks Board</h1>
          <p className="text-[#64748B] mt-1">Manage your team's tasks and sub-tasks.</p>
        </div>
        <button
          className="bg-[#1a1c1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-[#334155] transition-all shadow-md"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus size={16} />
          <span>Create a task</span>
        </button>
      </header>

      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        assigneeOptions={assigneeOptions}
        currentIterationId={currentIterationId}
        onTaskCreated={handleTaskCreated}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        {/*
          flex-1 + min-h-0 : prend tout l'espace restant SANS dépasser le viewport.
          min-h-0 est indispensable — sans lui, flex-1 ignore la contrainte de hauteur
          et le conteneur grossit au-delà de l'écran, rendant le scroll impossible.
        */}
        <div className="flex gap-6 justify-center overflow-x-auto pb-4 flex-1 min-h-0">
          {columns.map((column) => (
            /*
              Chaque colonne : flex-col + min-h-0.
              flex-shrink-0 pour ne pas écraser les colonnes lors du scroll horizontal.
            */
            <div
              key={column.id}
              className="flex flex-col flex-shrink-0 min-h-0"
              style={{ width: 370 }}
            >
              {/* En-tête colonne — hauteur fixe */}
              <div className="flex items-center gap-3 mb-4 px-2 flex-shrink-0">
                <h3 className="font-bold text-[#334155]">{column.title}</h3>
                <span className="bg-[#C8D6E5] text-[#64748B] text-xs font-bold px-2 py-0.5 rounded-full">
                  {column.tasks.length}
                </span>
              </div>

              <DroppableComponent droppableId={column.id}>
                {(provided: any, snapshot: any) => (
                  /*
                    flex-1 + min-h-0 + overflow-y-auto :
                    la liste occupe tout l'espace colonne disponible et scroll
                    indépendamment des autres colonnes.
                  */
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 rounded-2xl transition-colors ${
                      snapshot.isDraggingOver ? 'bg-[#DCEBFA]/10' : ''
                    }`}
                  >
                    {column.tasks.map((task, index) => (
                      <DraggableComponent key={task.id} draggableId={task.id} index={index}>
                        {(provided: any, snapshot: any) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-[24px] p-6 border border-transparent transition-all ${
                              snapshot.isDragging
                                ? 'shadow-2xl ring-2 ring-[#1E3A5F]/20 scale-105 rotate-2 z-50'
                                : 'shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                task.priority === 'High'   ? 'text-rose-600 bg-rose-50' :
                                task.priority === 'Medium' ? 'text-amber-600 bg-amber-50' :
                                                             'text-blue-600 bg-blue-50'
                              }`}>
                                <Flag size={10} strokeWidth={3} />
                                {task.priority === 'High' ? 'High' : task.priority === 'Medium' ? 'Medium' : 'Low'}
                              </div>
                            </div>

                            <h4 className="font-bold text-[#1a1c1a] mb-2">{task.title}</h4>
                            <p className="text-sm text-[#64748B] mb-6 line-clamp-2">{task.description}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-transparent">
                              <div className="flex items-center gap-2">
                                <img
                                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`}
                                  alt={task.assignee}
                                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                />
                                <span className="text-xs font-semibold text-[#334155]">{task.assignee}</span>
                              </div>

                              <button
                                className="flex items-center gap-1 text-xs font-bold text-[#64748B] focus:outline-none"
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