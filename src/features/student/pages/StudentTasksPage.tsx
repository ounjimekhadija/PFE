import React, { useState } from 'react';
import { Plus, MoreHorizontal, User, MessageSquare, Paperclip, CheckSquare, Clock } from 'lucide-react';
import CommentModal from '../../../shared/components/CommentModal';
import { motion } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface TaskS {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  assignee: string;
  comments: number;
  attachments: number;
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
  const [selectedComment, setSelectedComment] = useState<string>('');

  // Modal création de tâche (hooks et handler AVANT le useState des colonnes)
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assignee: '', description: '' });
  const assigneeOptions = ['Hira R', 'Anas M', 'Sara K'];

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assignee) return;
    setColumns(cols => cols.map(col =>
      col.id === 'todo'
        ? { ...col, tasks: [
            ...col.tasks,
            {
              id: Date.now().toString(),
              title: newTask.title,
              description: newTask.description,
              priority: 'Low',
              assignee: newTask.assignee,
              comments: 0,
              attachments: 0,
            },
          ] }
        : col
    ));
    setShowCreateTask(false);
    setNewTask({ title: '', assignee: '', description: '' });
  };

  const [columns, setColumns] = useState<Column[]>([
    {
      id: 'todo',
      title: 'À faire',
      tasks: [
        {
          id: '1',
          title: 'Design Authentication Flow',
          description: 'Create wireframes and sequence diagrams for the login/signup process.',
          priority: 'High',
          assignee: 'Hira R',
          comments: 3,
          attachments: 2,
        },
      ],
    },
    {
      id: 'inprogress',
      title: 'En cours',
      tasks: [
        {
          id: '2',
          title: 'Setup Firebase Auth',
          description: 'Configure Firebase project and implement Google Sign-in.',
          priority: 'Medium',
          assignee: 'Anas M',
          comments: 5,
          attachments: 1,
        },
      ],
    },
    {
      id: 'done',
      title: 'Terminé',
      tasks: [
        {
          id: '3',
          title: 'Project Initialization',
          description: 'Setup Vite + React + Tailwind CSS boilerplate.',
          priority: 'Low',
          assignee: 'Sara K',
          comments: 2,
          attachments: 0,
        },
      ],
    },
  ]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceColIndex = columns.findIndex(col => col.id === source.droppableId);
    const destColIndex = columns.findIndex(col => col.id === destination.droppableId);

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];

    const sourceTasks = [...sourceCol.tasks];
    const destTasks = source.droppableId === destination.droppableId 
      ? sourceTasks 
      : [...destCol.tasks];

    const [removed] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, removed);

    const newColumns = [...columns];
    newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    newColumns[destColIndex] = { ...destCol, tasks: destTasks };

    setColumns(newColumns);
  };



  return (

    <div className="flex-1 bg-gray-50 p-8 flex flex-col overflow-hidden">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks Board</h1>
          <p className="text-gray-500 mt-1">Manage your team's tasks and sub-tasks.</p>
        </div>
        <button
          className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-black transition-all shadow-md min-w-0"
          onClick={() => setShowCreateTask(true)}
        >
          <Plus size={16} />
          <span>Créer une tâche</span>
        </button>
      </header>

      {/* Modal création de tâche */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              onClick={() => setShowCreateTask(false)}
              aria-label="Fermer"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-6 text-gray-900">Créer une tâche</h2>
            <form onSubmit={handleCreateTask} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1">Titre de la tâche</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400 resize-none min-h-[60px]"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Assigner à</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                  value={newTask.assignee}
                  onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                  required
                >
                  <option value="" disabled>Choisir un membre</option>
                  {assigneeOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
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
                  <h3 className="font-bold text-gray-700">{column.title}</h3>
                  <span className="bg-gray-200 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                    {column.tasks.length}
                  </span>
                </div>
              </div>

              <DroppableComponent droppableId={column.id}>
                {(provided: any, snapshot: any) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar transition-colors rounded-2xl ${
                      snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    {column.tasks.map((task, index) => (
                      <DraggableComponent key={task.id} draggableId={task.id} index={index}>
                        {(provided: any, snapshot: any) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-[24px] p-6 border border-gray-100 transition-all ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-indigo-500/20 scale-105 rotate-2 z-50' : 'shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="mb-4"></div>

                            <h4 className="font-bold text-gray-900 mb-2">{task.title}</h4>
                            <p className="text-sm text-gray-500 mb-6 line-clamp-2">{task.description}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                              <div className="flex items-center gap-2">
                                <img
                                  src={`https://picsum.photos/seed/${task.assignee}/100/100`}
                                  alt={task.assignee}
                                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                />
                                <span className="text-xs font-semibold text-gray-700">{task.assignee}</span>
                              </div>

                                <div className="flex items-center gap-4 text-gray-400">
                                  <button
                                    className="flex items-center gap-1 text-xs font-bold focus:outline-none"
                                    onClick={() => {
                                      setSelectedComment('Très bon début, pensez à détailler les cas d\'erreur et à valider le flow avec l\'équipe.');
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
        comment={selectedComment}
      />
    </div>
  );
};

export default StudentTasks;
