import React from "react";

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment: string;
}


const CommentModal: React.FC<CommentModalProps> = ({ isOpen, onClose, comment }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <button
        className="absolute top-6 right-8 text-gray-400 hover:text-gray-700 text-2xl z-10"
        onClick={onClose}
        aria-label="Fermer"
      >
        &#10005;
      </button>
      <div className="relative z-10 flex items-center gap-4">
        <img
          src="https://randomuser.me/api/portraits/men/32.jpg"
          alt="Professeur"
          className="w-16 h-16 rounded-full border-2 border-indigo-200 object-cover shadow"
        />
        <div className="bg-indigo-50 rounded-xl p-4 text-gray-800 text-base shadow-inner">
          {comment}
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
