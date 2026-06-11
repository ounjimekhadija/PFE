import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Flag, User, AlertCircle } from 'lucide-react';
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
  onTaskCreated: (task: any, assigneeId: string | undefined) => void;
}

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ isOpen, onClose, assigneeOptions, currentIterationId, onTaskCreated }) => {
  const [newTask, setNewTask] = useState<Partial<TaskType>>({ 
    title: '', 
    description: '', 
    priority: 'Moyenne', 
    assignee: '' 
  });
  const [errors, setErrors] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Custom Dropdowns State
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateTask = async () => {
    setLoading(true);
    // Add status to satisfy schema if needed, although safeParse might ignore extra fields or error if missing
    const taskToValidate = { ...newTask, status: 'À faire' };
    const validationResult = taskSchema.safeParse(taskToValidate);
    
    if (!validationResult.success) {
      setErrors(validationResult.error.flatten().fieldErrors);
      setLoading(false);
      return;
    }
    setErrors(null);

    if (!currentIterationId) {
      alert("Impossible de créer la tâche : Il n'y a pas d'itération (Sprint) active ou à faire pour votre projet.");
      setLoading(false);
      return;
    }

    try {
      const dbPriority = {
        'Faible': 'LOW',
        'Moyenne': 'MEDIUM',
        'Haute': 'HIGH'
      }[newTask.priority || 'Moyenne'];

      const { data: newDbTask, error } = await supabase
        .from('taches')
        .insert({
          iteration_id: currentIterationId,
          titre: newTask.title,
          description: newTask.description || '',
          priorite: dbPriority,
          etat: 'A_FAIRE'
        })
        .select('*')
        .single();

      if (error) {
        console.error("Erreur lors de la création", error);
        alert("Erreur de création de tâche: " + error.message);
        setLoading(false);
        return;
      }

      // Automatically set iteration status to EN_COURS if it was A_FAIRE
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
            etudiant_id: newTask.assignee 
          });

        if (assignError) {
          console.error("Erreur lors de l'assignation", assignError);
        }
      }
      
      onTaskCreated(newDbTask, newTask.assignee);
      onClose();
      setNewTask({ title: '', description: '', priority: 'Moyenne', assignee: '' });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const priorities = [
    { value: 'Faible', color: 'text-blue-500', bg: 'bg-blue-50' },
    { value: 'Moyenne', color: 'text-amber-500', bg: 'bg-amber-50' },
    { value: 'Haute', color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  const selectedPriority = priorities.find(p => p.value === newTask.priority) || priorities[1];
  const selectedAssignee = assigneeOptions.find(a => a.id === newTask.assignee);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-[#faf9f6] rounded-[24px] shadow-[0_20px_50px_rgba(118,91,0,0.15)] p-8 w-full max-w-lg flex flex-col border border-[#d1c5b0] relative overflow-visible" 
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#1a1c1a]">Créer une nouvelle tâche</h2>
            <p className="text-sm text-[#7f7664] mt-1">Ajoutez des détails pour votre équipe.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-[#1a1c1a]/5 text-[#7f7664] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#4d4636] ml-1">Titre de la tâche</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: Conception de la base de données"
                className={`w-full p-4 rounded-xl border ${errors?.title ? 'border-red-500' : 'border-[#d1c5b0]'} bg-white text-[#1a1c1a] shadow-sm outline-none focus:border-[#765b00] focus:ring-4 focus:ring-[#765b00]/10 transition-all`}
                value={newTask.title || ''}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              {errors?.title && (
                <div className="flex items-center gap-1 mt-1.5 ml-1 text-red-500 text-xs font-medium">
                  <AlertCircle size={14} />
                  <span>{errors.title[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#4d4636] ml-1">Description</label>
            <textarea
              placeholder="Décrivez ce qui doit être fait..."
              rows={3}
              className="w-full p-4 rounded-xl border border-[#d1c5b0] bg-white text-[#1a1c1a] shadow-sm outline-none focus:border-[#765b00] focus:ring-4 focus:ring-[#765b00]/10 transition-all resize-none"
              value={newTask.description || ''}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority Dropdown */}
            <div className="space-y-2" ref={priorityRef}>
              <label className="text-sm font-bold text-[#4d4636] ml-1">Priorité</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-[#d1c5b0] bg-white text-[#1a1c1a] shadow-sm hover:border-[#765b00]/50 transition-all outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Flag size={16} className={selectedPriority.color} />
                    <span className="text-sm font-medium">{selectedPriority.value}</span>
                  </div>
                  <ChevronDown size={16} className={`text-[#7f7664] transition-transform duration-300 ${showPriorityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPriorityDropdown && (
                  <div className="absolute z-[60] mt-2 w-full bg-white border border-[#d1c5b0] rounded-xl shadow-[0_10px_25px_rgba(118,91,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {priorities.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          setNewTask({ ...newTask, priority: p.value as any });
                          setShowPriorityDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-[#765b00]/5 transition-colors font-medium"
                      >
                        <Flag size={14} className={p.color} />
                        {p.value}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assignee Dropdown */}
            <div className="space-y-2" ref={assigneeRef}>
              <label className="text-sm font-bold text-[#4d4636] ml-1">Assigner à</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-[#d1c5b0] bg-white text-[#1a1c1a] shadow-sm hover:border-[#765b00]/50 transition-all outline-none"
                >
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-[#7f7664]" />
                    <span className="text-sm font-medium truncate">
                      {selectedAssignee ? selectedAssignee.name : 'Choisir un membre'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-[#7f7664] transition-transform duration-300 ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAssigneeDropdown && (
                  <div className="absolute z-[60] mt-2 w-full bg-white border border-[#d1c5b0] rounded-xl shadow-[0_10px_25px_rgba(118,91,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTask({ ...newTask, assignee: '' });
                        setShowAssigneeDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-sm text-left hover:bg-[#765b00]/5 transition-colors font-medium text-[#7f7664]"
                    >
                      Non assigné
                    </button>
                    {assigneeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setNewTask({ ...newTask, assignee: option.id });
                          setShowAssigneeDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-[#765b00]/5 transition-colors font-medium"
                      >
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(option.name)}&background=random`} 
                          className="w-5 h-5 rounded-full" 
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

        <div className="flex items-center justify-end gap-3 mt-10">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-[#4d4636] bg-[#f4f3f1] hover:bg-[#efeeeb] transition-all"
          >
            Annuler
          </button>
          <button 
            onClick={handleCreateTask}
            disabled={loading}
            className="px-6 py-3 rounded-xl font-bold text-white bg-[#1a1c1a] hover:bg-[#4d4636] transition-all shadow-lg shadow-[#1a1c1a]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : null}
            <span>Créer la tâche</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TaskCreateModal;
