import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, X } from 'lucide-react';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  readOnly?: boolean;
}

const CommentModal: React.FC<CommentModalProps> = ({ isOpen, onClose, taskId, readOnly = false }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    if (!taskId) return;
    const { data: commentsData, error } = await supabase
      .from('tache_commentaires')
      .select('*, auteur:utilisateurs!auteur_id(nom, prenom)')
      .eq('tache_id', taskId)
      .order('created_at', { ascending: true });

    if (!error && commentsData) {
      setComments(commentsData);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchComments();
    } else {
      setComments([]);
    }
  }, [isOpen, taskId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !taskId) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase
        .from('tache_commentaires')
        .insert({
          tache_id: taskId,
          auteur_id: user.id,
          contenu: newComment.trim(),
        });

      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de l'ajout du commentaire: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Commentaires de la tâche</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4 bg-gray-50/50 min-h-[200px]">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-gray-400 italic py-8">Aucun commentaire pour l'instant.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${c.auteur?.prenom || 'U'}&background=c7d2fe&color=3730a3`}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
                <div className="flex flex-col flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700">{c.auteur?.prenom} {c.auteur?.nom}</span>
                    <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div className="bg-white border rounded-xl rounded-tl-none p-3 text-sm text-gray-700 shadow-sm">
                    {c.contenu}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!readOnly && (
          <form onSubmit={handleSend} className="p-4 border-t bg-white flex gap-2">
            <input 
              type="text"
              className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ajouter un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !newComment.trim()}
              className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center w-10 h-10"
            >
              <Send size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CommentModal;
