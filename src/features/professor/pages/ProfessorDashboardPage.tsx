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

    // Accept values stored as "avatars/filename.png" or plain "filename.png".
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
    <div className="flex-1 bg-white text-gray-900 p-6 h-full overflow-hidden flex flex-col">
      <header className="flex justify-between items-center mb-6 shrink-0">
        <h1 className="text-3xl font-bold">My Portfolio</h1>
        <img
          src={avatarUrl}
          alt="Professor"
          className="w-8 h-8 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://ui-avatars.com/api/?name=Professor&background=random';
          }}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 min-h-0">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-full flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-semibold">My Projects</h2>
                {/* Ligne supprimée */}
              </div>
              {/* Filtres supprimés */}
            </div>

            {/* Ligne 'Ongoing Projects' supprimée */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto pr-1 min-h-0">
              {loading && (
                <div className="col-span-full text-sm text-gray-500">Chargement des projets...</div>
              )}
              {!loading && projects.length === 0 && (
                <div className="col-span-full text-sm text-gray-500">Aucun projet lié à cet encadrant.</div>
              )}
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  whileHover={{ y: -2, boxShadow: '0 6px 24px 0 rgba(80,80,120,0.10)' }}
                  className="bg-transparent rounded-xl p-4 border border-gray-100 transition-all duration-200 relative overflow-hidden group cursor-pointer hover:shadow-lg"
                  onClick={() => {
                    setSelectedProject(project);
                    setShowProjectModal(true);
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-black to-gray-800"></div>
                  {/* Date supprimée */}
                  <h3 className="text-xl font-bold mb-1 text-gray-800 tracking-tight">{project.title}</h3>
                  <p className="text-xs text-gray-500 mb-5 font-medium">{project.category}</p>
                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 font-medium">Progress</span>
                      <span className="text-gray-700 font-semibold">{project.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-black to-gray-800"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {getGroupMembers(project).map((m) => (
                        <img key={m.id} src={m.avatar} className="w-7 h-7 rounded-full border-2 border-gray-200 shadow-sm" alt={m.name} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{project.timeLeft}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Modal projet : nom projet + membres du groupe */}
            {showProjectModal && selectedProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-gray-50 rounded-3xl p-0 min-w-[340px] max-w-[95vw] shadow-2xl relative border border-gray-200 flex flex-col md:flex-row overflow-hidden">
                  <button className="absolute top-4 right-4 text-gray-300 hover:text-indigo-500 transition-colors z-10" onClick={() => setShowProjectModal(false)}><X size={26} /></button>
                  {/* Colonne gauche : projet (juste nom et description simple) */}
                    <div className="md:w-1/2 w-full bg-gray-100 p-8 flex flex-col justify-center items-start border-r border-gray-200">
                      <div className={`font-extrabold text-2xl tracking-tight mb-4 ${selectedProject.title === 'Web Designing' ? 'text-blue-600' : 'text-gray-700'}`}>{selectedProject.title}</div>
                          <div className="text-gray-600 text-base mb-2">{selectedProject.description}</div>
                  </div>
                  {/* Colonne droite : membres */}
                  <div className="md:w-1/2 w-full p-8 flex flex-col justify-center">
                    {/* plus de titre ici, juste la liste des membres */}
                    <div className="flex gap-6 flex-wrap items-center">
                      {getGroupMembers(selectedProject).map(m => (
                        <div key={m.id} className="flex flex-col items-center">
                          <img src={m.avatar} alt={m.name} className="w-12 h-12 rounded-full object-cover mb-1" />
                          <span className="text-sm font-semibold text-indigo-800 drop-shadow-sm">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-full flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
              {sessionDateLabel && (
                <p className="text-xs text-gray-400 mt-1">Session du {sessionDateLabel}</p>
              )}
            </div>
            <div className="flex gap-4 text-gray-400">
                {/* Icônes search et menu supprimées */}
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto overflow-x-hidden pr-1 min-h-0">
            {/* Exemple de notifications variées */}
            {loading && <div className="text-sm text-gray-500">Chargement des notifications...</div>}
            {!loading && notifications.length === 0 && <div className="text-sm text-gray-500">Aucune notification récente.</div>}
            {notifications.map((notif) => (
              <motion.div 
                key={notif.id}
                whileHover={{ x: 5 }}
                className={`flex gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-gray-50 w-full max-w-full overflow-hidden`}
              >
                <img src={notif.avatar} alt={notif.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold text-sm text-gray-800">{notif.name}</h4>
                    <span className="text-[10px] text-gray-400">{notif.time}</span>
                  </div>
                  {/* Affichage selon le type de notification */}
                  {notif.type === 'deliverable' ? (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <span className="inline-block w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-1">📄</span>
                      <span className="min-w-0 break-words">{notif.name} {notif.content}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed break-words">{notif.content}</p>
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
