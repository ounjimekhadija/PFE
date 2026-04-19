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
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <button
        className="absolute top-6 right-8 text-gray-400 hover:text-gray-200 transition-colors text-3xl z-10 font-light"
        onClick={onClose}
        aria-label="Fermer"
      >
        &#10005;
      </button>

      <div className="relative z-10 flex flex-col gap-6 w-full max-w-3xl px-4 max-h-[85vh] overflow-y-auto style-scroll">
        {comments.length === 0 ? (
          <div className="flex items-center gap-4 justify-center">
            <div className="bg-indigo-50/90 rounded-2xl p-6 text-gray-600 font-medium italic text-base shadow-lg shadow-black/10 backdrop-blur-md">
              Aucun commentaire pour l'instant.
            </div>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex items-center gap-4">
              <img
                src={`https://ui-avatars.com/api/?name=${c.auteur?.prenom || 'U'}&background=c7d2fe&color=3730a3`}
                alt="Avatar"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-indigo-200/50 object-cover shadow-lg flex-shrink-0 bg-white"
              />
              <div className="bg-indigo-50 rounded-2xl p-4 sm:p-5 text-gray-800 text-sm sm:text-base shadow-lg shadow-black/10">
                <div className="text-xs text-indigo-400/80 font-bold mb-1.5 uppercase tracking-wider flex justify-between items-center gap-6">
                  <span>{c.auteur?.prenom} {c.auteur?.nom}</span>
                  <span className="text-[10px] font-normal opacity-70 lowercase">
                    {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </span>
                </div>
                <div className="leading-relaxed">
                  {c.contenu}
                </div>
              </div>
            </div>
          ))
        )}

        {!readOnly && (
          <form onSubmit={handleSend} className="mt-4 flex gap-4 items-center">
            {/* Espace vide pour s'aligner avec les bulles (sur desktop) */}
            <div className="w-16 h-16 rounded-full flex-shrink-0 hidden sm:block opacity-0"></div>
            
            <div className="flex-1 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl shadow-black/10 border border-white/20 flex overflow-hidden group focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
              <input 
                type="text"
                className="flex-1 px-5 py-4 text-base bg-transparent focus:outline-none placeholder:text-gray-400 text-gray-800"
                placeholder="Rédiger une réponse..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <button 
                type="submit" 
                disabled={loading || !newComment.trim()}
                className="bg-indigo-600 text-white px-3 sm:px-6 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center font-medium"
              >
                <span className="hidden sm:inline mr-2">Envoyer</span>
                <Send size={18} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CommentModal;
