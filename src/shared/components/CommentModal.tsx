import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
      if (!user) throw new Error('Not logged in');

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
      alert("Error adding comment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300" onClick={onClose}>
      
      <div 
        className="relative z-10 w-full max-w-2xl bg-[#F8FAFC] rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.2)] border border-[#C8D6E5] flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#C8D6E5]/50 bg-white/50 backdrop-blur-sm shrink-0">
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#1a1c1a]/5 text-[#64748B] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {fetchLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-3 border-[#1E3A5F]/20 border-t-[#1E3A5F] rounded-full animate-spin"></div>
              <p className="text-sm text-[#64748B] font-medium">Loading messages...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-[#C8D6E5]/20 rounded-full flex items-center justify-center text-[#64748B]">
                <MessageSquare size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[#1a1c1a] font-bold">No messages yet</p>
                <p className="text-sm text-[#64748B]">Be the first to start the discussion!</p>
              </div>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <img
                  src={c.auteur?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.auteur?.prenom || 'U')}&background=random`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-[#C8D6E5] object-cover shadow-sm bg-white shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-[#1a1c1a]">{c.auteur?.prenom} {c.auteur?.nom}</span>
                    <div className="flex items-center gap-1 text-[10px] text-[#64748B] font-medium bg-[#EEF3F8] px-2 py-0.5 rounded-full">
                      <Clock size={10} />
                      {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-none p-4 text-[#334155] text-sm leading-relaxed shadow-sm border border-[#C8D6E5]/30">
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
          <div className="p-6 bg-white border-t border-[#C8D6E5]/50 shrink-0">
            <form onSubmit={handleSend} className="relative flex items-center gap-3">
              <input 
                type="text"
                className="flex-1 bg-[#EEF3F8] border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-[#1E3A5F] outline-none transition-all pr-12 text-[#1a1c1a]"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !newComment.trim()}
                className="absolute right-2 p-2.5 bg-[#1E3A5F] text-white rounded-xl hover:bg-[#172D49] transition-all disabled:opacity-30 shadow-lg shadow-[#1E3A5F]/20 flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CommentModal;
