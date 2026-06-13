import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Flag, ListTodo, MessageSquare, Plus, Users } from 'lucide-react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import CommentModal from '../../../shared/components/CommentModal';
import TaskCreateModal from '../../../shared/components/TaskCreateModal';
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

interface AssigneeOption {
  id: string;
  name: string;
}

interface SprintInfo {
  dateDebut: string | null;
  dateFin: string | null;
}

const DraggableComponent = Draggable as any;
const DroppableComponent = Droppable as any;

const StudentTasks: React.FC = () => {
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [currentIterationId, setCurrentIterationId] = useState<string | null>(null);
  const [sprintInfo, setSprintInfo] = useState<SprintInfo>({ dateDebut: null, dateFin: null });
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

        if (membersError) console.error('Error fetching members:', membersError);

        if (projectMembers) {
          setAssigneeOptions(projectMembers.map((member: any) => {
            const userObj = Array.isArray(member.utilisateurs) ? member.utilisateurs[0] : member.utilisateurs;
            const isMe = member.id === user.id;
            return {
              id: member.id,
              name: userObj ? `${userObj.prenom} ${userObj.nom} ${isMe ? '(Moi)' : ''}` : (isMe ? 'Moi' : 'Membre'),
            };
          }));
        }

        const { data: iterations } = await supabase
          .from('iterations')
          .select('id, statut, date_debut, date_fin')
          .eq('projet_id', projectId)
          .in('statut', ['EN_COURS', 'A_FAIRE'])
          .order('numero', { ascending: true });

        if (!iterations || iterations.length === 0) return;

        const activeIteration = iterations.find((it: any) => it.statut === 'EN_COURS') || iterations.find((it: any) => it.statut === 'A_FAIRE');
        if (!activeIteration) return;
        setCurrentIterationId(activeIteration.id);
        setSprintInfo({
          dateDebut: activeIteration.date_debut || null,
          dateFin: activeIteration.date_fin || null,
        });

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

        if (tasksError) console.error('Error fetching tasks:', tasksError);

        const todo: TaskS[] = [];
        const inprogress: TaskS[] = [];
        const done: TaskS[] = [];

        (tasksData || []).forEach((task: any) => {
          const firstAssignation = task.tache_assignations?.[0] ?? null;
          const assignedUser = firstAssignation?.etudiants?.utilisateurs;
          const dbPriority = (task.priorite || 'MEDIUM') as string;
          const uiPriority: TaskS['priority'] = dbPriority === 'HIGH' ? 'High' : dbPriority === 'LOW' ? 'Low' : 'Medium';

          const taskObj: TaskS = {
            id: task.id.toString(),
            db_id: task.id,
            title: task.titre,
            description: task.description || 'Aucune description',
            priority: uiPriority,
            assigneeStudentId: firstAssignation?.etudiant_id ?? undefined,
            assignee: assignedUser ? `${assignedUser.prenom} ${assignedUser.nom}` : 'Non assigne',
            comments: task.tache_commentaires ? task.tache_commentaires.length : 0,
            attachments: 0,
          };

          if (task.etat === 'EN_COURS') inprogress.push(taskObj);
          else if (task.etat === 'TERMINE') done.push(taskObj);
          else todo.push(taskObj);
        });

        setColumns([
          { id: 'todo', title: 'A faire', tasks: todo },
          { id: 'inprogress', title: 'En cours', tasks: inprogress },
          { id: 'done', title: 'Terminees', tasks: done },
        ]);
      } catch (err) {
        console.error('Failed to load tasks', err);
      }
    };

    fetchTasksAndStudents();
  }, []);

  const handleTaskCreated = (newDbTask: any, assignedStudentId: string | undefined) => {
    const selectedAssignee = assigneeOptions.find((option) => option.id === assignedStudentId);
    const dbPriority = (newDbTask.priorite || 'MEDIUM') as string;
    const uiPriority: TaskS['priority'] = dbPriority === 'HIGH' ? 'High' : dbPriority === 'LOW' ? 'Low' : 'Medium';

    const taskObj: TaskS = {
      id: newDbTask.id.toString(),
      db_id: newDbTask.id,
      title: newDbTask.titre,
      description: newDbTask.description || 'Aucune description',
      assigneeStudentId: assignedStudentId,
      priority: uiPriority,
      assignee: selectedAssignee?.name || 'Non assigne',
      comments: 0,
      attachments: 0,
    };

    setColumns((cols) => cols.map((column) => (
      column.id === 'todo' ? { ...column, tasks: [...column.tasks, taskObj] } : column
    )));
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColIndex = columns.findIndex((column) => column.id === source.droppableId);
    const destColIndex = columns.findIndex((column) => column.id === destination.droppableId);
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
      const newState = destination.droppableId === 'inprogress'
        ? 'EN_COURS'
        : destination.droppableId === 'done'
          ? 'TERMINE'
          : 'A_FAIRE';

      try {
        const { error } = await supabase
          .from('taches')
          .update({ etat: newState })
          .eq('id', removed.db_id);

        if (error) throw error;
      } catch (error: any) {
        console.error('Update task status failed', error);
        alert('Impossible de deplacer la tache.');
        setColumns(previousColumns);
      }
    }
  };

  const todoCount = columns.find((column) => column.id === 'todo')?.tasks.length || 0;
  const inProgressCount = columns.find((column) => column.id === 'inprogress')?.tasks.length || 0;
  const doneCount = columns.find((column) => column.id === 'done')?.tasks.length || 0;
  const totalCount = todoCount + inProgressCount + doneCount;
  const completionRate = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const formatSprintDate = (value: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    const formatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      <header className="mb-4 flex flex-shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Tableau des taches</h1>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">Organisez le travail de l'iteration et suivez l'avancement de l'equipe.</p>
        </div>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(30,58,95,0.18)] transition-all hover:bg-[#172D49]"
          onClick={() => setIsCreateModalOpen(true)}
          type="button"
        >
          <Plus size={16} />
          Nouvelle tache
        </button>
      </header>

      <div className="mb-4 grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-4">
        <TaskStat title="Total" value={totalCount} icon={<ListTodo size={21} />} tone="blue" />
        <TaskStat title="A faire" value={todoCount} icon={<Clock3 size={21} />} tone="slate" />
        <TaskStat title="En cours" value={inProgressCount} icon={<Users size={21} />} tone="amber" />
        <TaskStat title="Terminees" value={doneCount} icon={<CheckCircle2 size={21} />} tone="green" />
      </div>

      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        assigneeOptions={assigneeOptions}
        currentIterationId={currentIterationId}
        onTaskCreated={handleTaskCreated}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#C8D6E5]/60 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#1a1c1a]">Taches recentes</h2>
              <p className="mt-1 text-xs text-[#64748B]">Glissez les cartes pour changer leur etat.</p>
            </div>
            <div className="hidden w-72 sm:block">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#DCEBFA]">
                <div className="h-full rounded-full bg-[#1D71F2] transition-all" style={{ width: `${completionRate}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
                <span>{formatSprintDate(sprintInfo.dateDebut)}</span>
                <span className="text-[#1E3A5F]">{completionRate}%</span>
                <span>{formatSprintDate(sprintInfo.dateFin)}</span>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100%-3.75rem)] min-h-0 justify-center overflow-x-auto pb-2">
            <div className="flex min-h-0 w-max gap-4 sm:gap-5">
            {columns.map((column) => (
              <TaskColumn
                key={column.id}
                column={column}
                setSelectedTaskId={setSelectedTaskId}
                setIsCommentOpen={setIsCommentOpen}
              />
            ))}
            </div>
          </div>
        </section>
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

interface TaskStatProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: 'blue' | 'slate' | 'amber' | 'green';
}

const TaskStat: React.FC<TaskStatProps> = ({ title, value, icon, tone }) => {
  const toneClass = {
    blue: 'bg-[#DCEBFA] text-[#1E3A5F]',
    slate: 'bg-[#EEF3F8] text-[#64748B]',
    amber: 'bg-[#FFF4CC] text-[#B45309]',
    green: 'bg-[#DCFCE7] text-[#16A34A]',
  }[tone];

  return (
    <div className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[#64748B]">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#1a1c1a]">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

interface TaskColumnProps {
  column: Column;
  setSelectedTaskId: (id: string | null) => void;
  setIsCommentOpen: (open: boolean) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ column, setSelectedTaskId, setIsCommentOpen }) => {
  const columnStyle = column.id === 'todo'
    ? 'bg-[#F8FAFC]'
    : column.id === 'inprogress'
      ? 'bg-[#F3F8FF]'
      : 'bg-[#F1FBF5]';
  const titleStyle = column.id === 'todo'
    ? 'text-[#334155]'
    : column.id === 'inprogress'
      ? 'text-[#1D4ED8]'
      : 'text-[#15803D]';

  return (
    <div className={`flex min-h-0 shrink-0 flex-col rounded-2xl p-3 ${columnStyle}`} style={{ width: 'min(360px, 82vw)' }}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 px-1">
        <h3 className={`text-sm font-bold ${titleStyle}`}>{column.title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#64748B] shadow-sm">
          {column.tasks.length}
        </span>
      </div>

      <DroppableComponent droppableId={column.id}>
        {(provided: any, snapshot: any) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl pr-1 transition-colors ${snapshot.isDraggingOver ? 'bg-white/50' : ''}`}
          >
            {column.tasks.map((task, index) => (
              <DraggableComponent key={task.id} draggableId={task.id} index={index}>
                {(dragProvided: any, dragSnapshot: any) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={`rounded-xl border bg-white p-4 transition-all ${
                      dragSnapshot.isDragging
                        ? 'z-50 scale-[1.02] shadow-2xl ring-2 ring-[#1E3A5F]/20'
                        : 'border-[#E5EDF5] shadow-sm hover:border-[#BFD7EF] hover:shadow-md'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        task.priority === 'High'
                          ? 'bg-rose-50 text-rose-600'
                          : task.priority === 'Medium'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-blue-50 text-blue-600'
                      }`}>
                        <Flag size={10} strokeWidth={3} />
                        {task.priority === 'High' ? 'Haute' : task.priority === 'Medium' ? 'Moyenne' : 'Basse'}
                      </div>
                    </div>

                    <h4 className="mb-2 line-clamp-2 text-sm font-bold text-[#1a1c1a]">{task.title}</h4>
                    <p className="mb-5 line-clamp-2 text-xs leading-relaxed text-[#64748B]">{task.description}</p>

                    <div className="flex items-center justify-between border-t border-[#EEF3F8] pt-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`}
                          alt={task.assignee}
                          className="h-8 w-8 rounded-xl border-2 border-white object-cover"
                        />
                        <span className="truncate text-xs font-semibold text-[#334155]">{task.assignee}</span>
                      </div>

                      <button
                        className="flex items-center gap-1 text-xs font-bold text-[#64748B] transition hover:text-[#1E3A5F]"
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
  );
};

export default StudentTasks;
