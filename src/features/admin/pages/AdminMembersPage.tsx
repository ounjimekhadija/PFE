import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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

        const { data: rows, error: fetchError } = await supabase
          .from('etudiants')
          .select(`
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

        // Fetch projects separately to avoid FK relationship issues
        const projectIds = [...new Set((rows || []).map((r: any) => r.projet_id).filter(Boolean))];
        const projectMap = new Map<string, { nom_groupe: string; domaine: string }>();
        if (projectIds.length > 0) {
          const { data: projets } = await supabase
            .from('projets')
            .select('id, nom_groupe, domaine')
            .in('id', projectIds);
          (projets || []).forEach((p: any) => projectMap.set(String(p.id), p));
        }

        const formatted: Student[] = (rows || []).map((row: any) => {
          const u = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;
          const p = row.projet_id ? projectMap.get(String(row.projet_id)) : null;
          const fullName = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Étudiant';
          return {
            id: row.id,
            name: fullName || 'Étudiant',
            cne: row.cne || 'N/A',
            avatar: resolveAvatar(u?.avatar_url, fullName || 'Étudiant'),
            projet_id: row.projet_id || null,
            filiere: row.filiere || p?.domaine || null,
            nom_groupe: p?.nom_groupe || null,
          };
        });

        setStudents(formatted);

        // Build groups from project data
        const groupMap = new Map<string, Groupe>();
        for (const s of formatted) {
          const key = s.nom_groupe || s.projet_id || 'Sans groupe';
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              name: s.nom_groupe || 'Groupe sans nom',
              filiere: s.filiere || 'Non définie',
              students: [],
            });
          }
          groupMap.get(key)!.students.push(s);
        }
        setGroupes(Array.from(groupMap.values()));

        const uniqueFilieres = Array.from(new Set(formatted.map(s => s.filiere).filter(Boolean))) as string[];
        setFilieres(uniqueFilieres);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredGroupes = groupes.filter(g => !selectedFiliere || g.filiere === selectedFiliere);

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-auto">
          <h1 className="text-3xl font-bold text-gray-900">Student List</h1>
          <p className="text-gray-500 mt-1">View and manage all students enrolled in the platform.</p>
        </div>
        <div className="flex w-full md:w-auto justify-end">
          <button
            className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg text-sm md:text-base"
            onClick={() => setShowGroupes(g => !g)}
          >
            Les Groupes
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500 mb-4">Chargement des étudiants...</p>}
      {!loading && error && <p className="text-sm text-red-500 mb-4">Erreur: {error}</p>}

      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8">
        {!showGroupes ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {!loading && students.length === 0 && (
              <p className="text-sm text-gray-400 col-span-3">Aucun étudiant trouvé.</p>
            )}
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <img src={s.avatar} alt={s.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500">CNE: {s.cne}</p>
                </div>
                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {filieres.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative w-7 h-7 flex items-center justify-end">
                  <select
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    value={selectedFiliere}
                    onChange={e => setSelectedFiliere(e.target.value)}
                  >
                    <option value="">Toutes</option>
                    {filieres.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <svg className="w-5 h-5 text-gray-700 z-0 pointer-events-none mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
            {!loading && filteredGroupes.length === 0 && (
              <p className="text-sm text-gray-400">Aucun groupe trouvé.</p>
            )}
            {filteredGroupes.map((g) => (
              <div key={g.name}>
                <h3 className="text-lg font-bold text-indigo-600 mb-3">
                  {g.name} <span className="text-xs text-gray-400 font-normal">({g.filiere})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.students.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <img src={s.avatar} alt={s.name} className="w-12 h-12 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">CNE: {s.cne}</p>
                      </div>
                      <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMembers;
