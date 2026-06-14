import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronDown, Flag, User, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Task as TaskType, taskSchema } from '../schemas';

interface AssigneeOption {
  id: string;
  name: string;
}

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assigneeOptions: AssigneeOption[];
  currentIterationId: string | null;
  onTaskCreated: (task: any, assigneeId: string | undefined) => void;
}

const priorities = [
  { value: 'Low', label: 'Basse', color: 'text-blue-500', bg: 'bg-blue-50' },
  { value: 'Medium', label: 'Moyenne', color: 'text-amber-500', bg: 'bg-amber-50' },
  { value: 'High', label: 'Haute', color: 'text-rose-500', bg: 'bg-rose-50' },
];

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  assigneeOptions,
  currentIterationId,
  onTaskCreated,
}) => {
  const [newTask, setNewTask] = useState<Partial<TaskType>>({
    title: '',
    description: '',
    priority: 'Medium',
    assignee: '',
  });
  const [errors, setErrors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);
  const assignéeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (assignéeRef.current && !assignéeRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateTask = async () => {
    setLoading(true);
    const validationResult = taskSchema.safeParse({ ...newTask, status: 'To Do' });

    if (!validationResult.success) {
      setErrors(validationResult.error.flatten().fieldErrors);
      setLoading(false);
      return;
    }

    setErrors(null);

    if (!currentIterationId) {
      alert("Impossible de créer la tâche : aucune itération active ou a faire n'est associee a votre projet.");
      setLoading(false);
      return;
    }

    try {
      const dbPriority = {
        Low: 'LOW',
        Medium: 'MEDIUM',
        High: 'HIGH',
      }[newTask.priority || 'Medium'];

      const { data: newDbTask, error } = await supabase
        .from('taches')
        .insert({
          iteration_id: currentIterationId,
          titre: newTask.title,
          description: newTask.description || '',
          priorite: dbPriority,
          etat: 'A_FAIRE',
        })
        .select('*')
        .single();

      if (error) {
        console.error('Creation error', error);
        alert('Erreur lors de la creation de la tâche : ' + error.message);
        setLoading(false);
        return;
      }

      await supabase
        .from('iterations')
        .update({ statut: 'EN_COURS' })
        .eq('id', currentIterationId)
        .eq('statut', 'A_FAIRE');

      if (newTask.assignee) {
        const { error: assignError } = await supabase
          .from('tache_assignations')
          .insert({
            tache_id: newDbTask.id,
            etudiant_id: newTask.assignee,
          });

        if (assignError) {
          console.error('Error assigning task', assignError);
        }
      }

      onTaskCreated(newDbTask, newTask.assignee);
      onClose();
      setNewTask({ title: '', description: '', priority: 'Medium', assignee: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedPriority = priorities.find((priority) => priority.value === newTask.priority) || priorities[1];
  const selectedAssignee = assigneeOptions.find((assignee) => assignee.id === newTask.assignee);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#111827]/50 p-3 backdrop-blur-sm transition-all animate-in fade-in duration-300 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[620px] flex-col overflow-y-auto rounded-2xl border border-[#DCEBFA] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] sm:my-4"
        onClick={(event) => event.stopPropagation()}
        style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[#EEF3F8] bg-white px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">Nouvelle tâche</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1a1c1a]">Créer une tâche</h2>
            <p className="mt-1 text-sm font-medium text-[#64748B]">Ajoutez les détails pour votre équipe.</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#64748B] transition-colors hover:bg-[#DCEBFA] hover:text-[#172D49]"
            type="button"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-7">
          <div className="space-y-2">
            <label className="ml-1 text-sm font-extrabold text-[#334155]">Titre de la tâche</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex : Conception de la base de données"
                className={`h-12 w-full rounded-xl border px-4 text-sm font-semibold ${
                  errors?.title ? 'border-red-500' : 'border-[#C8D6E5]'
                } bg-white text-[#1a1c1a] shadow-sm outline-none transition-all placeholder:text-[#9AA6B8] focus:border-[#1E3A5F] focus:ring-4 focus:ring-[#1E3A5F]/10`}
                value={newTask.title || ''}
                onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
              />
              {errors?.title && (
                <div className="ml-1 mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
                  <AlertCircle size={14} />
                  <span>{errors.title[0]}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-sm font-extrabold text-[#334155]">Description</label>
            <textarea
              placeholder="Décrivez ce qui doit être fait..."
              rows={4}
              className="min-h-[104px] w-full resize-none rounded-xl border border-[#C8D6E5] bg-white px-4 py-3 text-sm font-semibold text-[#1a1c1a] shadow-sm outline-none transition-all placeholder:text-[#9AA6B8] focus:border-[#1E3A5F] focus:ring-4 focus:ring-[#1E3A5F]/10"
              value={newTask.description || ''}
              onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2" ref={priorityRef}>
              <label className="ml-1 text-sm font-extrabold text-[#334155]">Priorité</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#C8D6E5] bg-white px-4 text-[#1a1c1a] shadow-sm outline-none transition-all hover:border-[#1E3A5F]/50 focus:ring-4 focus:ring-[#1E3A5F]/10"
                >
                  <div className="flex items-center gap-3">
                    <Flag size={16} className={selectedPriority.color} />
                    <span className="text-sm font-bold">{selectedPriority.label}</span>
                  </div>
                  <ChevronDown size={16} className={`text-[#64748B] transition-transform duration-300 ${showPriorityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPriorityDropdown && (
                  <div className="mt-2 w-full overflow-hidden rounded-xl border border-[#C8D6E5] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)] animate-in fade-in slide-in-from-top-2">
                    {priorities.map((priority) => (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() => {
                          setNewTask({ ...newTask, priority: priority.value as any });
                          setShowPriorityDropdown(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors hover:bg-[#EEF3F8] ${
                          newTask.priority === priority.value ? `${priority.bg} ${priority.color}` : 'text-[#334155]'
                        }`}
                      >
                        <Flag size={14} className={priority.color} />
                        {priority.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2" ref={assignéeRef}>
              <label className="ml-1 text-sm font-extrabold text-[#334155]">Assigner à</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#C8D6E5] bg-white px-4 text-[#1a1c1a] shadow-sm outline-none transition-all hover:border-[#1E3A5F]/50 focus:ring-4 focus:ring-[#1E3A5F]/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <User size={16} className="shrink-0 text-[#64748B]" />
                    <span className="truncate text-sm font-bold">
                      {selectedAssignee ? selectedAssignee.name : 'Sélectionner un membre'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-[#64748B] transition-transform duration-300 ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAssigneeDropdown && (
                  <div className="mt-2 max-h-44 w-full overflow-y-auto rounded-xl border border-[#C8D6E5] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)] animate-in fade-in slide-in-from-top-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTask({ ...newTask, assignee: '' });
                        setShowAssigneeDropdown(false);
                      }}
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#64748B] transition-colors hover:bg-[#EEF3F8]"
                    >
                      Non assignée
                    </button>
                    {assigneeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setNewTask({ ...newTask, assignee: option.id });
                          setShowAssigneeDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#334155] transition-colors hover:bg-[#EEF3F8]"
                      >
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(option.name)}&background=random`}
                          className="h-7 w-7 rounded-lg object-cover"
                          alt=""
                        />
                        <span className="truncate">{option.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[#EEF3F8] bg-white px-5 py-4 sm:px-7">
          <button
            onClick={onClose}
            type="button"
            className="h-11 rounded-xl bg-[#EEF3F8] px-5 text-sm font-extrabold text-[#334155] transition-all hover:bg-[#E5EDF5]"
          >
            Annuler
          </button>
          <button
            onClick={handleCreateTask}
            disabled={loading}
            type="button"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#1a1c1a] px-5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(26,28,26,0.16)] transition-all hover:bg-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            <span>Créer la tâche</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TaskCreateModal;






