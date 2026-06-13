import React, { useEffect, useState } from 'react';
import { Download, GraduationCap, Rocket, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

interface IterationHistory {
  id: string;
  projectName: string;
  numero: number;
  statut: string;
  date: string;
}

const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180.0);
  return {
    x: cx + (r * Math.cos(angleInRadians)),
    y: cy + (r * Math.sin(angleInRadians))
  };
};

const generatePieSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  if (endAngle - startAngle >= 360) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }

  return [
    "M", cx, cy,
    "L", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ");
};

const pieColors = [
  '#ffff00', '#a0a0ff', '#8b2a52', '#ffffcc', '#ccffff', 
  '#4a004a', '#ff8080', '#0066cc', '#cceeff', '#000080', '#ff00ff'
];

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
  const [iterationsHistory, setIterationsHistory] = useState<IterationHistory[]>([]);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);

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
          supabase.from('etudiants').select('id, projet_id, cne, filiere, utilisateurs(nom, prenom, avatar_url, email)').in('projet_id', projectIds),
          supabase.from('iterations').select('id, projet_id, numero, statut, date_debut, date_fin').in('projet_id', projectIds).order('date_debut', { ascending: true }),
          supabase.from('messages').select('id').in('projet_id', projectIds).neq('auteur_id', user.id).eq('lu', false),
        ]);

        setTotalStudents(students?.length || 0);
        setUnreadMsgs(msgs?.length || 0);

        const formattedStudents = (students || []).map((s: any) => {
          const u = Array.isArray(s.utilisateurs) ? s.utilisateurs[0] : s.utilisateurs;
          const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Student';
          const projectName = projects.find((p: any) => p.id === s.projet_id)?.titre || 'N/A';
          return {
            id: s.id,
            name,
            email: u?.email || 'N/A',
            cne: s.cne || 'N/A',
            filiere: s.filiere || 'N/A',
            projectName,
            avatar: resolveAvatar(u?.avatar_url, name)
          };
        });
        setAllStudents(formattedStudents);

        const memberList: Member[] = formattedStudents.slice(0, 4).map((s: any) => ({
          id: s.id, name: s.name, avatar: s.avatar
        }));
        setRecentMembers(memberList);

        setIterations((iters || []).map((it: any) => ({
          id: it.id,
          label: it.statut === 'EN_COURS' ? 'Iteration in progress' : it.statut === 'VALIDE' ? `Iteration ${it.numero}` : 'To Do',
          description: `From ${new Date(it.date_debut).toLocaleDateString()} to ${new Date(it.date_fin).toLocaleDateString()}`,
          date: it.date_debut,
          statut: it.statut,
        })));

        setIterationsHistory((iters || []).map((it: any) => {
          const project = projects.find((p: any) => p.id === it.projet_id);
          return {
            id: it.id,
            projectName: project ? project.titre : 'Project',
            numero: it.numero,
            statut: it.statut,
            date: it.date_debut || new Date().toISOString()
          };
        }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        const iterIds = (iters || []).map((it: any) => it.id);
        let tasks: any[] = [];
        if (iterIds.length > 0) {
          const { data: taskData } = await supabase.from('taches').select('id, iteration_id, etat, titre, created_at, priorite').in('iteration_id', iterIds);
          tasks = taskData || [];
        }
        setAllTasks(tasks);

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

          const pRecentDone = currentIter
            ? pTasks
                .filter((t: any) => t.etat === 'TERMINE' && t.iteration_id === currentIter.id)
                .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .slice(0, 3)
            : [];

          return {
            id: p.id,
            name: p.titre || 'Project',
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

  const exportReport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Professor Dashboard';
      workbook.created = new Date();

      // --- SHEET 1: SUMMARY ---
      const summarySheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
      
      // Title
      summarySheet.mergeCells('A1:B2');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'DASHBOARD REPORT';
      titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Generation Date
      summarySheet.mergeCells('A3:B3');
      const dateCell = summarySheet.getCell('A3');
      dateCell.value = `Generated on ${new Date().toLocaleDateString()}`;
      dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF7F7664' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
      
      summarySheet.addRow([]);

      // Headers
      const summaryHeader = summarySheet.addRow(['Metric', 'Value']);
      summaryHeader.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeader.height = 25;
      summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };
      
      for (let i = 1; i <= 2; i++) {
        const cell = summaryHeader.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF765B00' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
      }

      // Summary Data
      const summaryData = [
        ['Total Students', totalStudents],
        ['Active Projects', activeProjects],
        ['Completion Rate', `${completionRate}%`],
        ['Avg. Delay', avgDelay > 0 ? `${avgDelay} days late` : 'On time'],
      ];

      summaryData.forEach((row, index) => {
        const addedRow = summarySheet.addRow(row);
        addedRow.height = 20;
        addedRow.alignment = { vertical: 'middle' };
        addedRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Highlight logic
        addedRow.getCell(1).font = { name: 'Arial', bold: true, color: { argb: 'FF4D4636' } };
        if (index === 2) addedRow.getCell(2).font = { name: 'Arial', bold: true, color: { argb: 'FF10B981' } };
        if (index === 3 && avgDelay > 0) addedRow.getCell(2).font = { name: 'Arial', bold: true, color: { argb: 'FFF97316' } };

        if (index % 2 === 0) {
          for (let i = 1; i <= 2; i++) {
            addedRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F3F1' } };
          }
        }
      });

      summarySheet.columns = [
        { width: 25 },
        { width: 25 },
      ];

      // --- SHEET 2: PROJECTS ---
      const projectSheet = workbook.addWorksheet('Projects', { views: [{ showGridLines: false }] });
      
      projectSheet.mergeCells('A1:F2');
      const pTitleCell = projectSheet.getCell('A1');
      pTitleCell.value = 'PROJECTS PROGRESS';
      pTitleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      pTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1A' } };
      pTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      projectSheet.addRow([]);

      const projectHeader = projectSheet.addRow(['Project Name', 'Task Completion (%)', 'Time Progress (%)', 'Done', 'In Progress', 'Late']);
      projectHeader.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      projectHeader.height = 25;
      projectHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      
      for (let i = 1; i <= 6; i++) {
        const cell = projectHeader.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF765B00' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
      }

      projectBars.forEach((p, index) => {
        const row = projectSheet.addRow([
          p.name,
          p.taskCompletion / 100,
          p.timeProgress / 100,
          p.tasks?.completed ?? '-',
          p.tasks?.inProgress ?? '-',
          p.tasks?.late ?? '-',
        ]);
        row.height = 20;
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        
        row.getCell(2).numFmt = '0%';
        row.getCell(3).numFmt = '0%';

        if (index % 2 === 0) {
          for (let i = 1; i <= 6; i++) {
            row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F3F1' } };
          }
        }
        
        // Coloring Completion
        const completionCell = row.getCell(2);
        if (p.taskCompletion >= 75) completionCell.font = { color: { argb: 'FF10B981' }, bold: true };
        else if (p.taskCompletion >= 40) completionCell.font = { color: { argb: 'FF765B00' }, bold: true };
        else completionCell.font = { color: { argb: 'FFF97316' }, bold: true };
      });

      projectSheet.columns = [
        { width: 35 },
        { width: 22 },
        { width: 22 },
        { width: 12 },
        { width: 15 },
        { width: 12 },
      ];

      // --- SHEET 3: STUDENTS ---
      const studentSheet = workbook.addWorksheet('Students List', { views: [{ showGridLines: false }] });
      
      studentSheet.mergeCells('A1:E2');
      const stTitleCell = studentSheet.getCell('A1');
      stTitleCell.value = 'STUDENTS DIRECTORY';
      stTitleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      stTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1A' } };
      stTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      studentSheet.addRow([]);

      const stHeader = studentSheet.addRow(['Name', 'Email', 'CNE', 'Filiere', 'Project']);
      stHeader.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      stHeader.height = 25;
      stHeader.alignment = { vertical: 'middle', horizontal: 'center' };
      
      for (let i = 1; i <= 5; i++) {
        const cell = stHeader.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF765B00' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
      }

      allStudents.forEach((s, index) => {
        const row = studentSheet.addRow([
          s.name,
          s.email,
          s.cne,
          s.filiere,
          s.projectName
        ]);
        row.height = 20;
        row.alignment = { vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };

        if (index % 2 === 0) {
          for (let i = 1; i <= 5; i++) {
            row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F3F1' } };
          }
        }
      });

      studentSheet.columns = [
        { width: 30 },
        { width: 35 },
        { width: 15 },
        { width: 15 },
        { width: 40 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Professor_Dashboard_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate the Excel report.');
    }
  };

  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (completionRate / 100) * circ;

  const stats = [
    { label: 'ETUDIANTS', value: totalStudents, badge: `${totalStudents > 0 ? '+' : ''}${totalStudents}`, badgeGreen: true, icon: <GraduationCap size={20} /> },
    { label: 'PROJETS ACTIFS', value: activeProjects, badge: 'Stable', badgeGreen: false, icon: <Rocket size={20} /> },
    { label: 'TAUX COMPLETE', value: `${completionRate}%`, badge: `${completionRate}%`, badgeGreen: true, icon: <CheckCircle size={20} /> },
    { label: 'RETARD MOYEN', value: `${avgDelay} j`, badge: avgDelay > 0 ? `+${avgDelay}j` : 'A temps', badgeGreen: avgDelay === 0, icon: <Clock size={20} /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-4 sm:px-6 lg:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <header className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Tableau de bord professeur</h1>
          <p className="mt-1 text-sm text-[#64748B]">Suivez les projets, les taches et l'activite de vos groupes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport} className="flex h-11 items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(30,58,95,0.20)] transition hover:bg-[#172D49]">
            <Download size={16} /> Exporter
          </button>
        </div>
      </header>

      <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#DCEBFA] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]">
                {s.icon}
              </div>
              <span className={`text-[11px] font-bold ${s.badgeGreen ? 'text-green-500' : 'text-[#1E3A5F]'}`}>{s.badge}</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#64748B]">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-[#1a1c1a]">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-h-0 flex-col rounded-2xl border border-[#DCEBFA] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] xl:col-span-2">
          <div className="mb-2 flex shrink-0 items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#334155]">Progression des projets</p>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[9px] text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#1E3A5F]" />≥75% done</span>
              <span className="flex items-center gap-1 text-[9px] text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#DCEBFA]" />40–74%</span>
              <span className="flex items-center gap-1 text-[9px] text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#8FB4D9]" />&lt;40%</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-2">
            {loading ? (
              <p className="text-sm text-[#64748B]">Loading...</p>
            ) : projectBars.length === 0 ? (
              <p className="text-sm text-[#64748B]">No project.</p>
            ) : (
              <div className="flex h-full min-h-0 flex-1 gap-8 overflow-x-auto">
                <div className="flex flex-1 flex-col justify-end min-w-0">
                  <div className="flex h-full items-end justify-center gap-10 border-r border-[#EEF3F8] pb-2 pr-8">
                    {projectBars.map((p, i) => {
                      const taskPct = Math.max(p.taskCompletion, 0);
                      const timePct = Math.max(p.timeProgress, 0);
                      const barColors = taskPct >= 75
                        ? { from: '#1E3A5F', to: '#172D49', glow: 'rgba(30,58,95,0.26)' }
                        : taskPct >= 40
                          ? { from: '#DCEBFA', to: '#8FB4D9', glow: 'rgba(143,180,217,0.28)' }
                          : { from: '#8FB4D9', to: '#1E3A5F', glow: 'rgba(30,58,95,0.22)' };

                      return (
                        <div key={i} className="group relative flex h-full w-full max-w-[220px] flex-col items-center justify-end">
                          <div className="mb-2 opacity-0 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 group-hover:opacity-100">
                            <div className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 shadow-lg">
                              <span className="text-xs font-bold text-white whitespace-nowrap">{taskPct}% termine</span>
                            </div>
                          </div>
                          <div className="relative w-full flex-1 overflow-hidden rounded-3xl border border-[#E5EDF5] bg-[#EEF3F8] shadow-inner">
                            {timePct > 0 && (
                              <div className="absolute bottom-0 w-full opacity-20 transition-all duration-1000" style={{ height: `${timePct}%`, background: 'linear-gradient(to top, #1E3A5F, transparent)' }} />
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
                              <span className="text-[9px] font-bold text-[#64748B]">{taskPct}%</span>
                            </div>
                          </div>
                          <div className="absolute bottom-full left-1/2 z-30 mb-4 hidden w-40 -translate-x-1/2 animate-in fade-in zoom-in-95 flex-col rounded-xl border border-[#EEF3F8] bg-white p-3 shadow-2xl duration-200 group-hover:flex">
                            <p className="mb-2 border-b border-[#EEF3F8] pb-1 text-[10px] font-bold text-[#1a1c1a]">{p.name}</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[9px]"><span className="text-[#64748B]">Tasks Done</span><span className="font-bold text-green-600">{p.tasks?.completed || 0}</span></div>
                              <div className="flex justify-between text-[9px]"><span className="text-[#64748B]">In Progress</span><span className="font-bold text-[#DCEBFA]">{p.tasks?.inProgress || 0}</span></div>
                              {p.tasks && p.tasks.late > 0 && (<div className="flex justify-between text-[9px]"><span className="text-[#64748B]">Late Tasks</span><span className="font-bold text-red-500">{p.tasks.late}</span></div>)}
                              <div className="mt-2 flex justify-between border-t border-[#EEF3F8] pt-1 text-[9px]"><span className="text-[#64748B]">Time Spent</span><span className="font-bold text-[#1a1c1a]">{timePct}%</span></div>
                            </div>
                            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#EEF3F8] bg-white"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex w-72 flex-col min-w-0">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Dernieres taches terminees</p>
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {allRecentCompleted.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3F8]"><span className="text-lg">🎉</span></div>
                        <p className="text-xs font-medium text-[#64748B]">Aucune tache terminee.</p>
                      </div>
                    ) : (
                      allRecentCompleted.map((task, idx) => (
                        <div key={idx} className="group flex flex-col rounded-xl border border-[#EEF3F8] bg-[#F8FAFC] p-3 transition-all hover:border-[#22c55e]/30 hover:bg-white hover:shadow-md">
                          <div className="mb-1.5 flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <p className="line-clamp-2 text-xs font-bold leading-tight text-[#1a1c1a]">{task.titre}</p>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <span className="max-w-[120px] truncate rounded-md bg-[#DCEBFA]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#1E3A5F]">{task.projectName}</span>
                            <span className="text-[9px] font-medium text-[#64748B]">Terminee</span>
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
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#DCEBFA] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <p className="mb-4 self-start text-[10px] font-bold uppercase tracking-widest text-[#334155]">Historique des iterations</p>
            <div className="flex-1 overflow-y-auto max-h-[240px] pr-2 custom-scrollbar space-y-3">
              {loading ? (
                <p className="text-xs text-[#64748B]">Loading...</p>
              ) : iterationsHistory.length === 0 ? (
                <p className="text-xs text-[#64748B]">No iteration.</p>
              ) : (
                iterationsHistory.map((it) => (
                  <div key={it.id} className="flex flex-col border-b border-[#EEF3F8] pb-2 last:border-0 last:pb-0">
                    <p className="text-xs font-bold text-[#1a1c1a] truncate" title={it.projectName}>{it.projectName}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#64748B]">Iteration {it.numero}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                        it.statut === 'VALIDE' ? 'bg-green-100 text-green-700' :
                        it.statut === 'EN_COURS' ? 'bg-[#DCEBFA]/20 text-[#1E3A5F]' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {it.statut === 'VALIDE' ? 'Terminee' : it.statut === 'EN_COURS' ? 'En cours' : 'A faire'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-[#1E3A5F] px-4 py-3 text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)]">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/65">Chat</p>
            <div className="mb-2 flex -space-x-2">
              {recentMembers.map((m) => (
                <img key={m.id} src={m.avatar} alt={m.name} title={m.name} className="h-7 w-7 rounded-full border-2 border-[#1E3A5F] object-cover" />
              ))}
            </div>
            <p className="mb-3 text-xs font-bold">{unreadMsgs > 0 ? `${unreadMsgs} nouveaux messages` : 'Aucun nouveau message'}</p>
            <Link to="/chat" className="block w-full rounded-xl bg-white py-1.5 text-center text-xs font-bold text-[#1E3A5F] transition hover:bg-[#DCEBFA]">
              Voir
            </Link>
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-[#DCEBFA] bg-white px-5 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        {loading ? (
          <p className="text-xs text-[#64748B]">Loading...</p>
        ) : (
          <div className="flex gap-8 overflow-x-auto pb-2 custom-scrollbar">
            {iterations.map((it) => {
              const borderColor = it.statut === 'VALIDE' ? '#1E3A5F' : it.statut === 'EN_COURS' ? '#1E3A5F' : '#C8D6E5';
              const textColor = it.statut === 'VALIDE' ? '#1E3A5F' : it.statut === 'EN_COURS' ? '#1E3A5F' : '#64748B';
              return (
                <div key={it.id} className="border-l-2 pl-3 shrink-0" style={{ borderColor }}>
                  <p className="text-[10px] font-bold" style={{ color: textColor }}>
                    {new Date(it.date).toLocaleDateString()}
                  </p>
                  <p className="text-xs font-semibold text-[#1a1c1a]">{it.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
