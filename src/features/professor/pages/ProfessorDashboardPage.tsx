import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

const Dashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('https://ui-avatars.com/api/?name=Professor&background=random');
  const [sessionDateLabel, setSessionDateLabel] = useState<string>('');

  interface MemberCard {
    id: string;
    name: string;
    avatar: string;
  }

  interface ProjectCard {
    id: string;
    title: string;
    category: string;
    progress: number;
    timeLeft: string;
    members: MemberCard[];
    description: string;
    tasks: Task[];
  }

  interface NotificationItem {
    id: string;
    type: 'message' | 'deliverable';
    name: string;
    content: string;
    time: string;
    createdAt: string;
    avatar: string;
  }

  interface Task {
    id: string;
    title: string;
    etat: 'TERMINE' | 'EN_COURS';
  }

  const toDaysLeft = (deadline: string | null): string => {
    if (!deadline) return 'No deadline';
    const end = new Date(deadline).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Late';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return '1 day left';
    if (diffDays < 7) return `${diffDays} days left`;
    const weeks = Math.ceil(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} left`;
  };

  const toShortDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const toSessionLabel = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

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

  const getGroupMembers = (project: ProjectCard | null): MemberCard[] => {
    if (!project) return [];
    return project.members;
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProjects([]);
          setNotifications([]);
          return;
        }

        const { data: userProfile } = await supabase
          .from('utilisateurs')
          .select('avatar_url, nom, prenom')
          .eq('id', user.id)
          .single();

        const displayName = userProfile ? `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || 'Professor' : 'Professor';
        setAvatarUrl(resolveAvatarUrl(userProfile?.avatar_url, displayName));

        const { data: projectRows, error: projectError } = await supabase
          .from('projets')
          .select('id, titre, domaine, description, deadline_globale, created_at')
          .eq('encadrant_id', user.id)
          .order('created_at', { ascending: false });

        if (projectError) throw projectError;

        if (!projectRows || projectRows.length === 0) {
          setProjects([]);
          setNotifications([]);
          return;
        }

        const projectIds = projectRows.map((p: any) => p.id);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const startIso = startOfDay.toISOString();
        const endIso = endOfDay.toISOString();
        setSessionDateLabel(toSessionLabel(startOfDay));

        const [{ data: memberRows }, { data: iterationRows }, { data: messageRows }, { data: deliverableRows }] = await Promise.all([
          supabase
            .from('etudiants')
            .select('id, projet_id, utilisateurs(nom, prenom)')
            .in('projet_id', projectIds),
          supabase
            .from('iterations')
            .select('id, projet_id, statut, date_debut, date_fin')
            .in('projet_id', projectIds)
            .order('date_debut', { ascending: false }),
          supabase
            .from('messages')
            .select('id, contenu, created_at, projet_id, utilisateurs(nom, prenom)')
            .in('projet_id', projectIds)
            .gte('created_at', startIso)
            .lt('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('livrables')
            .select('id, titre, created_at, projet_id')
            .in('projet_id', projectIds)
            .gte('created_at', startIso)
            .lt('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(8),
        ]);

        const membersByProject: Record<string, MemberCard[]> = {};
        (memberRows || []).forEach((row: any) => {
          const u = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;
          const name = u ? `${u.prenom} ${u.nom}` : 'Student';
          if (!membersByProject[row.projet_id]) membersByProject[row.projet_id] = [];
          membersByProject[row.projet_id].push({
            id: row.id,
            name,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          });
        });

        const preferredIterationByProject: Record<string, any> = {};
        (iterationRows || []).forEach((it: any) => {
          if (!preferredIterationByProject[it.projet_id]) {
            preferredIterationByProject[it.projet_id] = it;
          }
          if (it.statut === 'EN_COURS') {
            preferredIterationByProject[it.projet_id] = it;
          }
        });

        const iterationIds = Object.values(preferredIterationByProject).map((it: any) => it.id);
        let taskRows: any[] = [];
        if (iterationIds.length > 0) {
          const { data } = await supabase
            .from('taches')
            .select('id, iteration_id, etat')
            .in('iteration_id', iterationIds);
          taskRows = data || [];
        }

        const tasksByIteration: Record<string, any[]> = {};
        taskRows.forEach((t: any) => {
          if (!tasksByIteration[t.iteration_id]) tasksByIteration[t.iteration_id] = [];
          tasksByIteration[t.iteration_id].push(t);
        });

        const projectCards: ProjectCard[] = projectRows.map((p: any) => {
          const chosenIteration = preferredIterationByProject[p.id];
          const relatedTasks = chosenIteration ? (tasksByIteration[chosenIteration.id] || []) : [];
          const doneTasks = relatedTasks.filter((t: any) => t.etat === 'TERMINE').length;
          const progress = relatedTasks.length > 0 ? Math.round((doneTasks / relatedTasks.length) * 100) : 0;

          return {
            id: p.id,
            title: p.titre,
            category: p.domaine || 'General',
            progress,
            timeLeft: toDaysLeft(p.deadline_globale),
            members: membersByProject[p.id] || [],
            description: p.description || 'Projet supervisé par cet encadrant.',
            tasks: relatedTasks,
          };
        });

        const messageNotifications: NotificationItem[] = (messageRows || []).map((m: any) => {
          const u = Array.isArray(m.utilisateurs) ? m.utilisateurs[0] : m.utilisateurs;
          const name = u ? `${u.prenom} ${u.nom}` : 'Utilisateur';
          return {
            id: `msg-${m.id}`,
            type: 'message',
            name,
            content: m.contenu,
            time: toShortDate(m.created_at),
            createdAt: m.created_at,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          };
        });

        const deliverableNotifications: NotificationItem[] = (deliverableRows || []).map((d: any) => ({
          id: `del-${d.id}`,
          type: 'deliverable',
          name: 'Student',
          content: `a déposé un livrable : ${d.titre}`,
          time: toShortDate(d.created_at),
          createdAt: d.created_at,
          avatar: 'https://ui-avatars.com/api/?name=Student&background=random',
        }));

        const mergedNotifications = [...messageNotifications, ...deliverableNotifications]
          .sort((a, b) => {
            const da = Date.parse(a.createdAt);
            const db = Date.parse(b.createdAt);
            if (Number.isNaN(da) || Number.isNaN(db)) return 0;
            return db - da;
          })
          .slice(0, 8);

        setProjects(projectCards);
        setNotifications(mergedNotifications);
      } catch (err) {
        console.error('Erreur chargement dashboard professeur:', err);
        setProjects([]);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#faf9f6] p-6 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-6 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        <img
          src={avatarUrl}
          alt="Professor"
          className="h-9 w-9 rounded-full border border-[#d1c5b0] object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://ui-avatars.com/api/?name=Professor&background=random';
          }}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-h-0">
          <div className="mb-6 flex h-full min-h-0 flex-col rounded-2xl border border-[#d1c5b0] bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <div className="mb-6 flex shrink-0 items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#1a1c1a]">My Projects</h2>
                <p className="mt-1 text-sm text-[#7f7664]">Projects supervised by your account</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto pr-1 min-h-0">
              {loading && (
                <div className="col-span-full text-sm text-[#7f7664]">Chargement des projets...</div>
              )}
              {!loading && projects.length === 0 && (
                <div className="col-span-full text-sm text-[#7f7664]">Aucun projet lie a cet encadrant.</div>
              )}
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  whileHover={{ y: -2, boxShadow: '0 6px 24px 0 rgba(118,91,0,0.10)' }}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#d1c5b0] bg-[#f4f3f1] p-4 transition-all duration-200 hover:shadow-lg"
                  onClick={() => {
                    setSelectedProject(project);
                    setShowProjectModal(true);
                  }}
                >
                  <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#765b00] to-[#ebc254]"></div>
                  <h3 className="mb-1 text-xl font-bold tracking-tight text-[#1a1c1a]">{project.title}</h3>
                  <p className="mb-5 text-xs font-medium text-[#7f7664]">{project.category}</p>
                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#7f7664]">Progress</span>
                      <span className="font-semibold text-[#1a1c1a]">{project.progress}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#d1c5b0]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-[#765b00] to-[#ebc254]"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {getGroupMembers(project).map((m) => (
                        <img key={m.id} src={m.avatar} className="h-7 w-7 rounded-full border-2 border-white shadow-sm" alt={m.name} />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-[#7f7664]">{project.timeLeft}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {showProjectModal && selectedProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="relative flex min-w-[340px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-[#d1c5b0] bg-white p-0 shadow-2xl md:flex-row">
                  <button className="absolute right-4 top-4 z-10 text-[#7f7664] transition-colors hover:text-[#765b00]" onClick={() => setShowProjectModal(false)}><X size={24} /></button>
                  <div className="w-full border-r border-[#d1c5b0] bg-[#f4f3f1] p-8 md:w-1/2">
                    <div className="mb-4 text-2xl font-bold tracking-tight text-[#1a1c1a]">{selectedProject.title}</div>
                    <div className="mb-2 text-base text-[#4d4636]">{selectedProject.description}</div>
                  </div>
                  <div className="flex w-full flex-col justify-center p-8 md:w-1/2">
                    <div className="flex flex-wrap items-center gap-6">
                      {getGroupMembers(selectedProject).map((m) => (
                        <div key={m.id} className="flex flex-col items-center">
                          <img src={m.avatar} alt={m.name} className="mb-1 h-12 w-12 rounded-full border border-[#d1c5b0] object-cover" />
                          <span className="text-sm font-semibold text-[#765b00]">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex h-full min-h-0 flex-col rounded-2xl border border-[#d1c5b0] bg-white p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="mb-6 flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#1a1c1a]">Notifications</h2>
              {sessionDateLabel && (
                <p className="mt-1 text-xs text-[#7f7664]">Session du {sessionDateLabel}</p>
              )}
            </div>
            <div className="flex gap-4 text-[#7f7664]"></div>
          </div>

          <div className="space-y-4 overflow-y-auto overflow-x-hidden pr-1 min-h-0">
            {loading && <div className="text-sm text-[#7f7664]">Chargement des notifications...</div>}
            {!loading && notifications.length === 0 && <div className="text-sm text-[#7f7664]">Aucune notification recente.</div>}
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                whileHover={{ x: 5 }}
                className="flex w-full max-w-full cursor-pointer gap-4 overflow-hidden rounded-2xl border border-[#d1c5b0] bg-[#f4f3f1] p-4 transition-all duration-300 hover:bg-white"
              >
                <img src={notif.avatar} alt={notif.name} className="h-12 w-12 rounded-full border border-[#d1c5b0] object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-semibold text-[#1a1c1a]">{notif.name}</h4>
                    <span className="text-[10px] text-[#7f7664]">{notif.time}</span>
                  </div>
                  {notif.type === 'deliverable' ? (
                    <p className="flex items-center gap-1 text-xs text-[#166534]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d1c5b0] text-xs font-semibold text-[#4d4636]">
                        {notif.name}
                      </span>
                      <span className="min-w-0 break-words">{notif.content}</span>
                    </p>
                  ) : (
                    <p className="line-clamp-2 break-words text-xs leading-relaxed text-[#7f7664]">{notif.content}</p>
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
