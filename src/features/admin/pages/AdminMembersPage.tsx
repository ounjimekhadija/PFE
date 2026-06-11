import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, MoreVertical, User, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Student {
  id: string;
  name: string;
  email: string;
  cne: string;
  avatar: string;
  projet_id: string | null;
  filiere: string | null;
  nom_groupe: string | null;
}

interface Groupe {
  name: string;
  filiere: string;
  students: Student[];
}

const PAGE_SIZE = 10;

const AdminMembers: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [filieres, setFilieres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'groups'>('students');
  const [selectedFiliere, setSelectedFiliere] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterFiliere, setFilterFiliere] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all');
  const [filterPos, setFilterPos] = useState({ top: 0, right: 0 });
  const [filiereDropdownOpen, setFiliereDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resolveAvatar = (avatarUrl: string | null | undefined, name: string): string => {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    if (!avatarUrl) return fallback;
    const raw = avatarUrl.trim();
    if (!raw) return fallback;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
    const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
    return data?.publicUrl || fallback;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: rows, error: fetchError } = await supabase.from('etudiants').select(`
          id, cne, filiere, projet_id,
          utilisateurs (nom, prenom, avatar_url, email)
        `);

        if (fetchError) throw fetchError;

        const projectIds = [...new Set((rows || []).map((r: any) => r.projet_id).filter(Boolean))];
        const projectMap = new Map<string, { nom_groupe: string; domaine: string }>();
        if (projectIds.length > 0) {
          const { data: projets } = await supabase.from('projets').select('id, nom_groupe, domaine').in('id', projectIds);
          (projets || []).forEach((p: any) => projectMap.set(String(p.id), p));
        }

        const formatted: Student[] = (rows || []).map((row: any) => {
          const u = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;
          const p = row.projet_id ? projectMap.get(String(row.projet_id)) : null;
          const fullName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Etudiant';
          return {
            id: row.id,
            name: fullName || 'Etudiant',
            email: u?.email || '',
            cne: row.cne || 'N/A',
            avatar: resolveAvatar(u?.avatar_url, fullName || 'Etudiant'),
            projet_id: row.projet_id || null,
            filiere: row.filiere || p?.domaine || null,
            nom_groupe: p?.nom_groupe || null,
          };
        });

        setStudents(formatted);
        setCurrentPage(1);

        const groupMap = new Map<string, Groupe>();
        for (const s of formatted) {
          const key = s.nom_groupe || s.projet_id || 'Sans groupe';
          if (!groupMap.has(key)) {
            groupMap.set(key, { name: s.nom_groupe || 'Groupe sans nom', filiere: s.filiere || 'Non definie', students: [] });
          }
          groupMap.get(key)?.students.push(s);
        }

        setGroupes(Array.from(groupMap.values()));
        const uniqueFilieres = Array.from(new Set(formatted.map((s) => s.filiere).filter(Boolean))) as string[];
        setFilieres(uniqueFilieres);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredGroupes = useMemo(
    () => groupes.filter((g) => !selectedFiliere || g.filiere === selectedFiliere),
    [groupes, selectedFiliere]
  );

  const filteredStudents = useMemo(() => students.filter((s) => {
    if (filterFiliere && s.filiere !== filterFiliere) return false;
    if (filterStatus === 'active' && !s.nom_groupe) return false;
    if (filterStatus === 'pending' && s.nom_groupe) return false;
    return true;
  }), [students, filterFiliere, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(
    () => filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredStudents, currentPage]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#faf9f6] p-5 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">Student Management</h1>
          <p className="mt-0.5 text-sm text-[#7f7664]">Manage enrollments, group assignments, and progress tracking.</p>
        </div>
        {/* Segmented toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-transparent bg-[#f4f3f1] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'students' ? 'bg-white text-[#1a1c1a] shadow-sm' : 'text-[#7f7664] hover:text-[#1a1c1a]'}`}
          >
            <User size={14} /> Students
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'groups' ? 'bg-white text-[#1a1c1a] shadow-sm' : 'text-[#7f7664] hover:text-[#1a1c1a]'}`}
          >
            <Users size={14} /> Groups
          </button>
        </div>
      </header>

      {/* Banners */}
      {loading && <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#f4f3f1] px-4 py-2 text-sm text-[#4d4636]">Chargement des etudiants...</div>}
      {!loading && error && <div className="mb-3 shrink-0 rounded-2xl border border-[#fecaca] bg-[#ffdad6] px-4 py-2 text-sm text-[#ba1a1a]">{error}</div>}

      {/* ── STUDENTS TAB ── */}
      {activeTab === 'students' && (
        <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_4px_16px_rgba(118,91,0,0.06)]">

          {/* Table header */}
          <div className="shrink-0 flex items-center justify-between border-b border-transparent px-5 py-3">
            <h2 className="font-semibold text-[#1a1c1a]">All Students</h2>
            <div className="relative flex items-center gap-2" ref={filterRef}>
              <button
                ref={filterBtnRef}
                type="button"
                onClick={() => {
                  if (!filterOpen && filterBtnRef.current) {
                    const r = filterBtnRef.current.getBoundingClientRect();
                    setFilterPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
                  }
                  setFilterOpen((o) => !o);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${filterOpen || filterFiliere || filterStatus !== 'all' ? 'border-[#765b00] bg-[#ffd464]/20 text-[#765b00]' : 'border-transparent text-[#7f7664] hover:bg-[#f4f3f1]'}`}
              >
                <Filter size={15} />
              </button>

              {filterOpen && (
                <div
                  className="fixed z-50 w-56 rounded-2xl border border-[#f4f3f1] bg-white p-4 shadow-[0_8px_24px_rgba(118,91,0,0.12)]"
                  style={{ top: filterPos.top, right: filterPos.right }}
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Filiere</p>
                  <div className="relative mb-4">
                    <button
                      type="button"
                      onClick={() => setFiliereDropdownOpen((o) => !o)}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm text-[#4d4636] outline-none transition ${filiereDropdownOpen ? 'border-[#765b00] ring-2 ring-[#765b00]/20' : 'border-[#e8e3da]'}`}
                    >
                      <span className="truncate pr-2">{filterFiliere || 'All'}</span>
                      <ChevronDown size={14} className={`shrink-0 text-[#7f7664] transition-transform ${filiereDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {filiereDropdownOpen && (
                      <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#e8e3da] bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${!filterFiliere ? 'bg-[#765b00] text-white font-semibold' : 'text-[#4d4636] hover:bg-[#f4f3f1]'}`}
                          onClick={() => { setFilterFiliere(''); setCurrentPage(1); setFiliereDropdownOpen(false); }}
                        >
                          All
                        </button>
                        {filieres.map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${filterFiliere === f ? 'bg-[#765b00] text-white font-semibold' : 'text-[#4d4636] hover:bg-[#f4f3f1]'}`}
                            onClick={() => { setFilterFiliere(f); setCurrentPage(1); setFiliereDropdownOpen(false); }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#7f7664]">Status</p>
                  <div className="mb-2 flex flex-col gap-1">
                    {(['all', 'active', 'pending'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                        className={`rounded-lg px-3 py-2 text-left text-sm font-semibold capitalize transition ${filterStatus === s ? 'bg-[#765b00] text-white' : 'text-[#4d4636] hover:bg-[#f4f3f1]'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {(filterFiliere || filterStatus !== 'all') && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => { setFilterFiliere(''); setFilterStatus('all'); setCurrentPage(1); }}
                        className="text-sm font-semibold text-[#ba1a1a] transition hover:text-[#901313]"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {students.length === 0 && !loading && (
              <p className="py-12 text-center text-sm text-[#7f7664]">Aucun etudiant trouve.</p>
            )}
            {students.length > 0 && (
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead className="sticky top-0 bg-[#f4f3f1]">
                  <tr>
                    {['STUDENT', 'CNE', 'FILIERE', 'GROUPE', 'STATUS', ''].map((h) => (
                      <th key={h} className="border-b border-transparent px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#7f7664]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, i) => {
                    const isActive = !!s.nom_groupe;
                    return (
                      <tr key={s.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#faf9f6]'} hover:bg-[#ffd464]/10 transition-colors`}>
                        <td className="border-b border-transparent px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={s.avatar} alt={s.name} className="h-9 w-9 shrink-0 rounded-full border border-transparent object-cover" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1a1c1a]">{s.name}</p>
                              <p className="truncate text-xs text-[#7f7664]">{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-transparent px-4 py-3 text-sm text-[#4d4636]">{s.cne}</td>
                        <td className="border-b border-transparent px-4 py-3">
                          <span className="rounded-md bg-[#f4f3f1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4d4636]">
                            {s.filiere || 'N/A'}
                          </span>
                        </td>
                        <td className="border-b border-transparent px-4 py-3 text-sm text-[#4d4636]">
                          <span className="block truncate">{s.nom_groupe || 'Sans groupe'}</span>
                        </td>
                        <td className="border-b border-transparent px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: isActive ? '#10B981' : '#f59e0b' }}>
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isActive ? '#10B981' : '#f59e0b' }} />
                            {isActive ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="border-b border-transparent px-4 py-3">
                          
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination footer */}
          <div className="shrink-0 flex items-center justify-between border-t border-transparent px-5 py-3">
            <p className="text-sm text-[#7f7664]">Showing {paginatedStudents.length} of {filteredStudents.length} students</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] disabled:opacity-40">
                ‹
              </button>
              <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#7f7664] transition hover:bg-[#f4f3f1] disabled:opacity-40">
                ›
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === 'groups' && (
        <section className="flex-1 min-h-0 overflow-y-auto">
          {filieres.length > 0 && (
            <div className="mb-4 shrink-0">
              <select
                className="rounded-xl border border-transparent bg-white px-3 py-2 text-sm text-[#4d4636] outline-none focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/20 [&>option]:bg-white [&>option:checked]:bg-[#765b00] [&>option:checked]:text-white"
                value={selectedFiliere}
                onChange={(e) => setSelectedFiliere(e.target.value)}
              >
                <option value="">All Filieres</option>
                {filieres.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {filteredGroupes.length === 0 && !loading && (
            <p className="py-12 text-center text-sm text-[#7f7664]">Aucun groupe trouve.</p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGroupes.map((g) => (
              <div key={g.name} className="flex flex-col rounded-2xl border border-transparent bg-white p-5 shadow-[0_4px_16px_rgba(118,91,0,0.06)]">
                <div className="mb-2 flex items-start justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#7f7664]">{g.filiere}</p>
                  <span className="rounded-full bg-[#ffd464] px-2.5 py-0.5 text-xs font-bold text-[#594400]">
                    {g.students.length} Members
                  </span>
                </div>

                <h3 className="mb-4 text-lg font-bold text-[#1a1c1a]">{g.name}</h3>

                {/* Overlapping avatars */}
                <div className="mt-auto flex items-center">
                  <div className="flex -space-x-2">
                    {g.students.slice(0, 4).map((s) => (
                      <img
                        key={s.id}
                        src={s.avatar}
                        alt={s.name}
                        title={s.name}
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                    {g.students.length > 4 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#f4f3f1] text-xs font-bold text-[#4d4636]">
                        +{g.students.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminMembers;
