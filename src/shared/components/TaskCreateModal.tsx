import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { taskSchema, Task as TaskType } from '../schemas';
import { z } from 'zod';

interface AssigneeOption {
  id: string;
  name: string;
}

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assigneeOptions: AssigneeOption[];
  currentIterationId: string | null;
  onTaskCreated: (task: any) => void;
}

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ isOpen, onClose, assigneeOptions, currentIterationId, onTaskCreated }) => {
  const [newTask, setNewTask] = useState<Partial<TaskType>>({ title: '', description: '', priority: 'Moyenne', assignee: '' });
  const [errors, setErrors] = useState<z.ZodError | null>(null);

  const handleCreateTask = async () => {
    const validationResult = taskSchema.safeParse(newTask);
    if (!validationResult.success) {
      setErrors(validationResult.error);
      return;
    }
    setErrors(null);

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
          priorite: 'MEDIUM', // This should be mapped from newTask.priority
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
      
      onTaskCreated(newDbTask);
      onClose();
      setNewTask({ title: '', description: '', priority: 'Moyenne' });

    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-warm-surface rounded-2xl shadow-xl p-8 w-full max-w-lg flex flex-col border border-warm-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-warm-text">Créer une nouvelle tâche</h2>
          <button onClick={onClose} className="text-warm-text-muted hover:text-warm-text">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Titre de la tâche"
                className="w-full p-3 border rounded-lg bg-[#faf9f6] focus:ring-2 focus:ring-[#765b00]/50"
                value={newTask.title || ''}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              {errors?.flatten().fieldErrors.title && <p className="text-red-500 text-sm mt-1">{errors.flatten().fieldErrors.title[0]}</p>}
            </div>
            <div className="md:col-span-2">
              <textarea
                placeholder="Description"
                className="w-full p-3 border rounded-lg bg-[#faf9f6] focus:ring-2 focus:ring-[#765b00]/50"
                value={newTask.description || ''}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>
            <div>
              <select
                className="w-full p-3 border rounded-lg bg-[#faf9f6] focus:ring-2 focus:ring-[#765b00]/50"
                value={newTask.priority || 'Moyenne'}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'Faible' | 'Moyenne' | 'Haute' })}
              >
                <option value="Faible">Faible</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Haute">Haute</option>
              </select>
            </div>
            <div>
              <select
                className="w-full p-3 border rounded-lg bg-[#faf9f6] focus:ring-2 focus:ring-[#765b00]/50"
                value={newTask.assignee || ''}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
              >
                <option value="">Assigner à</option>
                {assigneeOptions.map((option: AssigneeOption) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-[#4d4636] bg-transparent hover:bg-[#d1c5b0]/50 transition-all"
            >
              Annuler
            </button>
            <button 
              onClick={handleCreateTask}
              className="px-4 py-2 rounded-lg font-bold text-white bg-[#1a1c1a] hover:bg-[#4d4636] transition-all"
            >
              Créer la tâche
            </button>
          </div>
      </div>
    </div>
  );
};

export default TaskCreateModal;
