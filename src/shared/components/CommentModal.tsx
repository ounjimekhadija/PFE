import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, X, MessageSquare, Clock } from 'lucide-react';

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
  const [fetchLoading, setFetchLoading] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    if (!taskId) return;
    setFetchLoading(true);
    const { data: commentsData, error } = await supabase
      .from('tache_commentaires')
      .select('*, auteur:utilisateurs!auteur_id(nom, prenom, avatar_url)')
      .eq('tache_id', taskId)
      .order('created_at', { ascending: true });

    if (!error && commentsData) {
      setComments(commentsData);
    }
    setFetchLoading(false);
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchComments();
    } else {
      setComments([]);
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
      
      <div 
        className="relative z-10 w-full max-w-2xl bg-[#faf9f6] rounded-[32px] shadow-[0_20px_60px_rgba(118,91,0,0.2)] border border-[#d1c5b0] flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#d1c5b0]/50 bg-white/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#765b00]/10 rounded-xl text-[#765b00]">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1a1c1a]">Commentaires</h2>
              <p className="text-xs text-[#7f7664] font-medium uppercase tracking-wider">Discussions de la tâche</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#1a1c1a]/5 text-[#7f7664] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {fetchLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-3 border-[#765b00]/20 border-t-[#765b00] rounded-full animate-spin"></div>
              <p className="text-sm text-[#7f7664] font-medium">Chargement des messages...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-[#d1c5b0]/20 rounded-full flex items-center justify-center text-[#7f7664]">
                <MessageSquare size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[#1a1c1a] font-bold">Aucun message pour le moment</p>
                <p className="text-sm text-[#7f7664]">Soyez le premier à lancer la discussion !</p>
              </div>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <img
                  src={c.auteur?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.auteur?.prenom || 'U')}&background=random`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-[#d1c5b0] object-cover shadow-sm bg-white shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-[#1a1c1a]">{c.auteur?.prenom} {c.auteur?.nom}</span>
                    <div className="flex items-center gap-1 text-[10px] text-[#7f7664] font-medium bg-[#f4f3f1] px-2 py-0.5 rounded-full">
                      <Clock size={10} />
                      {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-none p-4 text-[#4d4636] text-sm leading-relaxed shadow-sm border border-[#d1c5b0]/30">
                    {c.contenu}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Footer Input */}
        {!readOnly && (
          <div className="p-6 bg-white border-t border-[#d1c5b0]/50 shrink-0">
            <form onSubmit={handleSend} className="relative flex items-center gap-3">
              <input 
                type="text"
                className="flex-1 bg-[#f4f3f1] border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-[#765b00] outline-none transition-all pr-12 text-[#1a1c1a]"
                placeholder="Écrire un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !newComment.trim()}
                className="absolute right-2 p-2.5 bg-[#765b00] text-white rounded-xl hover:bg-[#594400] transition-all disabled:opacity-30 shadow-lg shadow-[#765b00]/20 flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentModal;
