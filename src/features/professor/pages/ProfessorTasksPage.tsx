import React, { useState, useRef } from 'react';
import { Plus, Clock, MoreVertical, Paperclip, MessageSquare, Smile, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { taskColumns } from '../../../shared/data/mockData';

const Tasks: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [comments, setComments] = useState<{ [taskId: string]: string }>({});
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoTitle, setRepoTitle] = useState('');
  const [repoGroup, setRepoGroup] = useState('');
  const [repoDesc, setRepoDesc] = useState('');
  const repoDescRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const handleRepoDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRepoDesc(e.target.value);
    if (repoDescRef.current) {
      repoDescRef.current.style.height = 'auto';
      repoDescRef.current.style.height = repoDescRef.current.scrollHeight + 'px';
    }
  };

  const handleCommentChange = (taskId: string, value: string) => {
    setComments((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleTaskClick = (task: any, column: any) => {
    // Pour la démo, on affiche toutes les tâches de la colonne (groupe)
    setModalTasks(column.tasks);
    setModalTitle(column.title);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  return (
    <div className="flex-1 bg-white p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">My Task Board #1</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            onClick={() => setShowRepoModal(true)}
          >
            ADD A REPOSITORY
          </button>
        </div>
            {/* Modal pour ajout de commit/repository */}
            {showRepoModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[3px]">
                <div className="bg-white rounded-3xl shadow-2xl p-8 min-w-[350px] max-w-lg w-full relative border border-gray-100">
                  <button onClick={() => setShowRepoModal(false)} className="absolute top-4 right-6 text-gray-400 hover:text-red-500 text-3xl font-bold">&times;</button>
                  <h2 className="text-2xl font-extrabold mb-7 text-gray-900 tracking-tight">Ajouter un Commit</h2>
                  <form className="flex flex-col gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-700">Titre du commit</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] bg-gray-50 focus:outline-none transition-all shadow-sm placeholder:text-gray-400"
                        placeholder="Titre du commit..."
                        value={repoTitle}
                        onChange={e => setRepoTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-700">Groupe concerné</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] bg-gray-50 focus:outline-none transition-all shadow-sm placeholder:text-gray-400"
                        placeholder="Nom du groupe..."
                        value={repoGroup}
                        onChange={e => setRepoGroup(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-700">Description détaillée</label>
                      <textarea
                        ref={repoDescRef}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] bg-gray-50 focus:outline-none transition-all shadow-sm placeholder:text-gray-400 min-h-[80px] resize-none overflow-hidden"
                        placeholder="Décrivez le commit en détail..."
                        value={repoDesc}
                        onChange={handleRepoDescChange}
                        rows={3}
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-all shadow"
                      onClick={() => setShowRepoModal(false)}
                    >
                      Enregistrer
                    </button>
                  </form>
                </div>
              </div>
            )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {taskColumns.map((column, colIdx) => (
          <div key={colIdx} className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{column.title}</h3>
                <p className="text-xs text-gray-400">{column.subtitle}</p>
              </div>
            </div>

            <div className="space-y-4">
              {column.tasks.map((task) => (
                <motion.div 
                  key={task.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative group cursor-pointer"
                  onClick={() => handleTaskClick(task, column)}
                >
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <img src={`https://picsum.photos/seed/task${task.id}/30/30`} alt="Avatar" className="w-8 h-8 rounded-full" />
                      <div className="w-0.5 h-full bg-gray-100 group-last:hidden"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Commits on {task.date}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 mb-1 leading-tight">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-4">{task.assignee}</p>
                      <div className="flex justify-between items-center">
                        {/* compteur de commentaires supprimé */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                          task.status === 'DONE' ? 'bg-green-100 text-green-600' :
                          task.status === 'URGENT' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal popup pour les tâches du groupe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[3px]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 min-w-[350px] max-w-lg w-full relative border border-gray-100">
            <button onClick={closeModal} className="absolute top-4 right-6 text-gray-400 hover:text-red-500 text-3xl font-bold">&times;</button>
            <h2 className="text-2xl font-extrabold mb-7 text-gray-900 tracking-tight">Tâches du groupe : <span className='text-indigo-600'>{modalTitle}</span></h2>
            <ul className="space-y-6">
              {modalTasks.map((t, idx) => (
                <li key={t.id} className="pb-4 border-b last:border-b-0 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-800 text-lg flex-1">{t.title}</div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm select-none tracking-wide ${
                      t.status === 'DONE' ? 'bg-green-100 text-green-700 border border-green-200' :
                      t.status === 'URGENT' ? 'bg-red-100 text-red-600 border border-red-200' :
                      'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-1 font-medium">Assigné à : <span className="text-gray-700 font-semibold">{t.assignee}</span></div>
                  <div className="relative flex items-center mt-1">
                    <input
                      type="text"
                      placeholder="Ajouter un commentaire..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] bg-gray-50 focus:outline-none transition-all shadow-sm placeholder:text-gray-400 pr-12"
                      value={comments[t.id] || ''}
                      onChange={e => handleCommentChange(t.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800 p-2 rounded-lg transition-all focus:outline-none bg-transparent shadow-none"
                      title="Envoyer le commentaire"
                    >
                      <Send size={22} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
