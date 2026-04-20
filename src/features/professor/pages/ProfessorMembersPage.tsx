import React, { useEffect, useState } from 'react';
import { Mail, Phone, CreditCard, GraduationCap, Linkedin, Github, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface MemberCard {
  id: string;
  name: string;
  email: string;
  phone: string;
  cne: string;
  cin: string;
  linkedin: string;
  github: string;
  avatar: string;
}

const Members: React.FC = () => {
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resolveAvatarUrl = (value: string | null | undefined, fallbackName: string): string => {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;
    if (!value) return fallback;

    let raw = value.trim();
    if (!raw) return fallback;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    raw = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
    const { data } = supabase.storage.from('avatars').getPublicUrl(raw);
    return data?.publicUrl || fallback;
  };

  const normalizeExternalUrl = (value: string | null | undefined): string => {
    if (!value) return '#';
    const trimmed = value.trim();
    if (!trimmed) return '#';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMembers([]);
          return;
        }

        const { data: directProjectRows, error: directProjectError } = await supabase
          .from('projets')
          .select('id')
          .eq('encadrant_id', user.id);

        if (directProjectError) throw directProjectError;

        const projectIdSet = new Set<string>((directProjectRows || []).map((p: any) => String(p.id)));

        // Fallback: some schemas store projets.encadrant_id as encadrants.id (not auth.users.id).
        if (projectIdSet.size === 0) {
          const encadrantIdCandidates = new Set<string>();

          const { data: encById, error: encByIdError } = await supabase
            .from('encadrants')
            .select('id')
            .eq('id', user.id)
            .limit(1);

          if (!encByIdError && Array.isArray(encById)) {
            encById.forEach((row: any) => {
              if (row?.id) encadrantIdCandidates.add(String(row.id));
            });
          }

          const mappingColumns = ['utilisateur_id', 'user_id', 'auth_user_id'];
          for (const column of mappingColumns) {
            const { data: mappedRows, error: mappedError } = await supabase
              .from('encadrants')
              .select('id')
              .eq(column, user.id)
              .limit(1);

            if (!mappedError && Array.isArray(mappedRows)) {
              mappedRows.forEach((row: any) => {
                if (row?.id) encadrantIdCandidates.add(String(row.id));
              });
            }
          }

          if (encadrantIdCandidates.size > 0) {
            const { data: fallbackProjects, error: fallbackProjectsError } = await supabase
              .from('projets')
              .select('id')
              .in('encadrant_id', Array.from(encadrantIdCandidates));

            if (!fallbackProjectsError && Array.isArray(fallbackProjects)) {
              fallbackProjects.forEach((p: any) => {
                if (p?.id) projectIdSet.add(String(p.id));
              });
            }
          }
        }

        const projectIds = Array.from(projectIdSet);
        if (projectIds.length === 0) {
          setMembers([]);
          return;
        }

        const { data: studentRows, error: studentError } = await supabase
          .from('etudiants')
          .select(`
            id,
            cne,
            cin,
            github_url,
            linkedin_url,
            utilisateurs (
              nom,
              prenom,
              email,
              telephone,
              avatar_url
            )
          `)
          .in('projet_id', projectIds);

        if (studentError) throw studentError;

        const formatted: MemberCard[] = (studentRows || []).map((row: any) => {
          const u = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;
          const fullName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : `Étudiant ${row.id}`;

          return {
            id: row.id,
            name: fullName || 'Étudiant',
            email: u?.email || 'N/A',
            phone: u?.telephone || 'N/A',
            cne: row.cne || 'N/A',
            cin: row.cin || 'N/A',
            linkedin: row.linkedin_url || '',
            github: row.github_url || '',
            avatar: resolveAvatarUrl(u?.avatar_url, fullName || 'Student'),
          };
        });

        setMembers(formatted);
      } catch (error) {
        console.error('Erreur chargement membres:', error);
        setLoadError(error instanceof Error ? error.message : 'Erreur inconnue lors du chargement des membres.');
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  return (
    <div className="flex-1 bg-white text-gray-900 p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-gray-400 mt-2">Manage and view information of all students in the group</p>
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500 mb-6">Chargement des membres...</p>}
      {!loading && loadError && <p className="text-sm text-red-500 mb-6">Erreur de chargement: {loadError}</p>}
      {!loading && members.length === 0 && <p className="text-sm text-gray-500 mb-6">Aucun membre trouvé pour vos groupes.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members.map((member) => (
          <motion.div
            key={member.id}
            whileHover={{ y: -8 }}
            className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-50 to-teal-50"></div>
            
            <div className="relative flex flex-col items-center pt-4">
              <div className="relative mb-4">
                <img 
                  src={member.avatar} 
                  alt={member.name} 
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white"></div>
              </div>
              
              <h3 className="text-xl font-bold mb-1 text-gray-800">{member.name}</h3>
              <p className="text-indigo-600 text-xs font-medium uppercase tracking-wider mb-6">Student Member</p>

              <div className="w-full space-y-3 mb-8">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-indigo-100 transition-colors">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Email</p>
                    <p className="text-xs truncate text-gray-700">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-teal-100 transition-colors">
                  <div className="p-2 bg-teal-500/10 rounded-lg text-teal-600">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Phone</p>
                    <p className="text-xs text-gray-700">{member.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-orange-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap size={14} className="text-orange-500" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">CNE</p>
                    </div>
                    <p className="text-xs font-mono text-gray-700">{member.cne}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-rose-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard size={14} className="text-rose-500" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">CIN</p>
                    </div>
                    <p className="text-xs font-mono text-gray-700">{member.cin}</p>
                  </div>
                </div>
              </div>

              <div className="w-full flex gap-3">
                <a 
                  href={normalizeExternalUrl(member.linkedin)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100"
                >
                  <Linkedin size={16} className="text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">LinkedIn</span>
                </a>
                <a 
                  href={normalizeExternalUrl(member.github)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100"
                >
                  <Github size={16} className="text-gray-700" />
                  <span className="text-xs font-medium text-gray-700">GitHub</span>
                </a>
              </div>
            </div>

            <button className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Members;
