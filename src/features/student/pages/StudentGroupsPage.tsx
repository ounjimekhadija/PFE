import React, { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Mail, Github, Linkedin, MoreVertical, Filter, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

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
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

  // Fetch tous les étudiants disponibles depuis Supabase
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('etudiants')
          .select(`
            id, 
            projet_id,
            filiere,
            github_url,
            linkedin_url,
            utilisateurs (
              nom, 
              prenom, 
              email
            )
          `);

        if (error) throw error;

        // Récupérer la liste des projets pour connaître les noms de groupes assignés
        const { data: projects } = await supabase.from('projets').select('id, titre');
        const projectMap: Record<string, string> = {};
        projects?.forEach(p => projectMap[p.id] = p.titre);

        if (data) {
          const formattedStudents: Student[] = data.map((student: any) => ({
            id: student.id,
            name: student.utilisateurs ? `${student.utilisateurs.prenom} ${student.utilisateurs.nom}` : student.id,
            role: student.filiere || 'Étudiant',
            email: student.utilisateurs?.email || '',
            avatar: `https://ui-avatars.com/api/?name=${student.utilisateurs?.prenom}+${student.utilisateurs?.nom}&background=random`,
            status: student.projet_id ? 'In Group' : 'Available',
            skills: ['React', 'Node.js', 'SQL'], // Les skills sont statiques pour le moment
            groupName: student.projet_id ? projectMap[student.projet_id] || `Projet #${student.projet_id}` : undefined,
            projet_id: student.projet_id,
            githubUrl: student.github_url,
            linkedinUrl: student.linkedin_url
          }));
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

  let filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (sortOrder === 'asc') {
    filteredStudents.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOrder === 'desc') {
    filteredStudents.sort((a, b) => b.name.localeCompare(a.name));
  }

  const handleFilterClick = () => {
    if (sortOrder === 'none') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('none');
  };

  // Ajoute ou retire un étudiant de la sélection
  const toggleSelect = (student: Student) => {
    if (student.status === 'In Group') return;

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
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        if (selected.length === 0) {
          alert('Sélectionnez au moins un étudiant disponible.');
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
            alert('Vous êtes déjà assigné à un projet. Un étudiant ne peut appartenir qu’à un seul projet.');
            return;
          }
        }

        // 1. Créer le projet dans la base de données
        const dateDebut = new Date().toISOString().split('T')[0];
        const deadlineDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const deadlineGlobale = deadlineDate.toISOString().split('T')[0];

        const { data: newProject, error: projectError } = await supabase
          .from('projets')
          .insert({
            titre: `Projet - ${groupName.trim()}`,
            nom_groupe: groupName.trim(),
            description: "Nouveau groupe créé par un étudiant",
            date_debut: dateDebut,
            deadline_globale: deadlineGlobale,
            statut: 'EN_ATTENTE'
          })
          .select()
          .single();

        if (projectError) throw projectError;
        
        const projectId = newProject.id;
        
        // 2. Mettre à jour les id des étudiants avec l'ID du projet créé
        const studentIdsToUpdate = selected.map(s => s.id);
        if (currentUserId && !studentIdsToUpdate.includes(currentUserId)) {
          studentIdsToUpdate.push(currentUserId);
        }
        
        const { data: updatedRows, error: studentUpdateError } = await supabase
          .from('etudiants')
          .update({ projet_id: projectId })
          .select('id')
          .is('projet_id', null)
          .in('id', studentIdsToUpdate);
          
        if (studentUpdateError) throw studentUpdateError;

        if ((updatedRows || []).length !== studentIdsToUpdate.length) {
          throw new Error('Certains étudiants sont déjà assignés à un projet. Opération annulée.');
        }
  
        // 3. Mettre à jour l'interface locale
        setStudents(prev => prev.map(s =>
          studentIdsToUpdate.includes(s.id)
            ? { ...s, status: 'In Group', groupName: groupName.trim(), projet_id: projectId }
            : s
        ));
        
        setShowGroupModal(false);
        setGroupName('');
      setSelected([]);
      alert("Groupe créé avec succès !");

} catch (error: any) {
        console.error('Erreur lors de la création du projet et liaison des étudiants:', error);
        alert(`Une erreur s'est produite: ${error?.message || error?.details || JSON.stringify(error)}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFF] p-6 md:p-8 text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="relative flex h-full w-full flex-col">
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
      <header className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Student Directory</h1>
          <p className="mt-1 text-sm text-[#64748B]">Connect with fellow students and form your project groups.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} strokeWidth={2} />
            <input 
              type="text" 
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 rounded-2xl border border-[#E2E8F0] bg-white py-3 pl-11 pr-4 text-sm text-[#334155] transition-all focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>
          <button 
            onClick={handleFilterClick}
            className={`p-3 rounded-2xl transition-all flex items-center justify-center ${
              sortOrder !== 'none' 
                ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' 
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="Trier par nom (A-Z / Z-A)"
          >
            <Filter size={18} strokeWidth={2} />
            {sortOrder === 'asc' && <span className="ml-1 text-[10px] font-bold">A-Z</span>}
            {sortOrder === 'desc' && <span className="ml-1 text-[10px] font-bold">Z-A</span>}
          </button>
          {/* Bouton 'Create Group' supprimé */}
        </div>
      </header>

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <motion.div 
              key={student.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group mb-6 flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all hover:border-[#C7D2FE]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="relative">
                  <img 
                    src={student.avatar} 
                    alt={student.name} 
                    className="h-20 w-20 rounded-[28px] border-4 border-white object-cover shadow-md"
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


              <h3 className="mb-1 truncate text-xl font-bold text-[#0F172A]">{student.name}</h3>
              {student.groupName && (
                <p className="mb-1 truncate text-sm font-medium text-[#64748B]">Groupe: {student.groupName}</p>
              )}
              <p className="mb-4 truncate text-sm font-bold text-[#6366F1]">{student.role}</p>

              <div className="flex flex-wrap gap-2 mb-8">
                {student.skills.map((skill, i) => (
                  <span key={i} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFF] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                <div className="flex gap-4">
                  <a href={`mailto:${student.email}`} className="text-gray-400 hover:text-indigo-500 transition-colors">
                    <Mail size={20} strokeWidth={2} />
                  </a>
                  {student.githubUrl ? (
                    <a href={student.githubUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-900 transition-colors">
                      <Github size={20} strokeWidth={2} />
                    </a>
                  ) : (
                    <button disabled className="text-gray-200 cursor-not-allowed" title="Pas de lien GitHub">
                      <Github size={20} strokeWidth={2} />
                    </button>
                  )}
                  {student.linkedinUrl ? (
                    <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Linkedin size={20} strokeWidth={2} />
                    </a>
                  ) : (
                    <button disabled className="text-gray-200 cursor-not-allowed" title="Pas de lien LinkedIn">
                      <Linkedin size={20} strokeWidth={2} />
                    </button>
                  )}
                </div>
                <button
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    student.status === 'Available'
                      ? selected.find(s => s.id === student.id)
                        ? 'bg-[#16A34A] text-white shadow-md shadow-green-600/20 hover:bg-[#15803D]'
                        : 'bg-[#6366F1] text-white shadow-md shadow-indigo-600/20 hover:bg-[#4F46E5]'
                      : 'cursor-not-allowed bg-[#E2E8F0] text-[#64748B]'
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
    </div>
  );
};

export default StudentGroups;
