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

  const normalizeExternalUrl = (value: string | null | undefined, platform?: 'github' | 'linkedin'): string => {
    if (!value) return '#';
    const trimmed = value.trim().replace(/^@/, '').replace(/^\/+/, '');
    if (!trimmed) return '#';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (platform === 'github' && !trimmed.includes('.')) return `https://github.com/${trimmed}`;
    if (platform === 'linkedin' && trimmed.startsWith('in/')) return `https://www.linkedin.com/${trimmed}`;
    if (platform === 'linkedin' && !trimmed.includes('.')) return `https://www.linkedin.com/in/${trimmed}`;
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
        setLoadError(error instanceof Error ? error.message : 'Inconnu error loading members.');
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
      <header className="mb-5 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membres des groupes</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Consultez les profils des étudiants rattachés à vos projets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#DCEBFA] bg-white px-3 py-1.5 text-xs font-bold text-[#1E3A5F] shadow-sm">
            {projects.length} projets
          </span>
          <span className="rounded-full border border-[#DCEBFA] bg-[#EAF4FF] px-3 py-1.5 text-xs font-bold text-[#1E3A5F] shadow-sm">
            {members.length} profils
          </span>
        </div>
      </header>

      {loading && (
        <div className="mb-4 shrink-0 rounded-2xl border border-[#DCEBFA] bg-white px-4 py-3 text-sm font-medium text-[#64748B] shadow-sm">
          Chargement des membres...
        </div>
      )}
      {!loading && loadError && (
        <div className="mb-4 shrink-0 rounded-2xl border border-[#F5B8B8] bg-[#FFF1F1] px-4 py-3 text-sm font-medium text-[#ba1a1a]">
          Erreur de chargement : {loadError}
        </div>
      )}
      {!loading && members.length === 0 && (
        <div className="mb-4 shrink-0 rounded-2xl border border-[#DCEBFA] bg-white px-4 py-3 text-sm font-medium text-[#64748B] shadow-sm">
          Aucun membre trouvé pour vos groupes.
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#DCEBFA] bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#C8D6E5 transparent' }}
      >
        <div className="space-y-7 pb-2">
          {projects.map(project => {
            const projectMembers = members.filter(member => member.projectName === project.titre);

            return (
              <section key={project.id} className="border-b border-[#EEF3F8] pb-7 last:border-b-0 last:pb-0">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7B8AA0]">Projet</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-[#1a1c1a]">{project.titre}</h2>
                  </div>
                  <span className="w-fit rounded-full bg-[#DCEBFA] px-3 py-1.5 text-xs font-bold text-[#1E3A5F]">
                    {projectMembers.length} profils
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {projectMembers.map((member) => (
                    <motion.article
                      key={member.id}
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="group relative flex h-full flex-col rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition hover:border-[#BFD7EF] hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                    >
                      <button
                        type="button"
                        aria-label="Plus d'options"
                        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#EEF3F8] hover:text-[#1E3A5F]"
                      >
                        <MoreHorizontal size={20} />
                      </button>

                      <div className="flex items-start gap-4 pr-9">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-visible">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="h-full w-full rounded-2xl object-cover shadow-md ring-1 ring-[#C8D6E5]"
                          />
                          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#22C55E] shadow-sm ring-2 ring-white" />
                        </div>

                        <div className="min-w-0 pt-1">
                          <h3 className="truncate text-lg font-bold text-[#1a1c1a]">{member.name}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1E3A5F]">
                              Étudiant
                            </span>
                            <span className="max-w-[12rem] truncate rounded-full border border-[#E5EDF5] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
                              {member.projectName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        <div className="flex items-center gap-3 rounded-xl bg-[#F3F7FB] p-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#DCEBFA] text-[#172D49]">
                            <Mail size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Email</p>
                            <p className="truncate text-sm font-medium text-[#334155]">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl bg-[#F3F7FB] p-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#E5EDF5] text-[#1E3A5F]">
                            <Phone size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Téléphone</p>
                            <p className="truncate text-sm font-medium text-[#334155]">{member.phone}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="rounded-xl bg-[#F3F7FB] p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <GraduationCap size={14} className="text-[#1E3A5F]" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">CNE</p>
                            </div>
                            <p className="truncate font-mono text-sm text-[#334155]">{member.cne}</p>
                          </div>
                          <div className="rounded-xl bg-[#F3F7FB] p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <CreditCard size={14} className="text-[#ba1a1a]" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">CIN</p>
                            </div>
                            <p className="truncate font-mono text-sm text-[#334155]">{member.cin}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#EEF3F8] pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7B8AA0]">
                          Liens externes
                        </span>
                        <div className="flex gap-2">
                          {member.linkedin ? (
                            <a
                              href={normalizeExternalUrl(member.linkedin, 'linkedin')}
                              target="_blank"
                              rel="noreferrer"
                              title="LinkedIn"
                              aria-label={`${member.name} LinkedIn`}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5EDF5] bg-white transition hover:bg-[#EEF3F8]"
                            >
                              <Linkedin size={17} className="text-[#0A66C2]" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="LinkedIn non renseigné"
                              aria-label={`${member.name} LinkedIn non renseigné`}
                              className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl border border-[#E5EDF5] bg-white opacity-40"
                            >
                              <Linkedin size={17} className="text-[#0A66C2]" />
                            </button>
                          )}
                          {member.github ? (
                            <a
                              href={normalizeExternalUrl(member.github, 'github')}
                              target="_blank"
                              rel="noreferrer"
                              title="GitHub"
                              aria-label={`${member.name} GitHub`}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5EDF5] bg-white transition hover:bg-[#EEF3F8]"
                            >
                              <Github size={17} className="text-[#334155]" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="GitHub non renseigné"
                              aria-label={`${member.name} GitHub non renseigné`}
                              className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl border border-[#E5EDF5] bg-white opacity-40"
                            >
                              <Github size={17} className="text-[#334155]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Members;
