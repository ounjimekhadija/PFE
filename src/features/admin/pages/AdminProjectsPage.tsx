import React, { useState } from 'react';
import { Plus, Calendar, User, Target, Clock, MoreHorizontal, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminProject {
  id: string;
  title: string;
  category: string;
  supervisor: string;
  group: string;
  deadline: string;
  progress: number;
}

const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<AdminProject[]>([
    { id: '1', title: 'AI-Powered Healthcare System', category: 'Machine Learning', supervisor: 'Dr. Sarah Wilson', group: 'Group A1', deadline: '2024-06-15', progress: 65 },
    { id: '2', title: 'Blockchain Voting Platform', category: 'Cybersecurity', supervisor: 'Prof. James Miller', group: 'Group B2', deadline: '2024-06-20', progress: 40 },
    { id: '3', title: 'Smart City Traffic Control', category: 'IoT', supervisor: 'Dr. Sarah Wilson', group: 'Group C3', deadline: '2024-06-10', progress: 90 },
  ]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    supervisor: '',
    group: '',
    filiere: '',
  });

  // Options simulées (à remplacer par vos vraies données si besoin)
  const filiereOptions = ['Machine Learning', 'Cybersecurity', 'IoT', 'Prototyping', 'Medical'];
  const supervisorOptions = ['Dr. Sarah Wilson', 'Prof. James Miller', 'Dr. John Doe'];
  const groupOptions = ['Group A1', 'Group B2', 'Group C3'];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setProjects([
      ...projects,
      {
        id: (projects.length + 1).toString(),
        title: newProject.title,
        category: newProject.filiere,
        supervisor: newProject.supervisor,
        group: newProject.group,
        deadline: '',
        progress: 0,
      },
    ]);
    setShowModal(false);
    setNewProject({ title: '', supervisor: '', group: '', filiere: '' });
  };

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-500 mt-1">Create projects, assign supervisors, and set global deadlines.</p>
        </div>
        <div className="flex w-full md:w-auto justify-end">
          <button
            className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-black transition-all shadow-md min-w-0"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Create Project</span>
          </button>
        </div>

        {/* Modal Create Project */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className="text-xl font-bold mb-6 text-gray-900">Create Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-1">Project Name</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                    value={newProject.title}
                    onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Supervisor</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                    value={newProject.supervisor}
                    onChange={e => setNewProject({ ...newProject, supervisor: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select supervisor</option>
                    {supervisorOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Group</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                    value={newProject.group}
                    onChange={e => setNewProject({ ...newProject, group: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select group</option>
                    {groupOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Filière</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-400"
                    value={newProject.filiere}
                    onChange={e => setNewProject({ ...newProject, filiere: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select filière</option>
                    {filiereOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => (
          <motion.div
            key={project.id}
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg">
                {project.category}
              </span>
              {/* MoreHorizontal icon supprimé */}
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{project.title}</h3>
            
            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User size={16} className="text-gray-400" />
                <span className="font-medium">Supervisor:</span>
                <span className="text-gray-900">{project.supervisor}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Target size={16} className="text-gray-400" />
                <span className="font-medium">Group:</span>
                <span className="text-gray-900">{project.group}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} className="text-gray-400" />
                <span className="font-medium">Deadline:</span>
                <span className="text-red-500 font-bold">{project.deadline}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</span>
                <span className="text-xs font-bold text-indigo-600">{project.progress}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminProjects;
