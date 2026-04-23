import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Student {
  id: string;
  name: string;
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

const AdminMembers: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [filieres, setFilieres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGroupes, setShowGroupes] = useState(false);
  const [selectedFiliere, setSelectedFiliere] = useState('');

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
            id,
            cne,
            filiere,
            projet_id,
            utilisateurs (
              nom,
              prenom,
              avatar_url
            )
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
            cne: row.cne || 'N/A',
            avatar: resolveAvatar(u?.avatar_url, fullName || 'Etudiant'),
            projet_id: row.projet_id || null,
            filiere: row.filiere || p?.domaine || null,
            nom_groupe: p?.nom_groupe || null,
          };
        });

        setStudents(formatted);

        const groupMap = new Map<string, Groupe>();
        for (const s of formatted) {
          const key = s.nom_groupe || s.projet_id || 'Sans groupe';
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              name: s.nom_groupe || 'Groupe sans nom',
              filiere: s.filiere || 'Non definie',
              students: [],
            });
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

  const timeline = useMemo(() => {
    if (showGroupes) {
      return filteredGroupes.slice(0, 5).map((g) => `${g.name} · ${g.students.length} student(s) · ${g.filiere}`);
    }
    return students.slice(0, 5).map((s) => `${s.name} joined ${s.nom_groupe || 'No group'} · CNE ${s.cne}`);
  }, [showGroupes, filteredGroupes, students]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFF] p-6 md:p-8 text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Student List</h1>
          <p className="mt-2 text-sm text-[#64748B]">View and manage all students enrolled in the platform.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] transition hover:bg-[#4F46E5]"
          onClick={() => setShowGroupes((g) => !g)}
        >
          <Users size={16} />
          {showGroupes ? 'Voir Etudiants' : 'Voir Groupes'}
        </button>
      </header>

      {loading && <p className="mb-4 text-sm text-[#64748B]">Chargement des etudiants...</p>}
      {!loading && error && <p className="mb-4 text-sm text-[#B91C1C]">Erreur: {error}</p>}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,340px]">
        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          {!showGroupes ? (
            <>
              <div className="mb-4 overflow-x-auto rounded-2xl border border-[#E2E8F0]">
                <table className="hidden min-w-[760px] w-full border-collapse md:table">
                  <thead className="bg-[#F8FAFF]">
                    <tr>
                      {['Etudiant', 'CNE', 'Filiere', 'Groupe', 'Statut'].map((h) => (
                        <th key={h} className="border-b border-[#E2E8F0] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFF]'} hover:bg-[#EEF2FF]/40`}>
                        <td className="border-b border-[#EEF2F7] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={s.avatar} alt={s.name} className="h-10 w-10 rounded-full border border-[#E2E8F0] object-cover" />
                            <span className="font-semibold text-[#0F172A]">{s.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{s.cne}</td>
                        <td className="border-b border-[#EEF2F7] px-4 py-3">
                          <span className="rounded-full bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#075985]">
                            {s.filiere || 'N/A'}
                          </span>
                        </td>
                        <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{s.nom_groupe || 'Sans groupe'}</td>
                        <td className="border-b border-[#EEF2F7] px-4 py-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10B981]">
                            <CheckCircle2 size={16} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-3 p-3 md:hidden">
                  {!loading && students.length === 0 && <p className="text-center text-sm text-[#64748B]">Aucun etudiant trouve.</p>}
                  {students.map((s) => (
                    <div key={s.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                      <div className="flex items-center gap-3">
                        <img src={s.avatar} alt={s.name} className="h-11 w-11 rounded-full border border-[#E2E8F0] object-cover" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#0F172A]">{s.name}</p>
                          <p className="text-xs text-[#64748B]">CNE: {s.cne}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#64748B]">
                        <p>Filiere: {s.filiere || 'N/A'}</p>
                        <p>Groupe: {s.nom_groupe || 'Sans groupe'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              {filieres.length > 0 && (
                <div className="mb-4">
                  <select
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                    value={selectedFiliere}
                    onChange={(e) => setSelectedFiliere(e.target.value)}
                  >
                    <option value="">Toutes les filieres</option>
                    {filieres.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-4">
                {!loading && filteredGroupes.length === 0 && <p className="text-sm text-[#64748B]">Aucun groupe trouve.</p>}
                {filteredGroupes.map((g) => (
                  <div key={g.name} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-[#0F172A]">{g.name}</h3>
                        <p className="text-xs text-[#64748B]">{g.filiere}</p>
                      </div>
                      <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#4338CA]">
                        {g.students.length} students
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {g.students.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                          <img src={s.avatar} alt={s.name} className="h-10 w-10 rounded-full border border-[#E2E8F0] object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0F172A]">{s.name}</p>
                            <p className="text-xs text-[#64748B]">CNE: {s.cne}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          <h3 className="text-2xl font-semibold text-[#0F172A]">Weekly Team Sync</h3>
          <p className="mt-1 text-sm text-[#64748B]">Recent student activity and group updates.</p>
          <div className="mt-4 space-y-3">
            {timeline.length === 0 && <p className="text-sm text-[#64748B]">No updates available.</p>}
            {timeline.map((item, idx) => (
              <div key={`${item}-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3 text-sm text-[#334155]">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default AdminMembers;
