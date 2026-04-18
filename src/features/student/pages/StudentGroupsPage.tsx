import React, { useState } from 'react';
import { Users, Search, UserPlus, Mail, Github, Linkedin, MoreVertical, Filter, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Student {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
  status: 'Available' | 'In Group';
  skills: string[];
  groupName?: string;
}

const StudentGroups: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([
    { id: '1', name: 'Hira R', role: 'UI/UX Designer', email: 'hira@student.hub', avatar: 'https://picsum.photos/seed/hira/100/100', status: 'In Group', skills: ['Figma', 'React', 'Tailwind'] },
    { id: '2', name: 'Anas M', role: 'Backend Developer', email: 'anas@student.hub', avatar: 'https://picsum.photos/seed/anas/100/100', status: 'In Group', skills: ['Node.js', 'Firebase', 'SQL'] },
    { id: '3', name: 'Sara K', role: 'Frontend Developer', email: 'sara@student.hub', avatar: 'https://picsum.photos/seed/sara/100/100', status: 'Available', skills: ['React', 'TypeScript', 'CSS'] },
    { id: '4', name: 'Yassine B', role: 'DevOps Engineer', email: 'yassine@student.hub', avatar: 'https://picsum.photos/seed/yassine/100/100', status: 'Available', skills: ['Docker', 'AWS', 'CI/CD'] },
    { id: '5', name: 'Lina T', role: 'Mobile Developer', email: 'lina@student.hub', avatar: 'https://picsum.photos/seed/lina/100/100', status: 'Available', skills: ['Flutter', 'Firebase', 'Dart'] },
    { id: '6', name: 'Omar J', role: 'Data Scientist', email: 'omar@student.hub', avatar: 'https://picsum.photos/seed/omar/100/100', status: 'Available', skills: ['Python', 'R', 'TensorFlow'] },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Student[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ajoute ou retire un étudiant de la sélection
  const toggleSelect = (student: Student) => {
    if (selected.find(s => s.id === student.id)) {
      setSelected(selected.filter(s => s.id !== student.id));
    } else {
      setSelected([...selected, student]);
    }
  };

  // Retire un étudiant de la sélection depuis la barre
  const removeSelected = (id: string) => {
    setSelected(selected.filter(s => s.id !== id));
  };

  // Handler pour valider la création du groupe
  const handleCreateGroup = () => {
    // Ajoute le nom du groupe aux étudiants sélectionnés
    setStudents(prev => prev.map(s =>
      selected.find(sel => sel.id === s.id)
        ? { ...s, status: 'In Group', groupName: groupName.trim() }
        : s
    ));
    setShowGroupModal(false);
    setGroupName('');
    setSelected([]);
    // Optionnel: afficher une notification de succès
  };

  return (
    <div className="flex-1 bg-white p-8 flex flex-col overflow-hidden">
      {/* BARRE DE SÉLECTION EN HAUT */}
      {selected.length > 0 && (
        <div className="mb-6 flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-3 shadow-sm">
          <span className="font-bold text-indigo-700 text-sm">Selected:</span>
          <div className="flex gap-2 flex-wrap">
            {selected.map(s => (
              <div key={s.id} className="flex items-center gap-1 bg-white border border-indigo-200 rounded-xl px-3 py-1 text-xs font-semibold text-indigo-700">
                <img src={s.avatar} alt={s.name} className="w-6 h-6 rounded-full mr-1" />
                {s.name}
                <button onClick={() => removeSelected(s.id)} className="ml-1 text-indigo-400 hover:text-red-500 font-bold">×</button>
              </div>
            ))}
          </div>
          <button
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
            onClick={() => setShowGroupModal(true)}
          >
            Create Group
          </button>
        </div>
      )}

      {/* MODAL DE NOMMAGE DU GROUPE */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-xs flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Name your group</h2>
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full mb-6 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-center"
              autoFocus
            />
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition-all"
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
              >
                Create
              </button>
              <button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl transition-all"
                onClick={() => setShowGroupModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Directory</h1>
          <p className="text-gray-500 mt-1">Connect with fellow students and form your project groups.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-50 border border-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-300 w-64 transition-all"
            />
          </div>
          <button className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-gray-500 hover:bg-gray-100 transition-all">
            <Filter size={20} />
          </button>
          {/* Bouton 'Create Group' supprimé */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <motion.div 
              key={student.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 rounded-[32px] p-8 border border-gray-100 hover:border-indigo-200 hover:bg-white transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="relative">
                  <img 
                    src={student.avatar} 
                    alt={student.name} 
                    className="w-20 h-20 rounded-[28px] object-cover border-4 border-white shadow-md"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${
                    student.status === 'Available' ? 'bg-green-500' : 'bg-indigo-500'
                  }`}>
                    {student.status === 'In Group' && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                </div>
                <button className="text-gray-300 hover:text-gray-600">
                  <MoreVertical size={20} />
                </button>
              </div>


              <h3 className="text-xl font-bold text-gray-900 mb-1">{student.name}</h3>
              <p className="text-sm font-bold text-indigo-600 mb-1">{student.role}</p>
              {student.groupName && (
                <div className="mb-3">
                  <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold rounded px-3 py-1">{student.groupName}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-8">
                {student.skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-gray-100">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <div className="flex gap-3">
                  <button className="p-2 text-gray-400 hover:text-indigo-600 transition-all">
                    <Mail size={18} />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-black transition-all">
                    <Github size={18} />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-blue-600 transition-all">
                    <Linkedin size={18} />
                  </button>
                </div>
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    student.status === 'Available'
                      ? selected.find(s => s.id === student.id)
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/20'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={student.status !== 'Available'}
                  onClick={() => toggleSelect(student)}
                >
                  <UserPlus size={14} />
                  {student.status === 'Available'
                    ? selected.find(s => s.id === student.id)
                      ? 'Selected'
                      : 'Invite'
                    : 'In Group'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentGroups;
