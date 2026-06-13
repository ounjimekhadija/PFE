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
          const fullName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : `Student ${row.id}`;
          const project = (projectDetails || []).find(p => p.id === row.projet_id);

          return {
            id: row.id,
            name: fullName || 'Student',
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
        console.error('Error loading members:', error);
        setLoadError(error instanceof Error ? error.message : 'Unknown error loading members.');
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-4 text-[#1a1c1a] sm:px-6 lg:px-8"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      {/* Header — fixe, ne scroll pas */}
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membres des groupes</h1>
          <p className="mt-1 text-sm text-[#64748B]">Consultez les profils des etudiants rattaches a vos projets.</p>
        </div>
      </header>

      {loading && <p className="mb-6 shrink-0 text-sm text-[#64748B]">Chargement des membres...</p>}
      {!loading && loadError && <p className="mb-6 shrink-0 text-sm text-[#ba1a1a]">Erreur de chargement : {loadError}</p>}
      {!loading && members.length === 0 && (
        <p className="mb-6 shrink-0 text-sm text-[#64748B]">Aucun membre trouve pour vos groupes.</p>
      )}

      {/* Liste scrollable */}
      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] sm:p-6"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#C8D6E5 transparent' }}
      >
        <div className="space-y-8 pb-2">
          {projects.map(project => (
            <div key={project.id}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="truncate text-lg font-bold">{project.titre}</h2>
                <span className="rounded-full bg-[#DCEBFA] px-3 py-1 text-xs font-bold text-[#1E3A5F]">
                  {members.filter(member => member.projectName === project.titre).length} profils
                </span>
              </div>
              <div className="grid grid-cols-1 justify-center gap-4 md:grid-cols-2 xl:grid-cols-3">
                {members
                  .filter(member => member.projectName === project.titre)
                  .map((member) => (
                    <motion.div
                      key={member.id}
                      whileHover={{ y: -4 }}
                      className="group relative overflow-hidden rounded-2xl border border-[#E5EDF5] bg-[#F8FAFC] p-5 shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition hover:border-[#BFD7EF]"
                    >
                      <div className="relative flex flex-col">
                        <div className="mb-6 flex items-center gap-4 pr-8">
                          <div className="relative flex-shrink-0">
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="h-20 w-20 rounded-3xl object-cover shadow-lg ring-1 ring-[#C8D6E5]"
                            />
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#22C55E] shadow-sm ring-2 ring-[#EEF3F8]"></div>
                          </div>

                          <div className="min-w-0">
                            <h3 className="mb-1 truncate text-lg font-bold text-[#1a1c1a]">{member.name}</h3>
                            <p className="text-xs font-medium uppercase tracking-wider text-[#1E3A5F]">Etudiant</p>
                          </div>
                        </div>

                        <div className="w-full space-y-3 mb-8">
                          <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-[#EEF3F8] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#BFD7EF] shadow-sm">
                            <div className="rounded-lg bg-[#DCEBFA] p-2 text-[#172D49]">
                              <Mail size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-[#64748B]">Email</p>
                              <p className="truncate text-xs text-[#334155]">{member.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-[#EEF3F8] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#C8D6E5] shadow-sm">
                            <div className="rounded-lg bg-[#E5EDF5] p-2 text-[#1E3A5F]">
                              <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-[#64748B]">Phone</p>
                              <p className="text-xs text-[#334155]">{member.phone}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-transparent bg-[#EEF3F8] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#BFD7EF] shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <GraduationCap size={14} className="text-[#1E3A5F]" />
                                <p className="text-[10px] font-bold uppercase text-[#64748B]">CNE</p>
                              </div>
                              <p className="text-xs font-mono text-[#334155]">{member.cne}</p>
                            </div>
                            <div className="rounded-2xl border border-transparent bg-[#EEF3F8] dark:bg-[#2a2927] p-3 transition-colors group-hover:border-[#C8D6E5] shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <CreditCard size={14} className="text-[#ba1a1a]" />
                                <p className="text-[10px] font-bold uppercase text-[#64748B]">CIN</p>
                              </div>
                              <p className="text-xs font-mono text-[#334155]">{member.cin}</p>
                            </div>
                          </div>
                        </div>

                        <div className="w-full flex justify-center gap-4">
                          <a
                            href={normalizeExternalUrl(member.linkedin)}
                            target="_blank"
                            rel="noreferrer"
                            title="LinkedIn"
                            aria-label={`${member.name} LinkedIn`}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent dark:border-[#3a3836] bg-[#EEF3F8] dark:bg-[#2a2927] transition-all hover:bg-white dark:hover:bg-[#333231] shadow-sm"
                          >
                            <Linkedin size={18} className="text-[#0A66C2]" />
                          </a>
                          <a
                            href={normalizeExternalUrl(member.github)}
                            target="_blank"
                            rel="noreferrer"
                            title="GitHub"
                            aria-label={`${member.name} GitHub`}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent dark:border-[#3a3836] bg-[#EEF3F8] dark:bg-[#2a2927] transition-all hover:bg-white dark:hover:bg-[#333231] shadow-sm"
                          >
                            <Github size={18} className="text-[#334155]" />
                          </a>
                        </div>
                      </div>

                      <button className="absolute right-6 top-6 text-[#64748B] transition-colors hover:text-[#334155]">
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
