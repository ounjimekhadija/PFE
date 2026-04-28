import React, { useEffect, useState } from 'react';
import { Calendar, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

interface ProjectBar {
  name: string;
  timeProgress: number; // percent of time elapsed relative to start->deadline
  taskCompletion: number; // percent of tasks done for the project
  tasks: {
    completed: number;
    inProgress: number;
    late: number;
  } | null;
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

        // Recent members (last 4)
        const memberList: Member[] = (students || []).slice(0, 4).map((s: any) => {
          const u = Array.isArray(s.utilisateurs) ? s.utilisateurs[0] : s.utilisateurs;
          const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Etudiant';
          return { id: s.id, name, avatar: resolveAvatar(u?.avatar_url, name) };
        });
        setRecentMembers(memberList);

        // Iterations for timeline (upcoming/active)
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

        // Tasks for completion rate + per-project progress
        const iterIds = (iters || []).map((it: any) => it.id);
        let tasks: any[] = [];
        if (iterIds.length > 0) {
          const { data: taskData } = await supabase.from('taches').select('id, iteration_id, etat').in('iteration_id', iterIds);
          tasks = taskData || [];
        }

        const total = tasks.length;
        const done = tasks.filter((t: any) => t.etat === 'TERMINE').length;
        setCompletionRate(total > 0 ? Math.round((done / total) * 100) : 0);

        // Per-project progress
        const iterByProject: Record<string, string[]> = {};
        (iters || []).forEach((it: any) => {
          if (!iterByProject[it.projet_id]) iterByProject[it.projet_id] = [];
          iterByProject[it.projet_id].push(it.id);
        });
        // Build per-project progress relative to deadline using iterations start dates
        setProjectBars(projects.map((p: any) => {
          const ids = iterByProject[p.id] || [];
          const pTasks = tasks.filter((t: any) => ids.includes(t.iteration_id));
          const pDone = pTasks.filter((t: any) => t.etat === 'TERMINE').length;
          const taskCompletion = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;

          // find earliest iteration start for this project
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

          // Get task counts for the current iteration for the tooltip
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


          return {
            name: p.titre || 'Projet',
            timeProgress,
            taskCompletion,
            tasks: iterTasks,
          };
        }));

        // Avg delay (days past deadline for late projects)
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

  const exportReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Summary
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Dashboard Report', new Date().toLocaleDateString('fr-FR')],
      [],
      ['Metric', 'Value'],
      ['Total Students',   totalStudents],
      ['Active Projects',  activeProjects],
      ['Completion Rate',  `${completionRate}%`],
      ['Avg. Delay',       avgDelay > 0 ? `${avgDelay} days late` : 'On time'],
    ]), 'Summary');

    // Sheet 2 — Projects
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

    // Sheet 3 — Timeline
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Label', 'Description', 'Date', 'Status'],
      ...iterations.map(it => [it.label, it.description, it.date, it.statut]),
    ]), 'Iterations');

    // Sheet 4 — Members
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Name'],
      ...recentMembers.map(m => [m.name]),
    ]), 'Members');

    XLSX.writeFile(wb, `dashboard_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Donut chart
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

      {/* Header */}
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

      {/* Stats */}
      <div className="mb-3 grid shrink-0 grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#d1c5b0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(118,91,0,0.05)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xl">{s.icon}</span>
              <span className={`text-[11px] font-bold ${s.badgeGreen ? 'text-green-500' : 'text-[#f59e0b]'}`}>{s.badge}</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-[#1a1c1a]">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Middle row — flex-1 fills remaining space */}
      <div className="mb-3 grid min-h-0 flex-1 grid-cols-3 gap-3">

        {/* Bar chart */}
        <div className="col-span-2 flex min-h-0 flex-col rounded-2xl border border-[#d1c5b0] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(118,91,0,0.05)]">
          <div className="mb-2 flex shrink-0 items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4d4636]">Project Distribution</p>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#22c55e]"/>≥75% done</span>
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#ffd464]"/>40–74%</span>
              <span className="flex items-center gap-1 text-[9px] text-[#7f7664]"><span className="h-2 w-2 rounded-full bg-[#765b00]"/>&lt;40%</span>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <p className="text-sm text-[#7f7664]">Chargement...</p>
            ) : projectBars.length === 0 ? (
              <p className="text-sm text-[#7f7664]">Aucun projet.</p>
            ) : (
              <div className="flex h-full items-end gap-4 pb-1">
                {projectBars.map((p, i) => {
                  const taskPct  = Math.max(p.taskCompletion, 0);
                  const timePct  = Math.max(p.timeProgress, 0);
                  const barColor = taskPct >= 75 ? '#22c55e' : taskPct >= 40 ? '#ffd464' : '#765b00';
                  return (
                    <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                      {/* hover label */}
                      <div className="mb-1 opacity-0 group-hover:opacity-100 transition text-center">
                        <span className="text-[10px] font-bold" style={{ color: barColor }}>{taskPct}%</span>
                        {timePct > 0 && (
                          <span className="ml-1 text-[9px] text-[#7f7664]">· {timePct}% time</span>
                        )}
                      </div>

                      {/* bar */}
                      <div className="relative w-full flex-1 rounded-t-xl bg-[#f4f3f1] overflow-hidden">
                        {/* time progress ghost bar */}
                        {timePct > 0 && (
                          <div
                            className="absolute bottom-0 w-full rounded-t-xl opacity-20 transition-all"
                            style={{ height: `${Math.max(timePct, 3)}%`, backgroundColor: '#1a1c1a' }}
                          />
                        )}
                        {/* task completion bar */}
                        <div
                          className="absolute bottom-0 w-full rounded-t-xl transition-all duration-700"
                          style={{ height: `${Math.max(taskPct, 4)}%`, backgroundColor: barColor }}
                        />
                      </div>

                      {/* labels */}
                      <span className="mt-1 w-full truncate text-center text-[9px] text-[#7f7664]" title={p.name}>
                        {p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: barColor }}>{taskPct}% tasks</span>

                      {/* task breakdown tooltip on hover */}
                      {p.tasks && (
                        <div className="hidden group-hover:flex flex-col items-center text-[9px] text-[#7f7664] mt-0.5 gap-0.5">
                          <span className="text-green-600 font-semibold">✓ {p.tasks.completed} done</span>
                          <span className="text-[#ffd464] font-semibold">⟳ {p.tasks.inProgress} in progress</span>
                          {p.tasks.late > 0 && <span className="text-red-500 font-semibold">⚠ {p.tasks.late} late</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex min-h-0 flex-col gap-3">

          {/* Quarterly Progress */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-[#d1c5b0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(118,91,0,0.05)]">
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
            <p className="mt-1 text-[10px] text-[#7f7664]">Overall task completion</p>
          </div>

          {/* Chat Card */}
          <div className="shrink-0 rounded-2xl bg-[#1a1c1a] px-4 py-3 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">Chat</p>
            <div className="mb-2 flex -space-x-2">
              {recentMembers.map((m) => (
                <img key={m.id} src={m.avatar} alt={m.name} title={m.name} className="h-7 w-7 rounded-full border-2 border-[#1a1c1a] object-cover" />
              ))}
              {totalStudents > 4 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#1a1c1a] bg-[#765b00] text-[9px] font-bold text-white">
                  +{totalStudents - 4}
                </div>
              )}
            </div>
            <p className="mb-3 text-xs font-bold">{unreadMsgs > 0 ? `${unreadMsgs} new messages` : 'No new messages'}</p>
            <Link to="/chat" className="block w-full rounded-xl bg-white py-1.5 text-center text-xs font-bold text-[#1a1c1a] transition hover:bg-[#f4f3f1]">
              View
            </Link>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="shrink-0 rounded-2xl border border-[#d1c5b0] bg-white px-5 py-3 shadow-[0_2px_8px_rgba(118,91,0,0.05)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4d4636]">Team Sync Timeline (Iterations)</p>
          <span className="cursor-pointer text-[10px] font-semibold text-[#765b00] hover:underline">See full calendar</span>
        </div>
        {loading ? (
          <p className="text-xs text-[#7f7664]">Chargement...</p>
        ) : iterations.length === 0 ? (
          <p className="text-xs text-[#7f7664]">Aucune iteration à venir.</p>
        ) : (
          <div className="grid h-[calc(100%-32px)] grid-cols-2 gap-4">
            {iterations.map((it) => (
              <div key={it.id} className="border-l-2 pl-3" style={{ borderColor: it.statut === 'EN_COURS' ? '#765b00' : '#d1c5b0' }}>
                <p className="text-[10px] font-bold" style={{ color: it.statut === 'EN_COURS' ? '#765b00' : '#7f7664' }}>
                  {new Date(it.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </p>
                <p className="text-xs font-semibold text-[#1a1c1a]">{it.label}</p>
                <p className="text-[10px] leading-relaxed text-[#7f7664]">{it.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
