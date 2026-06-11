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
  projectName: string;
}

interface Project {
  id: string;
  titre: string;
}

const Members: React.FC = () => {
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

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
          setProjects([]);
          return;
        }

        const { data: projectDetails, error: projectDetailsError } = await supabase
          .from('projets')
          .select('id, titre')
          .in('id', projectIds);

        if (projectDetailsError) throw projectDetailsError;
        setProjects(projectDetails || []);

        const { data: studentRows, error: studentError } = await supabase
          .from('etudiants')
          .select(`
            id,
            cne,
            cin,
            github_url,
            linkedin_url,
            projet_id,
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
          const project = (projectDetails || []).find(p => p.id === row.projet_id);

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
            projectName: project?.titre || 'N/A',
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
    <div
      className="flex flex-col h-full overflow-hidden bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      {/* Header — fixe, ne scroll pas */}
      <header className="mb-6 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Team Members</h1>
          <p className="mt-2 text-sm text-[#7f7664]">Manage and view all students in your supervised groups</p>
        </div>
      </header>

      {loading && <p className="mb-6 text-sm text-[#7f7664] flex-shrink-0">Chargement des membres...</p>}
      {!loading && loadError && <p className="mb-6 text-sm text-[#ba1a1a] flex-shrink-0">Erreur de chargement: {loadError}</p>}
      {!loading && members.length === 0 && (
        <p className="mb-6 text-sm text-[#7f7664] flex-shrink-0">Aucun membre trouvé pour vos groupes.</p>
      )}

      {/* Liste scrollable */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1c5b0 transparent' }}
      >
        <div className="space-y-8 pb-6">
          {projects.map(project => (
            <div key={project.id}>
              <h2 className="mb-4 text-xl font-semibold">{project.titre}</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                {members
                  .filter(member => member.projectName === project.titre)
                  .map((member) => (
                    <motion.div
                      key={member.id}
                      whileHover={{ y: -8 }}
                      className="group relative overflow-hidden rounded-2xl border border-transparent bg-white dark:bg-[#1e1f1e] p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]"
                    >
                      <div className="absolute left-0 top-0 h-24 w-full bg-gradient-to-br from-[#f4f3f1] to-[#efeeeb] dark:from-[#2a2927] dark:to-[#1e1f1e]"></div>

                      <div className="relative flex flex-col items-center pt-4">
                        <div className="relative mb-4">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-lg"
                          />
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-[#22C55E]"></div>
                        </div>

                        <h3 className="mb-1 text-xl font-bold text-[#1a1c1a]">{member.name}</h3>
                        <p className="mb-6 text-xs font-medium uppercase tracking-wider text-[#765b00]">Student Member</p>

                        <div className="w-full space-y-3 mb-8">
                          <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-[#f4f3f1] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#ebc254] shadow-sm">
                            <div className="rounded-lg bg-[#ffd464] p-2 text-[#594400]">
                              <Mail size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-[#7f7664]">Email</p>
                              <p className="truncate text-xs text-[#4d4636]">{member.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-[#f4f3f1] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#d1c5b0] shadow-sm">
                            <div className="rounded-lg bg-[#efeeeb] p-2 text-[#765b00]">
                              <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-[#7f7664]">Phone</p>
                              <p className="text-xs text-[#4d4636]">{member.phone}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-transparent bg-[#f4f3f1] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#ebc254] shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <GraduationCap size={14} className="text-[#765b00]" />
                                <p className="text-[10px] font-bold uppercase text-[#7f7664]">CNE</p>
                              </div>
                              <p className="text-xs font-mono text-[#4d4636]">{member.cne}</p>
                            </div>
                            <div className="rounded-2xl border border-transparent bg-[#f4f3f1] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#d1c5b0] shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <CreditCard size={14} className="text-[#ba1a1a]" />
                                <p className="text-[10px] font-bold uppercase text-[#7f7664]">CIN</p>
                              </div>
                              <p className="text-xs font-mono text-[#4d4636]">{member.cin}</p>
                            </div>
                          </div>
                        </div>

                        <div className="w-full flex gap-3">
                          <a
                            href={normalizeExternalUrl(member.linkedin)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-transparent dark:border-[#3a3836] bg-[#f4f3f1] dark:bg-[#2a2927] py-3 transition-all hover:bg-white dark:hover:bg-[#333231] shadow-sm"
                          >
                            <Linkedin size={16} className="text-[#0A66C2]" />
                            <span className="text-xs font-medium text-[#4d4636]">LinkedIn</span>
                          </a>
                          <a
                            href={normalizeExternalUrl(member.github)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-transparent dark:border-[#3a3836] bg-[#f4f3f1] dark:bg-[#2a2927] py-3 transition-all hover:bg-white dark:hover:bg-[#333231] shadow-sm"
                          >
                            <Github size={16} className="text-[#4d4636]" />
                            <span className="text-xs font-medium text-[#4d4636]">GitHub</span>
                          </a>
                        </div>
                      </div>

                      <button className="absolute right-6 top-6 text-[#7f7664] transition-colors hover:text-[#4d4636]">
                        <MoreHorizontal size={20} />
                      </button>
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Members;