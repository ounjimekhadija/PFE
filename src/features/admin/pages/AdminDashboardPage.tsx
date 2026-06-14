import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Download, Layers, PauseCircle, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../../../lib/supabase';

interface ProjectRow {
  id: string;
  titre: string;
  domaine: string | null;
  encadrant_id: string | null;
  deadline_globale: string | null;
  created_at?: string;
}

interface IterationRow {
  id: string;
  projet_id: string;
  statut: string | null;
  date_debut: string | null;
}

interface TaskRow {
  id: string;
  iteration_id: string;
  etat: string | null;
}

interface EncadrantRow {
  id: string;
  nom: string | null;
  prenom: string | null;
}

interface DashboardProject {
  id: string;
  title: string;
  category: string;
  progress: number;
  deadline: string | null;
  supervisor: string;
  studentCount: number;
  createdAt: string | null;
}


const getErrorText = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const obj = error as { message?: string; details?: string; hint?: string };
    return [obj.message, obj.details, obj.hint].filter(Boolean).join(' | ');
  }
  return '';
};

const extractMissingColumns = (error: unknown): string[] => {
  const text = getErrorText(error);
  if (!text) return [];
  const matches = Array.from(text.matchAll(/column\s+([a-zA-Z0-9_.\"]+)\s+does not exist/gi));
  const found = matches.map((m) => m[1]?.replace(/"/g, '')).filter(Boolean) as string[];
  return Array.from(new Set(found));
};

const toDaysDelay = (deadlineIso: string | null): number => {
  if (!deadlineIso) return 0;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return 0;
  const diff = Date.now() - deadline;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};


const resolveAvatar = (avatarUrl: string | null | undefined, name: string): string => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=1a1c1a&bold=true&size=64`;
  if (!avatarUrl) return fallback;
  const raw = avatarUrl.trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
  return data?.publicUrl || fallback;
};

interface OnboardingMember { name: string; avatar: string; }

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalProfessors, setTotalProfessors] = useState(0);
  const [onboardingMembers, setOnboardingMembers] = useState<OnboardingMember[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        setMissingColumns([]);

        const [
          { count: studentCount, error: studentsError },
          { data: projectRows, error: projectsError },
          { count: professorCount, error: professorsError },
          { data: membersData },
        ] = await Promise.all([
          supabase.from('etudiants').select('id', { count: 'exact', head: true }),
          supabase
            .from('projets')
            .select('id, titre, domaine, encadrant_id, deadline_globale, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('role', 'ENCADRANT'),
          supabase.from('utilisateurs').select('nom, prenom, avatar_url').limit(6),
        ]);

        if (studentsError) throw studentsError;
        if (projectsError) throw projectsError;
        if (professorsError) throw professorsError;
        setTotalProfessors(professorCount || 0);

        setOnboardingMembers(
          (membersData || []).map((u: { nom: string | null; prenom: string | null; avatar_url?: string | null }) => {
            const name = `${u.prenom || ''} ${u.nom || ''}`.trim() || 'User';
            return { name, avatar: resolveAvatar(u.avatar_url, name) };
          })
        );

        const safeProjects = (projectRows || []) as ProjectRow[];
        if (safeProjects.length === 0) {
          setTotalStudents(studentCount || 0);
          setProjects([]);
          return;
        }

        const projectIds = safeProjects.map((p) => p.id);
        const encadrantIds = Array.from(new Set(safeProjects.map((p) => p.encadrant_id).filter(Boolean))) as string[];

        const [studentsByProjectRes, iterationsRes, supervisorsRes] = await Promise.all([
          supabase.from('etudiants').select('id, projet_id').in('projet_id', projectIds),
          supabase
            .from('iterations')
            .select('id, projet_id, statut, date_debut')
            .in('projet_id', projectIds)
            .order('date_debut', { ascending: false }),
          encadrantIds.length > 0
            ? supabase.from('utilisateurs').select('id, nom, prenom').in('id', encadrantIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (studentsByProjectRes.error) throw studentsByProjectRes.error;
        if (iterationsRes.error) throw iterationsRes.error;
        if (supervisorsRes.error) throw supervisorsRes.error;

        const iterations = (iterationsRes.data || []) as IterationRow[];
        const chosenIterationByProject: Record<string, IterationRow> = {};

        iterations.forEach((it) => {
          if (!chosenIterationByProject[it.projet_id]) {
            chosenIterationByProject[it.projet_id] = it;
          }
          if (it.statut === 'EN_COURS') {
            chosenIterationByProject[it.projet_id] = it;
          }
        });

        const iterationIds = Object.values(chosenIterationByProject).map((it) => it.id);
        let tasks: TaskRow[] = [];

        if (iterationIds.length > 0) {
          const { data: taskRows, error: taskError } = await supabase
            .from('taches')
            .select('id, iteration_id, etat')
            .in('iteration_id', iterationIds);

          if (taskError) throw taskError;
          tasks = (taskRows || []) as TaskRow[];
        }

        const tasksByIteration: Record<string, TaskRow[]> = {};
        tasks.forEach((task) => {
          if (!tasksByIteration[task.iteration_id]) tasksByIteration[task.iteration_id] = [];
          tasksByIteration[task.iteration_id].push(task);
        });

        const studentsByProject: Record<string, number> = {};
        (studentsByProjectRes.data || []).forEach((row: { projet_id: string | null }) => {
          if (!row.projet_id) return;
          studentsByProject[row.projet_id] = (studentsByProject[row.projet_id] || 0) + 1;
        });

        const supervisorsById: Record<string, string> = {};
        ((supervisorsRes.data || []) as EncadrantRow[]).forEach((u) => {
          const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim();
          supervisorsById[u.id] = fullName || 'N/A';
        });

        const mappedProjects: DashboardProject[] = safeProjects.map((p) => {
          const selectedIteration = chosenIterationByProject[p.id];
          const relatedTasks = selectedIteration ? (tasksByIteration[selectedIteration.id] || []) : [];
          const completedTasks = relatedTasks.filter((t) => t.etat === 'TERMINE').length;
          const progress = relatedTasks.length > 0 ? Math.round((completedTasks / relatedTasks.length) * 100) : 0;

          return {
            id: p.id,
            title: p.titre || 'Projet sans titre',
            category: p.domaine || 'Général',
            progress,
            deadline: p.deadline_globale,
            supervisor: p.encadrant_id ? (supervisorsById[p.encadrant_id] || 'N/A') : 'N/A',
            studentCount: studentsByProject[p.id] || 0,
            createdAt: p.created_at || null,
          };
        });

        setTotalStudents(studentCount || 0);
        setProjects(mappedProjects);
      } catch (err) {
        const missing = extractMissingColumns(err);
        setMissingColumns(missing);
        setError(getErrorText(err) || 'Erreur lors du chargement des données du tableau de bord.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const completionRate = useMemo(() => {
    if (projects.length === 0) return 0;
    const total = projects.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(total / projects.length);
  }, [projects]);

  const delayedProjects = useMemo(() => projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80), [projects]);

  const avgDelay = useMemo(() => {
    if (delayedProjects.length === 0) return 0;
    const totalDelay = delayedProjects.reduce((sum, p) => sum + toDaysDelay(p.deadline), 0);
    return Number((totalDelay / delayedProjects.length).toFixed(1));
  }, [delayedProjects]);

  const projectStatus = useMemo(() => [
    { name: 'Terminés', value: projects.filter((p) => p.progress >= 80).length, color: '#10B981' },
    { name: 'In Progress', value: projects.filter((p) => p.progress > 0 && p.progress < 80).length, color: '#1E3A5F' },
    { name: 'En retard', value: projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80).length, color: '#F97316' },
    { name: 'En attente', value: projects.filter((p) => p.progress === 0).length, color: '#64748B' },
  ], [projects]);

  const ringProgression = Math.max(6, completionRate);

  const projectHealth = useMemo(() => {
    const delayed = projects.filter((p) => toDaysDelay(p.deadline) > 0 && p.progress < 80);
    const active = projects.filter((p) => p.progress > 0 && p.progress < 80);
    const completed = projects.filter((p) => p.progress >= 80);
    const pending = projects.filter((p) => p.progress === 0);
    const onTrack = active.filter((p) => toDaysDelay(p.deadline) === 0);
    const delayedTasks = delayed
      .map((p) => ({ ...p, delayjours: toDaysDelay(p.deadline) }))
      .sort((a, b) => b.delayjours - a.delayjours)
      .slice(0, 4);

    return { active, completed, delayed, pending, onTrack, delayedTasks };
  }, [projects]);



  const handleExportReport = async () => {
    try {

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tableau de bord admin';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Rapport du tableau de bord', {
        views: [{ showGridLines: false }]
      });

      // Title Section
      sheet.mergeCells('A1:G2');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'RAPPORT DE PERFORMANCE DE LA PLATEFORME';
      titleCell.font = { name: 'Arial', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Generation Date
      sheet.mergeCells('A3:G3');
      const dateCell = sheet.getCell('A3');
      dateCell.value = `Généré le ${new Date().toLocaleDateString()}`;
      dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF7F7664' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

      // Summary Section
      sheet.mergeCells('A5:C5');
      const summaryTitle = sheet.getCell('A5');
      summaryTitle.value = 'Résumé exécutif';
      summaryTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1A1C1A' } };
      summaryTitle.border = { bottom: { style: 'medium', color: { argb: 'FFFFD464' } } };

      // Add summary metrics
      const summaryData = [
        ['Total étudiants', totalStudents, "Taux d'achèvement", `${completionRate}%`],
        ['Total encadrants', totalProfessors, 'Retard moyen (jours)', avgDelay],
        ['Projets actifs', projects.length, 'Projets en retard', delayedProjects.length],
      ];

      sheet.addRow([]); // Row 6 is empty
      summaryData.forEach((row, i) => {
        const addedRow = sheet.addRow(['', row[0], row[1], '', row[2], row[3]]);
        addedRow.height = 20;
        addedRow.alignment = { vertical: 'middle' };
        
        // Style Metric Names
        addedRow.getCell(2).font = { name: 'Arial', bold: true, color: { argb: 'FF4D4636' } };
        addedRow.getCell(5).font = { name: 'Arial', bold: true, color: { argb: 'FF4D4636' } };
        
        // Style Metric Values
        addedRow.getCell(3).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF10B981' } };
        addedRow.getCell(6).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF765B00' } };
        
        // Highlight values for emphasis
        if (i === 2) addedRow.getCell(6).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFF97316' } }; // Projets en retard
      });

      sheet.addRow([]);
      sheet.addRow([]);

      // Projects Section
      sheet.mergeCells('B11:F11');
      const projectTitle = sheet.getCell('B11');
      projectTitle.value = 'Progression détaillée des projets';
      projectTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1A1C1A' } };
      projectTitle.border = { bottom: { style: 'medium', color: { argb: 'FFFFD464' } } };
      
      sheet.addRow([]); // Row 12 is empty

      // Table Header
      const headerRow = sheet.addRow(['ID', 'Titre du projet', 'Catégorie', 'Encadrant', 'Progression', 'Échéance', 'Étudiants']);
      headerRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.height = 25;
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      
      for (let i = 1; i <= 7; i++) {
        const cell = headerRow.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF765B00' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
      }

      // Table Data
      projects.forEach((p, index) => {
        const row = sheet.addRow([
          index + 1,
          p.title,
          p.category,
          p.supervisor,
          p.progress / 100, // Format as percentage later
          p.deadline || 'N/A',
          p.studentCount
        ]);
        row.height = 22;
        row.alignment = { vertical: 'middle', wrapText: true };
        
        // Center some columns
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Progression percentage format
        row.getCell(5).numFmt = '0%';

        // Zebra striping
        if (index % 2 === 0) {
          for (let i = 1; i <= 7; i++) {
            row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F3F1' } };
          }
        }
        
        // Progression coloring
        const progressCell = row.getCell(5);
        if (p.progress >= 80) progressCell.font = { color: { argb: 'FF10B981' }, bold: true };
        else if (p.progress > 0) progressCell.font = { color: { argb: 'FF765B00' }, bold: true };
        else progressCell.font = { color: { argb: 'FF7F7664' }, bold: true };
      });

      // Columns width
      sheet.columns = [
        { width: 8 },  // ID
        { width: 40 }, // Title
        { width: 22 }, // Catégorie
        { width: 25 }, // Encadrant
        { width: 15 }, // Progression
        { width: 15 }, // Échéance
        { width: 12 }, // Étudiants
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Platform_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Échec de l'export :", err);
      alert('Impossible de générer le rapport Excel.');
    }
  };

  const barData = useMemo(() => {
    const map = new Map<string, { totalProgression: number; count: number }>();
    projects.forEach((p) => {
      const current = map.get(p.supervisor) || { totalProgression: 0, count: 0 };
      map.set(p.supervisor, { totalProgression: current.totalProgression + p.progress, count: current.count + 1 });
    });
    const entries = Array.from(map.entries());
    const colors = ['#1E3A5F', '#DCEBFA', '#334155', '#C8D6E5', '#F97316'];
    return entries.length > 0
      ? entries.map(([name, stats], i) => ({ 
          name, 
          count: Math.round(stats.totalProgression / stats.count), 
          color: colors[i % colors.length] 
        }))
      : projectStatus.map((s) => ({ name: s.name, count: s.value, color: s.color }));
  }, [projects, projectStatus]);

  const maxBarCount = 100;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] px-4 py-3 text-[#1a1c1a] sm:px-6 lg:px-8" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-[#1a1c1a]">Tableau de bord admin</h1>
          <p className="mt-1 text-sm text-[#64748B]">Vue globale des projets, utilisateurs et indicateurs de progression.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportReport}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(30,58,95,0.20)] transition hover:bg-[#172D49]"
          >
            <Download size={16} /> Exporter
          </button>
        </div>
      </header>

      {loading && (
        <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#EEF3F8] px-4 py-2 text-sm text-[#334155]">
          Chargement des données du tableau de bord...
        </div>
      )}
      {!loading && error && (
        <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">
          <p className="font-semibold">Erreur de base de données lors du chargement du tableau de bord.</p>
          <p className="mt-1">{missingColumns.length > 0 ? `Colonne(s) manquante(s) : ${missingColumns.join(', ')}` : error}</p>
        </div>
      )}

      {/* Stat Cards */}
      <section className="mb-3 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total étudiants', value: String(totalStudents), trend: `+${Math.max(1, Math.round(totalStudents * 0.08))}`, trendClass: 'text-[#10B981] bg-[#ECFDF5]', icon: Users },
          { label: 'Projets actifs', value: String(projects.length), trend: projectStatus[1].value > 0 ? `${projectStatus[1].value} active` : 'Stable', trendClass: 'text-[#1E3A5F] bg-[#DCEBFA]/30', icon: Layers },
          { label: "Taux d'achèvement", value: `${completionRate}%`, trend: `+${completionRate}%`, trendClass: 'text-[#10B981] bg-[#ECFDF5]', icon: TrendingUp },
          { label: 'Retard moy.', value: `${avgDelay} jours`, trend: avgDelay > 0 ? `+${avgDelay}d` : 'Aucun', trendClass: avgDelay > 0 ? 'text-[#ba1a1a] bg-[#ffdad6]' : 'text-[#10B981] bg-[#ECFDF5]', icon: Clock3 },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-[#DCEBFA] bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-xl bg-[#EEF3F8] p-2 text-[#1E3A5F]">
                <card.icon size={17} />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${card.trendClass}`}>{card.trend}</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{card.label}</p>
            <p className="mt-1 text-2xl font-bold leading-none text-[#1a1c1a]">{card.value}</p>
          </article>
        ))}
      </section>

      {/* Main Row */}
      <section className="mb-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr_1fr]">

        {/* Bar Chart - Project Distribution */}
        <article className="flex min-h-0 flex-col rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Progression des projetsion</h2>
              <p className="text-[9px] text-[#64748B]/60">Achèvement moyen par encadrant</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {barData.slice(0, 4).map((b) => (
                <span key={b.name} className="flex items-center gap-1.5 text-[9px] font-bold text-[#64748B]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="truncate max-w-[60px]">{b.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-end gap-4 px-2 pb-2">
            {/* Subtle Grid Lines */}
            <div className="absolute inset-x-0 bottom-8 top-0 flex flex-col justify-between pointer-events-none opacity-20">
              {[1, 2, 3].map((i) => <div key={i} className="w-full border-t border-dashed border-[#64748B]/30" />)}
            </div>
            
            {barData.map((bar) => (
              <div key={bar.name} className="group relative flex flex-1 flex-col items-center gap-2">
                <div className="absolute -top-6 opacity-0 transition-all group-hover:-top-8 group-hover:opacity-100">
                  <span className="rounded-md bg-[#1E3A5F] px-2 py-1 text-[9px] font-bold text-white shadow-lg">{bar.count}% Progression</span>
                </div>
                <div
                  className="w-full rounded-t-2xl transition-all duration-500 ease-out group-hover:brightness-110"
                  style={{
                    height: `${Math.max(26, Math.round((bar.count / maxBarCount) * 130))}px`,
                    background: `linear-gradient(to top, ${bar.color}, ${bar.color}dd)`,
                    boxShadow: `0 -4px 12px ${bar.color}20, inset 0 2px 4px rgba(255,255,255,0.2)`
                  }}
                />
                <span className="text-[9px] font-bold text-[#64748B] transition-colors group-hover:text-[#1a1c1a] truncate w-full text-center uppercase tracking-tighter">
                  {bar.name}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Progression globaleion Ring */}
        <article className="flex min-h-0 flex-col items-center justify-between rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] self-start">Progression globaleion</h2>
          <div
            className="relative h-32 w-32 rounded-full"
            style={{ background: `conic-gradient(#DCEBFA ${ringProgression}%, #e8e3da 0%)` }}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
              <p className="text-2xl font-bold text-[#1a1c1a]">{completionRate}%</p>
            </div>
          </div>
          <p className="text-center text-sm font-semibold text-[#1E3A5F]">
            {avgDelay > 0 ? `${avgDelay} jours de retard` : projects.length > 0 ? 'En avance sur le planning' : 'Aucune donnée pour le moment'}
          </p>
        </article>

        {/* Arrivées récentes - Dark Card */}
        <article className="flex min-h-0 flex-col justify-between rounded-2xl bg-[#1E3A5F] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/65">Arrivées récentes</p>
          <div>
            <div className="mb-3 flex -space-x-2">
              {onboardingMembers.slice(0, 4).map((m, i) => (
                <img
                  key={i}
                  src={m.avatar}
                  alt={m.name}
                  title={m.name}
                  className="h-10 w-10 rounded-full border-2 border-[#1E3A5F] object-cover"
                />
              ))}
              {(totalStudents + totalProfessors) > 4 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1E3A5F] bg-[#DCEBFA] text-xs font-bold text-[#1E3A5F]">
                  +{totalStudents + totalProfessors - 4}
                </div>
              )}
            </div>
            <p className="text-sm font-bold leading-snug text-white">
              {totalStudents + totalProfessors} nouveaux membres cette semaine
            </p>
          </div>
          <Link to="/users" className="mt-4 flex items-center justify-center rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
            Voir la liste
          </Link>
        </article>
      </section>

      <section className="grid shrink-0 grid-cols-1 pb-0">
        <article className="rounded-2xl border border-[#DCEBFA] bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">

          <div className="mb-2 flex items-end justify-between">
            <span className="text-xs font-bold text-[#1E3A5F]">{projects.length} projets</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Actifs', value: projectHealth.active.length, icon: Activity, color: '#1E3A5F', bg: 'bg-[#DCEBFA]/30' },
              { label: 'Dans les délais', value: projectHealth.onTrack.length, icon: CheckCircle2, color: '#10B981', bg: 'bg-[#ECFDF5]' },
              { label: 'En retard', value: projectHealth.delayed.length, icon: AlertTriangle, color: '#F97316', bg: 'bg-[#FFF7ED]' },
              { label: 'En attente', value: projectHealth.pending.length, icon: PauseCircle, color: '#64748B', bg: 'bg-[#EEF3F8]' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#EEF3F8] bg-[#F8FAFC] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`} style={{ color: item.color }}>
                    <item.icon size={18} />
                  </div>
                  <span className="text-2xl font-bold text-[#1a1c1a]">{item.value}</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">{item.label}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5EDF5]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${projects.length > 0 ? Math.round((item.value / projects.length) * 100) : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

    </div>
  );
};

export default AdminDashboard;







