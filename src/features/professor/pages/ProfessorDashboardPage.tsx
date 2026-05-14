import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

interface ProjectBar {
  id: string;
  name: string;
  timeProgress: number; 
  taskCompletion: number; 
  tasks: {
    completed: number;
    inProgress: number;
    late: number;
  } | null;
  recentCompleted: any[];
}

interface Member {
  id: string;
  name: string;
  avatar: string;
}

interface IterationEvent {
  id: string;
  label: string;
  description: string;
  date: string;
  statut: string;
}

const resolveAvatar = (v: string | null | undefined, name: string) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  if (!v) return fb;
  const raw = v.trim();
  if (!raw) return fb;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
  return data?.publicUrl || fb;
};

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeProjects, setActiveProjects] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [avgDelay, setAvgDelay] = useState(0);
  const [projectBars, setProjectBars] = useState<ProjectBar[]>([]);
  const [iterations, setIterations] = useState<IterationEvent[]>([]);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: projects } = await supabase
          .from('projets')
          .select('id, titre, deadline_globale')
          .eq('encadrant_id', user.id);

        if (!projects || projects.length === 0) { setLoading(false); return; }

        const projectIds = projects.map((p: any) => p.id);
        setActiveProjects(projects.length);

        const [
          { data: students },
          { data: iters },
          { data: msgs },
        ] = await Promise.all([
          supabase.from('etudiants').select('id, projet_id, utilisateurs(nom, prenom, avatar_url)').in('projet_id', projectIds),
          supabase.from('iterations').select('id, projet_id, statut, date_debut, date_fin').in('projet_id', projectIds).order('date_debut', { ascending: true }),
          supabase.from('messages').select('id').in('projet_id', projectIds).neq('auteur_id', user.id),
        ]);

        setTotalStudents(students?.length || 0);
        setUnreadMsgs(msgs?.length || 0);

        const memberList: Member[] = (students || []).slice(0, 4).map((s: any) => {
          const u = Array.isArray(s.utilisateurs) ? s.utilisateurs[0] : s.utilisateurs;
          const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Etudiant';
          return { id: s.id, name, avatar: resolveAvatar(u?.avatar_url, name) };
        });
        setRecentMembers(memberList);

        const now = new Date().toISOString();
        const timelineIters = (iters || [])
          .filter((it: any) => it.date_fin >= now || it.statut === 'EN_COURS')
          .slice(0, 4);
        setIterations(timelineIters.map((it: any) => ({
          id: it.id,
          label: it.statut === 'EN_COURS' ? 'Sprint en cours' : it.statut === 'VALIDE' ? 'Sprint validé' : 'À faire',
          description: `Du ${new Date(it.date_debut).toLocaleDateString('fr-FR')} au ${new Date(it.date_fin).toLocaleDateString('fr-FR')}`,
          date: it.date_debut,
          statut: it.statut,
        })));

        const iterIds = (iters || []).map((it: any) => it.id);
        let tasks: any[] = [];
        if (iterIds.length > 0) {
          const { data: taskData } = await supabase.from('taches').select('id, iteration_id, etat, titre, created_at').in('iteration_id', iterIds);
          tasks = taskData || [];
        }

        const total = tasks.length;
        const done = tasks.filter((t: any) => t.etat === 'TERMINE').length;
        setCompletionRate(total > 0 ? Math.round((done / total) * 100) : 0);

        const iterByProject: Record<string, string[]> = {};
        (iters || []).forEach((it: any) => {
          if (!iterByProject[it.projet_id]) iterByProject[it.projet_id] = [];
          iterByProject[it.projet_id].push(it.id);
        });

        setProjectBars(projects.map((p: any) => {
          const ids = iterByProject[p.id] || [];
          const pTasks = tasks.filter((t: any) => ids.includes(t.iteration_id));
          const pDone = pTasks.filter((t: any) => t.etat === 'TERMINE').length;
          const taskCompletion = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;

          const projectIters = (iters || []).filter((it: any) => it.projet_id === p.id && it.date_debut);
          let timeProgress = 0;
          if (p.deadline_globale && projectIters.length > 0) {
            const startDates = projectIters.map((it: any) => new Date(it.date_debut).getTime()).filter((n: number) => !Number.isNaN(n));
            const startMs = Math.min(...startDates);
            const deadlineMs = new Date(p.deadline_globale).getTime();
            const nowMs = Date.now();
            if (!Number.isNaN(startMs) && !Number.isNaN(deadlineMs) && deadlineMs > startMs) {
              timeProgress = Math.round(((nowMs - startMs) / (deadlineMs - startMs)) * 100);
              if (timeProgress < 0) timeProgress = 0;
              if (timeProgress > 100) timeProgress = 100;
            }
          }

          const currentIter = (iters || []).find((it: any) => it.projet_id === p.id && it.statut === 'EN_COURS');
          let iterTasks: { completed: number; inProgress: number; late: number } | null = null;
          if (currentIter) {
            const currentIterTasks = tasks.filter((t: any) => t.iteration_id === currentIter.id);
            const deadline = new Date(currentIter.date_fin);
            iterTasks = {
              completed: currentIterTasks.filter((t: any) => t.etat === 'TERMINE').length,
              inProgress: currentIterTasks.filter((t: any) => t.etat === 'EN_COURS' || t.etat === 'A_FAIRE').length,
              late: currentIterTasks.filter((t: any) => t.etat !== 'TERMINE' && new Date() > deadline).length,
            };
          }

          const pRecentDone = pTasks
            .filter((t: any) => t.etat === 'TERMINE')
            .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
            .slice(0, 3);

          return {
            id: p.id,
            name: p.titre || 'Projet',
            timeProgress,
            taskCompletion,
            tasks: iterTasks,
            recentCompleted: pRecentDone,
          };
        }));

        const nowMs = Date.now();
        const late = (projects || []).filter((p: any) => p.deadline_globale && new Date(p.deadline_globale).getTime() < nowMs);
        if (late.length > 0) {
          const avg = late.reduce((s: number, p: any) => s + Math.ceil((nowMs - new Date(p.deadline_globale).getTime()) / 86400000), 0) / late.length;
          setAvgDelay(Math.round(avg * 10) / 10);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const allRecentCompleted = projectBars
    .flatMap(p => p.recentCompleted.map(t => ({ ...t, projectName: p.name })))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 10);

  const exportReport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Dashboard Report', new Date().toLocaleDateString('fr-FR')],
      [],
      ['Metric', 'Value'],
      ['Total Students',   totalStudents],
      ['Active Projects',  activeProjects],
      ['Completion Rate',  `${completionRate}%`],
      ['Avg. Delay',       avgDelay > 0 ? `${avgDelay} days late` : 'On time'],
    ]), 'Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Project', 'Task Completion (%)', 'Time Progress (%)', 'Done', 'In Progress', 'Late'],
      ...projectBars.map(p => [
        p.name,
        p.taskCompletion,
        p.timeProgress,
        p.tasks?.completed ?? '—',
        p.tasks?.inProgress ?? '—',
        p.tasks?.late ?? '—',
      ]),
    ]), 'Projects');

    XLSX.writeFile(wb, `dashboard_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (completionRate / 100) * circ;

  const stats = [
    { label: 'TOTAL STUDENTS', value: totalStudents, badge: `${totalStudents > 0 ? '+' : ''}${totalStudents}`, badgeGreen: true, icon: '🎓' },
    { label: 'ACTIVE PROJECTS', value: activeProjects, badge: 'Steady', badgeGreen: false, icon: '🚀' },
    { label: 'COMPLETION RATE', value: `${completionRate}%`, badge: `${completionRate}%`, badgeGreen: true, icon: '✅' },
    { label: 'AVG. DELAY', value: `${avgDelay} Days`, badge: avgDelay > 0 ? `+${avgDelay}d` : 'On time', badgeGreen: avgDelay === 0, icon: '⏱' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#faf9f6] px-5 py-4" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1c1a]">Platform Overview</h1>
          <p className="text-xs text-[#7f7664]">Real-time performance metrics and team activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport} className="flex items-center gap-1.5 rounded-xl bg-[#ffd464] px-3 py-1.5 text-xs font-semibold text-[#594400] transition hover:bg-[#ebc254]">
            <Download size={13} /> Export Report
          </button>
        </div>
      </header>

      <div className="mb-3 grid shrink-0 grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xl">{s.icon}</span>
              <span className={`text-[11px] font-bold ${s.badgeGreen ? 'text-green-500' : 'text-[#f59e0b]'}`}>{s.badge}</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-[#1a1c1a]">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 grid min-h-0 flex-1 grid-cols-3 gap-3">
        <div className="col-span-2 flex min-h-0 flex-col rounded-2xl border border-transparent bg-white px-5 py-4 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
          <div className="mb-2 flex shrink-0 items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4d4636]">Project Distribution</p>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#22c55e]"/>≥75% done</span>
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#ffd464]"/>40–74%</span>
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#765b00]"/>&lt;40%</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-2">
            {loading ? (
              <p className="text-sm text-[#7f7664]">Chargement...</p>
            ) : projectBars.length === 0 ? (
              <p className="text-sm text-[#7f7664]">Aucun projet.</p>
            ) : (
              <div className="flex h-full min-h-0 flex-1 gap-8">
                <div className="flex flex-1 flex-col justify-end min-w-0">
                  <div className="flex h-full items-end justify-center gap-10 border-r border-[#f4f3f1] pb-2 pr-8">
                    {projectBars.map((p, i) => {
                      const taskPct = Math.max(p.taskCompletion, 0);
                      const timePct = Math.max(p.timeProgress, 0);
                      const barColors = taskPct >= 75 
                        ? { from: '#22c55e', to: '#16a34a', glow: 'rgba(34,197,94,0.3)' } 
                        : taskPct >= 40 
                        ? { from: '#ffd464', to: '#facc15', glow: 'rgba(255,212,100,0.3)' } 
                        : { from: '#765b00', to: '#594400', glow: 'rgba(118,91,0,0.3)' };

                      return (
                        <div key={i} className="group relative flex h-full w-full max-w-[220px] flex-col items-center justify-end">
                          <div className="mb-2 opacity-0 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 group-hover:opacity-100">
                            <div className="rounded-lg bg-[#1a1c1a] px-3 py-1.5 shadow-lg">
                              <span className="text-xs font-bold text-white whitespace-nowrap">{taskPct}% Complete</span>
                            </div>
                          </div>
                          <div className="relative w-full flex-1 overflow-hidden rounded-3xl border border-[#efeeeb] bg-[#f4f3f1] shadow-inner">
                            {timePct > 0 && (
                              <div className="absolute bottom-0 w-full opacity-10 transition-all duration-1000" style={{ height: `${timePct}%`, background: 'linear-gradient(to top, #1a1c1a, transparent)' }} />
                            )}
                            <div className="absolute bottom-0 w-full transition-all duration-700 ease-out rounded-t-xl"
                              style={{ 
                                height: `${Math.max(taskPct, 6)}%`, 
                                background: `linear-gradient(to top, ${barColors.to}, ${barColors.from})`,
                                boxShadow: `0 -4px 12px ${barColors.glow}, inset 0 2px 4px rgba(255,255,255,0.3)`
                              }}
                            />
                          </div>
                          <div className="mt-3 flex w-full flex-col items-center">
                            <span className="w-full truncate text-center text-[10px] font-bold text-[#1a1c1a]" title={p.name}>{p.name}</span>
                            <div className="mt-0.5 flex items-center gap-1">
                               <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: barColors.from }} />
                               <span className="text-[9px] font-bold text-[#7f7664]">{taskPct}%</span>
                            </div>
                          </div>
                          <div className="absolute bottom-full left-1/2 z-30 mb-4 hidden w-40 -translate-x-1/2 animate-in fade-in zoom-in-95 flex-col rounded-xl border border-[#f4f3f1] bg-white p-3 shadow-2xl duration-200 group-hover:flex">
                             <p className="mb-2 border-b border-[#f4f3f1] pb-1 text-[10px] font-bold text-[#1a1c1a]">{p.name}</p>
                             <div className="space-y-1.5">
                                <div className="flex justify-between text-[9px]"><span className="text-[#7f7664]">Tasks Done</span><span className="font-bold text-green-600">{p.tasks?.completed || 0}</span></div>
                                <div className="flex justify-between text-[9px]"><span className="text-[#7f7664]">In Progress</span><span className="font-bold text-[#ffd464]">{p.tasks?.inProgress || 0}</span></div>
                                {p.tasks && p.tasks.late > 0 && (<div className="flex justify-between text-[9px]"><span className="text-[#7f7664]">Late Tasks</span><span className="font-bold text-red-500">{p.tasks.late}</span></div>)}
                                <div className="mt-2 flex justify-between border-t border-[#f4f3f1] pt-1 text-[9px]"><span className="text-[#7f7664]">Time Spent</span><span className="font-bold text-[#1a1c1a]">{timePct}%</span></div>
                             </div>
                             <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#f4f3f1] bg-white"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex w-72 flex-col min-w-0">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Latest Achievements</p>
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {allRecentCompleted.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f3f1]"><span className="text-lg">🎉</span></div>
                        <p className="text-xs font-medium text-[#7f7664]">No tasks completed yet.</p>
                      </div>
                    ) : (
                      allRecentCompleted.map((task, idx) => (
                        <div key={idx} className="group flex flex-col rounded-xl border border-[#f4f3f1] bg-[#faf9f6] p-3 transition-all hover:border-[#22c55e]/30 hover:bg-white hover:shadow-md">
                          <div className="mb-1.5 flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <p className="line-clamp-2 text-xs font-bold leading-tight text-[#1a1c1a]">{task.titre}</p>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <span className="max-w-[120px] truncate rounded-md bg-[#ffd464]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#765b00]">{task.projectName}</span>
                            <span className="text-[9px] font-medium text-[#7f7664]">Done</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
            <p className="mb-2 self-start text-[10px] font-bold uppercase tracking-widest text-[#4d4636]">Quarterly Progress</p>
            <svg width="110" height="110" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={r} fill="none" stroke="#f4f3f1" strokeWidth="14" />
              <circle
                cx="65" cy="65" r={r}
                fill="none" stroke="#ffd464" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={String(circ)}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <text x="65" y="70" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: '#1a1c1a' }}>
                {loading ? '—' : `${completionRate}%`}
              </text>
            </svg>
            <p className="mt-1 text-[10px] text-[#7f7664]">Overall completion</p>
          </div>

          <div className="shrink-0 rounded-2xl bg-[#1a1c1a] px-4 py-3 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">Chat</p>
            <div className="mb-2 flex -space-x-2">
              {recentMembers.map((m) => (
                <img key={m.id} src={m.avatar} alt={m.name} title={m.name} className="h-7 w-7 rounded-full border-2 border-[#1a1c1a] object-cover" />
              ))}
            </div>
            <p className="mb-3 text-xs font-bold">{unreadMsgs > 0 ? `${unreadMsgs} new messages` : 'No new messages'}</p>
            <Link to="/chat" className="block w-full rounded-xl bg-white py-1.5 text-center text-xs font-bold text-[#1a1c1a] transition hover:bg-[#f4f3f1]">
              View
            </Link>
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-transparent bg-white px-5 py-3 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4d4636]">Team Sync Timeline</p>
          <span className="cursor-pointer text-[10px] font-semibold text-[#765b00] hover:underline">See calendar</span>
        </div>
        {loading ? (
          <p className="text-xs text-[#7f7664]">Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {iterations.map((it) => (
              <div key={it.id} className="border-l-2 pl-3" style={{ borderColor: it.statut === 'EN_COURS' ? '#765b00' : '#d1c5b0' }}>
                <p className="text-[10px] font-bold" style={{ color: it.statut === 'EN_COURS' ? '#765b00' : '#7f7664' }}>
                  {new Date(it.date).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs font-semibold text-[#1a1c1a]">{it.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
