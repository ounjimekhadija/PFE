import React, { useState } from 'react';
import { Plus, Bell, Search, Filter, MoreVertical, X } from 'lucide-react';
import { motion } from 'motion/react';
import { projects, members } from '../../../shared/data/mockData';
import { Project, Member } from '../../../shared/types';

const Dashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Fonction pour obtenir les membres du groupe pour un projet donné (exemple simple)
  const getGroupMembers = (project: Project | null): Member[] => {
    if (!project) return [];
    if (project.id === 1) return members.filter(m => m.name === 'Hira R' || m.name === 'David Smith');
    if (project.id === 2) return members.filter(m => m.name === 'Stephanie J' || m.name === 'William Doe');
    if (project.id === 3) return members.filter(m => m.name === 'David Smith' || m.name === 'William Doe');
    if (project.id === 4) return members.filter(m => m.name === 'Hira R' || m.name === 'Stephanie J');
    return [];
  };

  return (
    <div className="flex-1 bg-white text-gray-900 p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">My Portfolio</h1>
        <img src="https://picsum.photos/seed/hira/40/40" alt="Hira R" className="w-8 h-8 rounded-full" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-semibold">My Projects</h2>
                {/* Ligne supprimée */}
              </div>
              {/* Filtres supprimés */}
            </div>

            {/* Ligne 'Ongoing Projects' supprimée */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  whileHover={{ y: -2, boxShadow: '0 6px 24px 0 rgba(80,80,120,0.10)' }}
                  className="bg-transparent rounded-xl p-5 border border-gray-100 transition-all duration-200 relative overflow-hidden group cursor-pointer hover:shadow-lg"
                  onClick={() => {
                    setSelectedProject(project);
                    setShowProjectModal(true);
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-black to-gray-800"></div>
                  {/* Date supprimée */}
                  <h3 className="text-xl font-bold mb-1 text-gray-800 tracking-tight">{project.title}</h3>
                  <p className="text-xs text-gray-500 mb-5 font-medium">{project.category}</p>
                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 font-medium">Progress</span>
                      <span className="text-gray-700 font-semibold">{project.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-black to-gray-800"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {getGroupMembers(project).map((m) => (
                        <img key={m.id} src={m.avatar} className="w-7 h-7 rounded-full border-2 border-gray-200 shadow-sm" alt={m.name} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{project.timeLeft}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Modal projet : nom projet + membres du groupe */}
            {showProjectModal && selectedProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-gray-50 rounded-3xl p-0 min-w-[340px] max-w-[95vw] shadow-2xl relative border border-gray-200 flex flex-col md:flex-row overflow-hidden">
                  <button className="absolute top-4 right-4 text-gray-300 hover:text-indigo-500 transition-colors z-10" onClick={() => setShowProjectModal(false)}><X size={26} /></button>
                  {/* Colonne gauche : projet (juste nom et description simple) */}
                    <div className="md:w-1/2 w-full bg-gray-100 p-8 flex flex-col justify-center items-start border-r border-gray-200">
                      <div className={`font-extrabold text-2xl tracking-tight mb-4 ${selectedProject.title === 'Web Designing' ? 'text-blue-600' : 'text-gray-700'}`}>{selectedProject.title}</div>
                      <div className="text-gray-600 text-base mb-2">Ce projet consiste à travailler en équipe sur le livrable <b className='text-gray-800'>{selectedProject.title}</b>.</div>
                  </div>
                  {/* Colonne droite : membres */}
                  <div className="md:w-1/2 w-full p-8 flex flex-col justify-center">
                    {/* plus de titre ici, juste la liste des membres */}
                    <div className="flex gap-6 flex-wrap items-center">
                      {getGroupMembers(selectedProject).map(m => (
                        <div key={m.id} className="flex flex-col items-center">
                          <img src={m.avatar} alt={m.name} className="w-12 h-12 rounded-full object-cover mb-1" />
                          <span className="text-sm font-semibold text-indigo-800 drop-shadow-sm">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
            <div className="flex gap-4 text-gray-400">
                {/* Icônes search et menu supprimées */}
            </div>
          </div>

          <div className="space-y-6">
            {/* Exemple de notifications variées */}
            {[
              { type: 'message', name: 'David Smith', content: 'Hey tell me about progress of project? Waiting for your response', time: '21 July', avatar: 'https://picsum.photos/seed/david/50/50', active: false },
              { type: 'deliverable', name: 'Hira R', content: 'a déposé un livrable : Project Specification', time: '20 July', avatar: 'https://picsum.photos/seed/hira/50/50' },
              { type: 'message', name: 'Stephanie J', content: 'I got your first assignment. It was quite good 👍 You can start work on next assignment', time: '19 July', avatar: 'https://picsum.photos/seed/steph/50/50', active: true },
              { type: 'other', name: 'Admin', content: 'Votre mot de passe a été modifié avec succès.', time: '18 July', avatar: 'https://picsum.photos/seed/admin/50/50' },
              { type: 'message', name: 'William Doe', content: 'I want some changes in previous work you sent me. Waiting for your reply.', time: '17 July', avatar: 'https://picsum.photos/seed/will/50/50', active: false },
            ].map((notif, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ x: 5 }}
                className={`flex gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-gray-50`}
              >
                <img src={notif.avatar} alt={notif.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold text-sm text-gray-800">{notif.name}</h4>
                    <span className="text-[10px] text-gray-400">{notif.time}</span>
                  </div>
                  {/* Affichage selon le type de notification */}
                  {notif.type === 'deliverable' ? (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <span className="inline-block w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-1">📄</span>
                      {notif.name} {notif.content}
                    </p>
                  ) : notif.type === 'other' ? (
                    <p className="text-xs text-blue-700 flex items-center gap-1">
                      <span className="inline-block w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-1">ℹ️</span>
                      {notif.content}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{notif.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
