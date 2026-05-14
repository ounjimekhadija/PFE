import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Mail, Github, Linkedin, MoreVertical, Filter, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import EmailModal from '../../../shared/components/EmailModal';

interface Student {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
  status: 'Available' | 'In Group';
  skills: string[];
  groupName?: string;
  projet_id?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
}

const StudentGroups: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Student[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<{ id: string; titre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<Student | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('utilisateurs')
          .select('nom, prenom')
          .eq('id', user.id)
          .single();
        if (userData) {
          setCurrentUser({ id: user.id, name: `${userData.prenom} ${userData.nom}` });
        }
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase.from('projets').select('id, titre');
      if (error) {
        console.error('Error fetching projects:', error);
      } else {
        setProjects(data);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('etudiants')
          .select(`id, projet_id, filiere, github_url, linkedin_url, utilisateurs (nom, prenom, email, avatar_url)`);

        if (error) throw error;

        const { data: projects } = await supabase.from('projets').select('id, titre');
        const projectMap: Record<string, string> = {};
        projects?.forEach(p => projectMap[p.id] = p.titre);

        if (data) {
          const formattedStudents: Student[] = data.map((student: any) => {
            const avatarUrl = student.utilisateurs?.avatar_url
              ? student.utilisateurs.avatar_url
              : `https://ui-avatars.com/api/?name=${student.utilisateurs?.prenom}+${student.utilisateurs?.nom}&background=random`;

            return {
              id: student.id,
              name: student.utilisateurs ? `${student.utilisateurs.prenom} ${student.utilisateurs.nom}` : student.id,
              role: student.filiere || 'Étudiant',
              email: student.utilisateurs?.email || '',
              avatar: avatarUrl,
              status: student.projet_id ? 'In Group' : 'Available',
              skills: ['React', 'Node.js', 'SQL'],
              groupName: student.projet_id ? projectMap[student.projet_id] || `Projet #${student.projet_id}` : undefined,
              projet_id: student.projet_id,
              githubUrl: student.github_url,
              linkedinUrl: student.linkedin_url
            };
          });
          setStudents(formattedStudents);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des étudiants:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const handleOpenEmailModal = (student: Student) => {
    setEmailRecipient(student);
    setIsEmailModalOpen(true);
  };

  let filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (sortOrder === 'asc') filteredStudents.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortOrder === 'desc') filteredStudents.sort((a, b) => b.name.localeCompare(a.name));

  const handleFilterClick = () => {
    if (sortOrder === 'none') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('none');
  };

  const toggleSelect = (student: Student) => {
    if (student.status === 'In Group') return;
    if (selected.find(s => s.id === student.id)) {
      setSelected(selected.filter(s => s.id !== student.id));
    } else {
      setSelected([...selected, student]);
    }
  };

  const removeSelected = (id: string) => {
    setSelected(selected.filter(s => s.id !== id));
  };

  const handleCreateGroup = async () => {
    if (!projectName) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      if (selected.length === 0 && !currentUserId) {
        alert('Sélectionnez au moins un étudiant disponible ou soyez connecté.');
        return;
      }

      const selectedUnavailable = selected.filter((s) => s.projet_id);
      if (selectedUnavailable.length > 0) {
        alert('Un ou plusieurs étudiants sélectionnés sont déjà dans un groupe.');
        return;
      }

      if (currentUserId) {
        const { data: meRow } = await supabase
          .from('etudiants')
          .select('id, projet_id')
          .eq('id', currentUserId)
          .single();

        if (meRow?.projet_id) {
          alert("Vous êtes déjà assigné à un projet. Un étudiant ne peut appartenir qu'à un seul projet.");
          return;
        }
      }

      const projectId = projectName;
      const selectedProject = projects.find(p => p.id === projectId);

      const studentIdsToUpdate = selected.map(s => s.id);
      if (currentUserId && !studentIdsToUpdate.includes(currentUserId)) {
        studentIdsToUpdate.push(currentUserId);
      }

      const { data: updatedRows, error: studentUpdateError } = await supabase
        .from('etudiants')
        .update({ projet_id: projectId })
        .in('id', studentIdsToUpdate)
        .select('id');

      if (studentUpdateError) throw studentUpdateError;

      if ((updatedRows || []).length !== studentIdsToUpdate.length) {
        // This check might be too strict if some students were already in the group, but let's keep it for now.
        // A better approach would be to check if the update failed for other reasons.
        console.warn('Not all students could be updated. Some might have been assigned to a project just now.');
      }

      setStudents(prev => prev.map(s =>
        studentIdsToUpdate.includes(s.id)
          ? { ...s, status: 'In Group', groupName: selectedProject?.titre, projet_id: projectId }
          : s
      ));

      setShowGroupModal(false);
      setProjectName('');
      setSelected([]);
      alert("Groupe créé avec succès !");
    } catch (error: any) {
      console.error('Erreur lors de la création du groupe:', error);
      alert(`Une erreur s'est produite: ${error?.message || error?.details || JSON.stringify(error)}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="relative flex h-full w-full flex-col">
        {selected.length > 0 && (
          <div className="mb-6 flex items-center gap-4 bg-[#ffd464]/20 border border-transparent rounded-2xl px-6 py-3 shadow-sm">
            <span className="font-bold text-[#594400] text-sm">Selected:</span>
            <div className="flex gap-2 flex-wrap">
              {selected.map(s => (
                <div key={s.id} className="flex items-center gap-1 bg-white border border-transparent rounded-xl px-3 py-1 text-xs font-semibold text-[#594400]">
                  <img src={s.avatar} alt={s.name} className="w-6 h-6 rounded-full mr-1" />
                  {s.name}
                  <button onClick={() => removeSelected(s.id)} className="ml-1 text-[#7f7664] hover:text-[#ba1a1a] font-bold">×</button>
                </div>
              ))}
            </div>
            <button
              className="ml-auto bg-[#765b00] hover:bg-[#594400] text-white px-5 py-2 rounded-xl font-bold shadow-sm transition-all"
              onClick={() => setShowGroupModal(true)}
            >
              Create Group
            </button>
          </div>
        )}

        {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md flex flex-col items-center border border-transparent">
              <h2 className="text-xl font-bold mb-4 text-[#1a1c1a]">Choose a Project</h2>
              <div className="relative w-full mb-6 text-left">
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#765b00]/50 transition-all"
                >
                  <span className={!projectName ? 'text-gray-400' : 'text-[#1a1c1a]'}>
                    {projectName 
                      ? projects.find(p => p.id === projectName)?.titre 
                      : 'Select a project'}
                  </span>
                  <svg className={`h-4 w-4 text-[#7f7664] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProjectDropdown && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl transition-all animate-in fade-in slide-in-from-top-1">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProjectName(p.id);
                          setShowProjectDropdown(false);
                        }}
                        className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors ${projectName === p.id ? 'bg-[#765b00] text-white' : 'text-[#1a1c1a] hover:bg-[#765b00]/5'}`}
                      >
                        {p.titre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  className="flex-1 bg-[#765b00] hover:bg-[#594400] text-white font-bold py-2 rounded-xl transition-all"
                  onClick={handleCreateGroup}
                  disabled={!projectName}
                >
                  Create Group
                </button>
                <button
                  className="flex-1 bg-[#efeeeb] hover:bg-[#e3e2e0] text-[#4d4636] font-bold py-2 rounded-xl transition-all"
                  onClick={() => setShowGroupModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Student Directory</h1>
            <p className="mt-1 text-sm text-[#7f7664]">Connect with fellow students and form your project groups.</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f7664]" size={18} strokeWidth={2} />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 rounded-2xl border border-transparent bg-white py-3 pl-11 pr-4 text-sm text-[#4d4636] transition-all focus:outline-none focus:ring-2 focus:ring-[#765b00]/20"
              />
            </div>
            <button
              onClick={handleFilterClick}
              className={`p-3 rounded-2xl transition-all flex items-center justify-center ${
                sortOrder !== 'none'
                  ? 'bg-[#ffd464]/30 text-[#765b00] hover:bg-[#ffd464]/50'
                  : 'bg-[#f4f3f1] text-[#7f7664] hover:bg-[#efeeeb] hover:text-[#4d4636]'
              }`}
              title="Trier par nom (A-Z / Z-A)"
            >
              <Filter size={18} strokeWidth={2} />
              {sortOrder === 'asc' && <span className="ml-1 text-[10px] font-bold">A-Z</span>}
              {sortOrder === 'desc' && <span className="ml-1 text-[10px] font-bold">Z-A</span>}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredStudents.map((student) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group mb-6 flex h-full flex-col rounded-2xl border border-transparent bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition-all hover:border-transparent"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="relative">
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className="h-20 w-20 rounded-[28px] border-4 border-white object-cover shadow-md"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${
                      student.status === 'Available' ? 'bg-green-500' : 'bg-[#765b00]'
                    }`}>
                      {student.status === 'In Group' && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                  </div>
                  <button className="text-[#d1c5b0] hover:text-[#7f7664]">
                    <MoreVertical size={20} />
                  </button>
                </div>

                <h3 className="mb-1 truncate text-xl font-bold text-[#1a1c1a]">{student.name}</h3>
                {student.groupName && (
                  <p className="mb-1 truncate text-sm font-medium text-[#7f7664]">Groupe: {student.groupName}</p>
                )}
                <p className="mb-4 truncate text-sm font-bold text-[#765b00]">{student.role}</p>

                <div className="flex flex-wrap gap-2 mb-8">
                  {student.skills.map((skill, i) => (
                    <span key={i} className="rounded-lg border border-transparent bg-[#f4f3f1] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-transparent mt-auto">
                  <div className="flex gap-4">
                    <button onClick={() => handleOpenEmailModal(student)} className="text-[#7f7664] hover:text-[#765b00] transition-colors">
                      <Mail size={20} strokeWidth={2} />
                    </button>
                    {student.githubUrl ? (
                      <a href={student.githubUrl} target="_blank" rel="noopener noreferrer" className="text-[#7f7664] hover:text-[#1a1c1a] transition-colors">
                        <Github size={20} strokeWidth={2} />
                      </a>
                    ) : (
                      <button disabled className="text-[#d1c5b0] cursor-not-allowed" title="Pas de lien GitHub">
                        <Github size={20} strokeWidth={2} />
                      </button>
                    )}
                    {student.linkedinUrl ? (
                      <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#7f7664] hover:text-blue-600 transition-colors">
                        <Linkedin size={20} strokeWidth={2} />
                      </a>
                    ) : (
                      <button disabled className="text-[#d1c5b0] cursor-not-allowed" title="Pas de lien LinkedIn">
                        <Linkedin size={20} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <button
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      student.status === 'Available'
                        ? selected.find(s => s.id === student.id)
                          ? 'bg-[#16A34A] text-white shadow-sm hover:bg-[#15803D]'
                          : 'bg-[#765b00] text-white shadow-sm hover:bg-[#594400]'
                        : 'cursor-not-allowed bg-[#efeeeb] text-[#7f7664]'
                    }`}
                    disabled={student.status !== 'Available'}
                    onClick={() => toggleSelect(student)}
                  >
                    <UserPlus size={14} />
                    {student.status === 'In Group'
                      ? 'In Group'
                      : selected.find(s => s.id === student.id) ? 'Selected' : 'Invite'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {isEmailModalOpen && emailRecipient && currentUser && (
        <EmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          user={{
            nom: emailRecipient.name.split(' ')[1] || '',
            prenom: emailRecipient.name.split(' ')[0] || '',
            email: emailRecipient.email,
          }}
          fromUser={{
            nom: currentUser.name.split(' ')[1] || '',
            prenom: currentUser.name.split(' ')[0] || '',
            email: '', // Not needed on the frontend for sending
          }}
        />
      )}
    </div>
  );
};

export default StudentGroups;
