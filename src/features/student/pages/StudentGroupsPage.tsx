import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderKanban,
  Github,
  Linkedin,
  Mail,
  MoreVertical,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import EmailModal from '../../../shared/components/EmailModal';
import { notifyAdmins } from '../../../lib/notifications';

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
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<{ id: string; titre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<Student | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('utilisateurs')
        .select('nom, prenom')
        .eq('id', user.id)
        .single();

      if (userData) {
        setCurrentUser({ id: user.id, name: `${userData.prenom} ${userData.nom}` });
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
        setProjects(data || []);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const [
          { data: userRows, error: usersError },
          { data: studentRows, error: studentsError },
          { data: projectRows },
        ] = await Promise.all([
          supabase
            .from('utilisateurs')
            .select('id, nom, prenom, email, avatar_url, role')
            .eq('role', 'ETUDIANT'),
          supabase
            .from('etudiants')
            .select('id, projet_id, filiere, github_url, linkedin_url'),
          supabase
            .from('projets')
            .select('id, titre'),
        ]);

        if (usersError) throw usersError;
        if (studentsError) throw studentsError;

        const projectMap: Record<string, string> = {};
        projectRows?.forEach((project) => {
          projectMap[project.id] = project.titre;
        });

        const studentMap = new Map<string, any>();
        (studentRows || []).forEach((student: any) => {
          studentMap.set(String(student.id), student);
        });

        const formattedStudents: Student[] = (userRows || []).map((user: any) => {
          const student = studentMap.get(String(user.id));
          const firstName = user.prenom || '';
          const lastName = user.nom || '';
          const displayName = `${firstName} ${lastName}`.trim() || user.email || user.id;
          const avatarName = encodeURIComponent(displayName);
          const avatarUrl = user.avatar_url
            ? user.avatar_url
            : `https://ui-avatars.com/api/?name=${avatarName}&background=random`;

          return {
            id: user.id,
            name: displayName,
            role: student?.filiere || 'Etudiant',
            email: user.email || '',
            avatar: avatarUrl,
            status: student?.projet_id ? 'In Group' : 'Available',
            skills: ['React', 'Node.js', 'SQL'],
            groupName: student?.projet_id ? projectMap[student.projet_id] || `Projet #${student.projet_id}` : undefined,
            projet_id: student?.projet_id || null,
            githubUrl: student?.github_url || null,
            linkedinUrl: student?.linkedin_url || null,
          };
        });

        setStudents(formattedStudents);
      } catch (err) {
        console.error('Error loading students:', err);
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

  const filteredStudents = students
    .filter((student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.groupName || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === 'asc') return a.name.localeCompare(b.name);
      if (sortOrder === 'desc') return b.name.localeCompare(a.name);
      return 0;
    });

  const availableCount = students.filter((student) => student.status === 'Available').length;
  const inGroupCount = students.filter((student) => student.status === 'In Group').length;
  const selectedProjectTitle = projects.find((project) => project.id === projectName)?.titre;
  const selectionReady = selected.length > 0;
  const cardsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / cardsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOrder]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleFilterClick = () => {
    if (sortOrder === 'none') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('none');
  };

  const toggleSelect = (student: Student) => {
    if (student.status === 'In Group') return;
    if (selected.find((item) => item.id === student.id)) {
      setSelected(selected.filter((item) => item.id !== student.id));
    } else {
      setSelected([...selected, student]);
    }
  };

  const removeSelected = (id: string) => {
    setSelected(selected.filter((student) => student.id !== id));
  };

  const handleCreateGroup = async () => {
    if (!projectName) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      if (selected.length === 0 && !currentUserId) {
        alert('Selectionnez au moins un etudiant disponible ou reconnectez-vous.');
        return;
      }

      const selectedUnavailable = selected.filter((student) => student.projet_id);
      if (selectedUnavailable.length > 0) {
        alert('Un ou plusieurs etudiants selectionnes sont deja dans un groupe.');
        return;
      }

      if (currentUserId) {
        const { data: meRow } = await supabase
          .from('etudiants')
          .select('id, projet_id')
          .eq('id', currentUserId)
          .single();

        if (meRow?.projet_id) {
          alert('Vous etes deja affecte a un projet. Un etudiant ne peut appartenir qu a un seul projet.');
          return;
        }
      }

      const projectId = projectName;
      const selectedProject = projects.find((project) => project.id === projectId);
      const studentIdsToUpdate = selected.map((student) => student.id);

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
        console.warn('Not all students could be updated. Some might have been assignéd to a project just now.');
      }

      setStudents((previous) => previous.map((student) =>
        studentIdsToUpdate.includes(student.id)
          ? { ...student, status: 'In Group', groupName: selectedProject?.titre, projet_id: projectId }
          : student
      ));

      if (currentUserId) {
        await notifyAdmins({
          senderId: currentUserId,
          projectId,
          title: 'New Group Formed',
          message: `A group of students has formed for the project "${selectedProject?.titre || 'Inconnu'}".`,
          type: 'GROUP_CREATED',
        });
      }

      setShowGroupModal(false);
      setProjectName('');
      setSelected([]);
      alert('Groupe cree avec succes !');
    } catch (error: any) {
      console.error('Erreur lors de la creation du groupe:', error);
      alert(`Une erreur s'est produite: ${error?.message || error?.details || JSON.stringify(error)}`);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      {showGroupModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#111827]/45 p-3 backdrop-blur-sm transition-all animate-in fade-in duration-300 sm:items-center sm:p-4">
          <div className="my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] flex-col overflow-y-auto rounded-2xl border border-[#DCEBFA] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.22)] sm:my-4">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#EEF3F8] bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">Création du groupe</p>
                <h2 className="mt-1 text-xl font-bold text-[#1a1c1a]">Choisir un projet</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#64748B] transition hover:bg-[#DCEBFA] hover:text-[#172D49]"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="mb-5 rounded-2xl border border-[#E5EDF5] bg-[#F3F7FB] p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">Membres sélectionnés</p>
                <div className="flex flex-wrap gap-2">
                  {selected.map((student) => (
                    <span key={student.id} className="rounded-xl border border-[#E5EDF5] bg-white px-3 py-1.5 text-xs font-bold text-[#172D49] shadow-sm">
                      {student.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative text-left">
                <label className="mb-2 ml-1 block text-sm font-extrabold text-[#334155]">Projet</label>
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#C8D6E5] bg-white px-4 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-[#1E3A5F]/10"
                >
                  <span className={`truncate ${!projectName ? 'text-[#9AA6B8]' : 'text-[#1a1c1a]'}`}>
                    {projectName ? selectedProjectTitle : 'Sélectionner un projet'}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProjectDropdown && (
                  <div className="mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#C8D6E5] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition-all animate-in fade-in slide-in-from-top-1">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setProjectName(project.id);
                          setShowProjectDropdown(false);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                          projectName === project.id ? 'bg-[#1E3A5F] text-white' : 'text-[#1a1c1a] hover:bg-[#EEF3F8]'
                        }`}
                      >
                        <span className="truncate">{project.titre}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-[#EEF3F8] bg-white px-5 py-4 sm:px-6">
              <button
                className="h-11 flex-1 rounded-xl bg-[#1E3A5F] text-sm font-bold text-white transition-all hover:bg-[#172D49] disabled:cursor-not-allowed disabled:bg-[#BFD7EF]"
                onClick={handleCreateGroup}
                disabled={!projectName}
                type="button"
              >
                Créer le groupe
              </button>
              <button
                className="h-11 flex-1 rounded-xl bg-[#E5EDF5] text-sm font-bold text-[#334155] transition-all hover:bg-[#D5E1ED]"
                onClick={() => setShowGroupModal(false)}
                type="button"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <header className="mb-4 flex flex-shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Groupes etudiants</h1>
            <span className="rounded-full bg-[#DCEBFA] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1E3A5F]">
              {filteredStudents.length} profils
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">Trouvez des partenaires, consultez leurs profils et composez votre equipe projet.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80 xl:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} strokeWidth={2} />
            <input
              type="text"
              placeholder="Rechercher un etudiant..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#C8D6E5]/70 bg-white py-3 pl-11 pr-4 text-sm text-[#334155] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
            />
          </div>
          <button
            onClick={handleFilterClick}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition-all ${
              sortOrder !== 'none'
                ? 'bg-[#DCEBFA] text-[#1E3A5F] hover:bg-[#C8D6E5]'
                : 'bg-white text-[#64748B] hover:bg-[#EEF3F8] hover:text-[#334155]'
            }`}
            title="Trier par nom"
            type="button"
          >
            <Filter size={18} strokeWidth={2} />
            {sortOrder === 'asc' && <span className="text-[10px] font-bold">A-Z</span>}
            {sortOrder === 'desc' && <span className="text-[10px] font-bold">Z-A</span>}
          </button>
        </div>
      </header>

      <div className="mb-4 grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Etudiants disponibles" value={availableCount} icon={<UserCheck size={22} />} tone="green" />
        <StatCard title="Deja en groupe" value={inGroupCount} icon={<Users size={22} />} tone="blue" />
        <StatCard title="Selection actuelle" value={selected.length} icon={<FolderKanban size={22} />} tone="amber" />
      </div>

      {selectionReady && (
        <div className="mb-4 flex shrink-0 flex-col gap-3 rounded-2xl border border-[#C8D6E5]/60 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#DCEBFA] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1E3A5F]">
              {selected.length} selectionne{selected.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {selected.map((student) => (
              <div key={student.id} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#F8FAFC] px-2.5 py-2">
                <img src={student.avatar} alt={student.name} className="h-8 w-8 rounded-lg object-cover" />
                <span className="max-w-40 truncate text-xs font-bold text-[#1a1c1a]">{student.name}</span>
                <button
                  onClick={() => removeSelected(student.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#FFE4E0] hover:text-[#ba1a1a]"
                  type="button"
                  aria-label={`Retirer ${student.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#172D49]"
            onClick={() => setShowGroupModal(true)}
            type="button"
          >
            <FolderKanban size={16} />
            Creer un groupe
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#C8D6E5]/60 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
            {sortOrder !== 'none' && (
              <span className="hidden rounded-full bg-[#EEF3F8] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B] sm:inline-flex">
                Tri {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </span>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col pr-1">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-sm font-medium text-[#64748B]">
                Chargement des etudiants...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#F8FAFC] text-center">
                <Search className="mb-3 text-[#C8D6E5]" size={28} />
                <p className="text-sm font-bold text-[#334155]">Aucun etudiant trouve</p>
                <p className="mt-1 text-xs text-[#64748B]">Essayez un autre nom ou une autre filiere.</p>
              </div>
            ) : (
              <>
              <div
                className="min-h-0 flex-1 overflow-y-auto pr-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#C8D6E5 transparent' }}
              >
              <div className="grid grid-cols-1 gap-4 pb-3 md:grid-cols-2 xl:grid-cols-3">
                {paginatedStudents.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selected={Boolean(selected.find((item) => item.id === student.id))}
                    onToggle={() => toggleSelect(student)}
                    onEmail={() => handleOpenEmailModal(student)}
                  />
                ))}
              </div>
              </div>
              <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-[#EEF3F8] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-[#64748B]">
                  Affichage {(currentPage - 1) * cardsPerPage + 1}-{Math.min(currentPage * cardsPerPage, filteredStudents.length)} sur {filteredStudents.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCEBFA] bg-white text-[#64748B] transition hover:bg-[#EEF3F8] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Page precedente"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-xs font-bold transition ${
                        currentPage === page
                          ? 'bg-[#1E3A5F] text-white shadow-sm'
                          : 'border border-[#DCEBFA] bg-white text-[#64748B] hover:bg-[#EEF3F8]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCEBFA] bg-white text-[#64748B] transition hover:bg-[#EEF3F8] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Page suivante"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        </section>
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
            email: '',
          }}
        />
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: 'green' | 'blue' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, tone }) => {
  const toneClass = {
    green: 'bg-[#DCFCE7] text-[#16A34A]',
    blue: 'bg-[#DCEBFA] text-[#1E3A5F]',
    amber: 'bg-[#FFF4CC] text-[#B45309]',
  }[tone];

  return (
    <div className="rounded-2xl border border-[#C8D6E5]/60 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[#64748B]">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#1a1c1a]">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

interface StudentCardProps {
  student: Student;
  selected: boolean;
  onToggle: () => void;
  onEmail: () => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, selected, onToggle, onEmail }) => {
  const isAvailable = student.status === 'Available';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex min-h-[260px] flex-col rounded-2xl border bg-[#F8FAFC] p-4 transition-all ${
        selected
          ? 'border-[#16A34A]/40 shadow-[0_8px_24px_rgba(22,163,74,0.12)]'
          : 'border-[#EEF3F8] shadow-sm hover:border-[#BFD7EF]'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <img src={student.avatar} alt={student.name} className="h-14 w-14 rounded-2xl object-cover shadow-sm ring-1 ring-[#C8D6E5]" />
            <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full shadow-sm ring-2 ring-white ${
              isAvailable ? 'bg-[#16A34A]' : 'bg-[#1E3A5F]'
            }`}>
              {isAvailable ? <Sparkles size={10} className="text-white" /> : <CheckCircle2 size={10} className="text-white" />}
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-[#1a1c1a]">{student.name}</h3>
            <p className="mt-0.5 truncate text-xs font-bold text-[#1E3A5F]">{student.role}</p>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-xl text-[#C8D6E5] transition hover:bg-white hover:text-[#64748B]" type="button">
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
          isAvailable ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#DCEBFA] text-[#1E3A5F]'
        }`}>
          {isAvailable ? 'Disponible' : 'En groupe'}
        </span>
        {student.groupName && (
          <span className="max-w-full truncate rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
            {student.groupName}
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {student.skills.map((skill) => (
          <span key={skill} className="rounded-lg border border-[#E5EDF5] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#E5EDF5] pt-4">
        <div className="flex gap-2">
          <button
            onClick={onEmail}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#64748B] transition-colors hover:text-[#1E3A5F]"
            type="button"
            title="Envoyer un email"
          >
            <Mail size={17} strokeWidth={2} />
          </button>
          {student.githubUrl ? (
            <a href={student.githubUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#64748B] transition-colors hover:text-[#1a1c1a]" title="GitHub">
              <Github size={17} strokeWidth={2} />
            </a>
          ) : (
            <button disabled className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl bg-white text-[#C8D6E5]" title="Pas de lien GitHub">
              <Github size={17} strokeWidth={2} />
            </button>
          )}
          {student.linkedinUrl ? (
            <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#64748B] transition-colors hover:text-blue-600" title="LinkedIn">
              <Linkedin size={17} strokeWidth={2} />
            </a>
          ) : (
            <button disabled className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl bg-white text-[#C8D6E5]" title="Pas de lien LinkedIn">
              <Linkedin size={17} strokeWidth={2} />
            </button>
          )}
        </div>

        <button
          className={`flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-all ${
            isAvailable
              ? selected
                ? 'bg-[#16A34A] text-white shadow-sm hover:bg-[#15803D]'
                : 'bg-[#1E3A5F] text-white shadow-sm hover:bg-[#172D49]'
              : 'cursor-not-allowed bg-[#E5EDF5] text-[#64748B]'
          }`}
          disabled={!isAvailable}
          onClick={onToggle}
          type="button"
        >
          <UserPlus size={14} />
          {isAvailable ? (selected ? 'Selectionne' : 'Inviter') : 'Occupe'}
        </button>
      </div>
    </motion.div>
  );
};

export default StudentGroups;



