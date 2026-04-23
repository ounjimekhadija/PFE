import React, { useEffect, useMemo, useState } from 'react';
import { Download, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

interface DbUser {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  role: string | null;
}

interface DbStudent {
  id: string;
  filiere: string | null;
  projet_id: string | null;
}

interface DbProject {
  id: string;
  titre: string | null;
  nom_groupe: string | null;
  domaine: string | null;
  encadrant_id: string | null;
}

interface TableRow {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  role: string;
  filiere: string;
  groupe: string;
  projet: string;
}

interface ProjectOption {
  id: string;
  titre: string;
  nom_groupe: string;
  domaine: string;
}

const toText = (value: string | null | undefined, fallback = 'N/A'): string => {
  const v = value?.trim();
  return v ? v : fallback;
};

const roleBadgeClass = (role: string): string => {
  if (role === 'ADMINISTRATEUR') return 'bg-[#EEF2FF] text-[#4338CA]';
  if (role === 'ENCADRANT') return 'bg-[#E0F2FE] text-[#075985]';
  return 'bg-[#DCFCE7] text-[#166534]';
};

const roleLabel = (role: string): string => {
  if (role === 'ADMINISTRATEUR') return 'Admin';
  if (role === 'ENCADRANT') return 'Encadrant';
  return 'Etudiant';
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000';

const AdminUsers: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    role: 'ENCADRANT',
    nom: '',
    prenom: '',
    phone: '',
    email: '',
    password: '',
    nomOrganisation: '',
    niveauAcces: 'ADMIN',
    grade: '',
    specialite: '',
    bureau: '',
    numeroEtudiant: '',
    cne: '',
    cin: '',
    niveau: '',
    filiere: '',
    titreProfil: '',
    competences: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    projetId: '',
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, studentsRes, projectsRes, encadrantsRes] = await Promise.all([
        supabase.from('utilisateurs').select('id, nom, prenom, telephone, email, role'),
        supabase.from('etudiants').select('id, filiere, projet_id'),
        supabase.from('projets').select('id, titre, nom_groupe, domaine, encadrant_id'),
        supabase.from('encadrants').select('*'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (encadrantsRes.error) throw encadrantsRes.error;

      const users = (usersRes.data || []) as DbUser[];
      const students = (studentsRes.data || []) as DbStudent[];
      const projects = (projectsRes.data || []) as DbProject[];
      const encadrants = (encadrantsRes.data || []) as Array<Record<string, unknown>>;

      const studentById = new Map<string, DbStudent>();
      students.forEach((s) => studentById.set(String(s.id), s));

      const projectById = new Map<string, DbProject>();
      projects.forEach((p) => projectById.set(String(p.id), p));

      setProjectOptions(
        projects.map((p) => ({
          id: String(p.id),
          titre: toText(p.titre),
          nom_groupe: toText(p.nom_groupe),
          domaine: toText(p.domaine),
        }))
      );

      const encadrantByUserId = new Map<string, string>();
      encadrants.forEach((e) => {
        const encadrantId = String(e.id || '');
        if (!encadrantId) return;
        const candidates = [e.utilisateur_id, e.user_id, e.auth_user_id].filter(
          (value) => typeof value === 'string' && value.length > 0
        ) as string[];
        candidates.forEach((c) => {
          encadrantByUserId.set(c, encadrantId);
        });
      });

      const adminRows: TableRow[] = users
        .filter((u) => u.role === 'ADMINISTRATEUR')
        .map((u) => ({
          id: String(u.id),
          nom: toText(u.nom),
          prenom: toText(u.prenom),
          telephone: toText(u.telephone),
          email: toText(u.email),
          role: 'ADMINISTRATEUR',
          filiere: 'N/A',
          groupe: 'N/A',
          projet: 'N/A',
        }));

      const studentRows: TableRow[] = users
        .filter((u) => u.role === 'ETUDIANT')
        .map((u) => {
          const student = studentById.get(String(u.id));
          const project = student?.projet_id ? projectById.get(String(student.projet_id)) : undefined;
          return {
            id: String(u.id),
            nom: toText(u.nom),
            prenom: toText(u.prenom),
            telephone: toText(u.telephone),
            email: toText(u.email),
            role: 'ETUDIANT',
            filiere: toText(student?.filiere || project?.domaine),
            groupe: toText(project?.nom_groupe),
            projet: toText(project?.titre),
          };
        });

      const professorRows: TableRow[] = users
        .filter((u) => u.role === 'ENCADRANT')
        .map((u) => {
          const encadrantId = encadrantByUserId.get(String(u.id));
          const relatedProject = projects.find(
            (p) => p.encadrant_id === u.id || (encadrantId ? p.encadrant_id === encadrantId : false)
          );
          return {
            id: String(u.id),
            nom: toText(u.nom),
            prenom: toText(u.prenom),
            telephone: toText(u.telephone),
            email: toText(u.email),
            role: 'ENCADRANT',
            filiere: toText(relatedProject?.domaine),
            groupe: toText(relatedProject?.nom_groupe),
            projet: toText(relatedProject?.titre),
          };
        });

      const mergedRows = [...adminRows, ...professorRows, ...studentRows].sort((a, b) => {
        const byNom = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
        if (byNom !== 0) return byNom;
        return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
      });

      setRows(mergedRows);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur de chargement des utilisateurs.';
      setError(message);
      setRows([]);
      setProjectOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setForm({
      role: 'ENCADRANT',
      nom: '',
      prenom: '',
      phone: '',
      email: '',
      password: '',
      nomOrganisation: '',
      niveauAcces: 'ADMIN',
      grade: '',
      specialite: '',
      bureau: '',
      numeroEtudiant: '',
      cne: '',
      cin: '',
      niveau: '',
      filiere: '',
      titreProfil: '',
      competences: '',
      githubUrl: '',
      linkedinUrl: '',
      portfolioUrl: '',
      projetId: '',
    });
  };

  const getAccessToken = async (): Promise<string> => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;

    if (!token) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error('Session invalide. Reconnectez-vous.');
      token = refreshed.session?.access_token;
    }

    if (!token) throw new Error('Session invalide. Reconnectez-vous.');
    return token;
  };

  const handleDeleteUser = async (id: string) => {
    try {
      setDeleteLoading(true);
      setCreateError(null);
      setCreateSuccess(null);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Suppression echouee.');
      setCreateSuccess('Utilisateur supprime avec succes.');
      setDeleteConfirmId(null);
      await fetchUsers();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la suppression.';
      setCreateError(message);
      setDeleteConfirmId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const postCreateUser = async (token: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error || 'Creation utilisateur echouee.');
    return body;
  };

  const handleExportExcel = async () => {
    try {
      setCreateError(null);
      setCreateSuccess(null);
      setExportLoading(true);

      if (rows.length === 0) throw new Error('Aucune donnee a exporter.');

      const data = rows.map((row) => ({
        Nom: row.nom,
        Prénom: row.prenom,
        Rôle: row.role,
        Téléphone: row.telephone,
        Email: row.email,
        Filière: row.filiere,
        'Nom du groupe': row.groupe,
        'Nom du projet': row.projet,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Utilisateurs');

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `users_export_${stamp}.xlsx`);

      setCreateSuccess('Export Excel reussi.');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : "Erreur pendant l'export Excel.";
      setCreateError(message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim() || !form.password.trim()) {
      setCreateError('Nom, prenom, email et mot de passe sont obligatoires.');
      return;
    }

    if (form.role === 'ADMINISTRATEUR' && (!form.nomOrganisation.trim() || !form.niveauAcces.trim())) {
      setCreateError("Pour Admin: organisation et niveau d'acces sont obligatoires.");
      return;
    }

    if (form.role === 'ENCADRANT' && (!form.grade.trim() || !form.specialite.trim() || !form.bureau.trim())) {
      setCreateError('Pour Encadrant: grade, specialite et bureau sont obligatoires.');
      return;
    }

    if (form.role === 'ETUDIANT' && (!form.numeroEtudiant.trim() || !form.niveau.trim() || !form.filiere.trim())) {
      setCreateError('Pour Etudiant: numero etudiant, niveau et filiere sont obligatoires.');
      return;
    }

    try {
      setCreateLoading(true);
      const token = await getAccessToken();
      await postCreateUser(token, {
        role: form.role,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        password: form.password,
        telephone: form.phone,
        nomOrganisation: form.role === 'ADMINISTRATEUR' ? form.nomOrganisation : null,
        niveauAcces: form.role === 'ADMINISTRATEUR' ? form.niveauAcces : null,
        grade: form.role === 'ENCADRANT' ? form.grade : null,
        specialite: form.role === 'ENCADRANT' ? form.specialite : null,
        bureau: form.role === 'ENCADRANT' ? form.bureau : null,
        numeroEtudiant: form.role === 'ETUDIANT' ? form.numeroEtudiant : null,
        cne: form.role === 'ETUDIANT' ? form.cne : null,
        cin: form.role === 'ETUDIANT' ? form.cin : null,
        niveau: form.role === 'ETUDIANT' ? form.niveau : null,
        filiere: form.role === 'ETUDIANT' ? form.filiere : null,
        titreProfil: form.role === 'ETUDIANT' ? form.titreProfil : null,
        competences: form.role === 'ETUDIANT' ? form.competences : null,
        githubUrl: form.role === 'ETUDIANT' ? form.githubUrl : null,
        linkedinUrl: form.role === 'ETUDIANT' ? form.linkedinUrl : null,
        portfolioUrl: form.role === 'ETUDIANT' ? form.portfolioUrl : null,
        projetId: form.role === 'ETUDIANT' && form.projetId ? form.projetId : null,
      });

      setCreateSuccess('Utilisateur cree avec succes.');
      await fetchUsers();
      setShowAddModal(false);
      resetForm();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Erreur lors de la creation utilisateur.';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const filieres = useMemo(
    () => Array.from(new Set(projectOptions.map((p) => p.domaine).filter((d) => d !== 'N/A'))),
    [projectOptions]
  );
  const groupes = useMemo(
    () => Array.from(new Set(projectOptions.map((p) => p.nom_groupe).filter((g) => g !== 'N/A'))),
    [projectOptions]
  );
  const projets = useMemo(() => projectOptions, [projectOptions]);

  const stats = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) => r.role === 'ADMINISTRATEUR').length;
    const encadrants = rows.filter((r) => r.role === 'ENCADRANT').length;
    const etudiants = rows.filter((r) => r.role === 'ETUDIANT').length;
    return { total, admins, encadrants, etudiants };
  }, [rows]);

  const recentUpdates = useMemo(
    () => rows.slice(0, 5).map((r) => `${r.prenom} ${r.nom} · ${roleLabel(r.role)} · ${r.projet === 'N/A' ? 'No project yet' : r.projet}`),
    [rows]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFF] p-6 md:p-8 text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="mt-2 text-sm text-[#64748B]">Create and manage student and teacher accounts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#334155] shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition hover:border-[#CBD5E1]"
            onClick={handleExportExcel}
            disabled={exportLoading}
          >
            <Download size={16} />
            {exportLoading ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] transition hover:bg-[#4F46E5]"
            onClick={() => {
              setCreateError(null);
              setCreateSuccess(null);
              resetForm();
              setShowAddModal(true);
            }}
          >
            <UserPlus size={16} />
            Add User
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        {[
          { label: 'Total Users', value: stats.total },
          { label: 'Admins', value: stats.admins },
          { label: 'Encadrants', value: stats.encadrants },
          { label: 'Etudiants', value: stats.etudiants },
        ].map((item) => (
          <article key={item.label} className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
            <p className="text-sm text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-[2rem] font-bold leading-none text-[#0F172A]">{item.value}</p>
          </article>
        ))}
      </section>

      {loading && (
        <div className="mb-4 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
          Chargement des utilisateurs depuis la base de donnees...
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</div>
      )}

      {!showAddModal && createError && (
        <div className="mb-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{createError}</div>
      )}

      {!showAddModal && createSuccess && (
        <div className="mb-4 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]">{createSuccess}</div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,360px]">
        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0]">
            <table className="hidden min-w-[980px] w-full border-collapse md:table">
              <thead className="bg-[#F8FAFF]">
                <tr>
                  {['Nom', 'Prenom', 'Role', 'Telephone', 'Email', 'Filiere', 'Groupe', 'Projet', 'Actions'].map((h) => (
                    <th key={h} className="border-b border-[#E2E8F0] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#64748B]">
                      Aucun utilisateur trouve.
                    </td>
                  </tr>
                )}

                {rows.map((row, index) => (
                  <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFF]'} hover:bg-[#EEF2FF]/40`}>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 font-semibold text-[#0F172A]">{row.nom}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#0F172A]">{row.prenom}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(row.role)}`}>
                        {roleLabel(row.role)}
                      </span>
                    </td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{row.telephone}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{row.email}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{row.filiere}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{row.groupe}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3 text-[#334155]">{row.projet}</td>
                    <td className="border-b border-[#EEF2F7] px-4 py-3">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition hover:border-[#FCA5A5] hover:text-[#DC2626] disabled:opacity-50"
                        title="Supprimer"
                        onClick={() => setDeleteConfirmId(row.id)}
                        disabled={deleteLoading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-3 p-3 md:hidden">
              {rows.length === 0 && !loading && <p className="py-6 text-center text-sm text-[#64748B]">Aucun utilisateur trouve.</p>}
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{row.prenom} {row.nom}</p>
                      <p className="text-xs text-[#64748B]">{row.email}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(row.role)}`}>
                      {roleLabel(row.role)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#64748B]">
                    <p>Tel: {row.telephone}</p>
                    <p>Filiere: {row.filiere}</p>
                    <p>Groupe: {row.groupe}</p>
                    <p>Projet: {row.projet}</p>
                  </div>
                  <div className="mt-3">
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition hover:border-[#FCA5A5] hover:text-[#DC2626] disabled:opacity-50"
                      title="Supprimer"
                      onClick={() => setDeleteConfirmId(row.id)}
                      disabled={deleteLoading}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
          <h3 className="text-2xl font-semibold text-[#0F172A]">Weekly Team Sync</h3>
          <p className="mt-1 text-sm text-[#64748B]">Recent user updates and account assignments.</p>
          <div className="mt-4 space-y-3">
            {recentUpdates.length === 0 && <p className="text-sm text-[#64748B]">No recent updates.</p>}
            {recentUpdates.map((item, idx) => (
              <div key={`${item}-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3 text-sm text-[#334155]">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
          <div className="my-4 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(2,6,23,0.25)]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#0F172A]">Creer un utilisateur</h2>
              <button className="text-[#64748B]" onClick={() => setShowAddModal(false)} aria-label="Close">
                &times;
              </button>
            </div>

            <form className="max-h-[80vh] overflow-y-auto px-6 py-5" onSubmit={handleCreateUser}>
              <div className="space-y-4">
                {createError && <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{createError}</div>}
                {createSuccess && <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm text-[#15803D]">{createSuccess}</div>}

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Role</label>
                  <select
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    <option value="ADMINISTRATEUR">Admin</option>
                    <option value="ENCADRANT">Encadrant</option>
                    <option value="ETUDIANT">Etudiant</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Nom</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Prenom</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                      value={form.prenom}
                      onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Numero de telephone</label>
                    <input
                      type="tel"
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Email</label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Mot de passe</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>

                {form.role === 'ADMINISTRATEUR' && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Nom organisation</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                        value={form.nomOrganisation}
                        onChange={(e) => setForm((f) => ({ ...f, nomOrganisation: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Niveau acces</label>
                      <select
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                        value={form.niveauAcces}
                        onChange={(e) => setForm((f) => ({ ...f, niveauAcces: e.target.value }))}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </div>
                  </>
                )}

                {form.role === 'ENCADRANT' && (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Grade</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.grade}
                          onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Specialite</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.specialite}
                          onChange={(e) => setForm((f) => ({ ...f, specialite: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Bureau</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                        value={form.bureau}
                        onChange={(e) => setForm((f) => ({ ...f, bureau: e.target.value }))}
                        required
                      />
                    </div>
                  </>
                )}

                {form.role === 'ETUDIANT' && (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Numero etudiant</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.numeroEtudiant}
                          onChange={(e) => setForm((f) => ({ ...f, numeroEtudiant: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Niveau</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.niveau}
                          onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Filiere</label>
                        <input
                          type="text"
                          list="filiere-options"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.filiere}
                          onChange={(e) => setForm((f) => ({ ...f, filiere: e.target.value }))}
                          required
                        />
                        <datalist id="filiere-options">
                          {filieres.map((f) => (
                            <option key={f} value={f} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Titre profil</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.titreProfil}
                          onChange={(e) => setForm((f) => ({ ...f, titreProfil: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">CNE</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.cne}
                          onChange={(e) => setForm((f) => ({ ...f, cne: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">CIN</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.cin}
                          onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Competences (separees par virgule)</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                        value={form.competences}
                        onChange={(e) => setForm((f) => ({ ...f, competences: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">GitHub URL</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.githubUrl}
                          onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">LinkedIn URL</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.linkedinUrl}
                          onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Portfolio URL</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                        value={form.portfolioUrl}
                        onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Nom du groupe</label>
                        <select
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.projetId ? projets.find((p) => p.id === form.projetId)?.nom_groupe || '' : ''}
                          onChange={(e) => {
                            const selected = projets.find((p) => p.nom_groupe === e.target.value);
                            setForm((f) => ({ ...f, projetId: selected?.id || '' }));
                          }}
                        >
                          <option value="">Choisir...</option>
                          {groupes.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#334155]">Nom du projet</label>
                        <select
                          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                          value={form.projetId}
                          onChange={(e) => setForm((f) => ({ ...f, projetId: e.target.value }))}
                        >
                          <option value="">Choisir...</option>
                          {projets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.titre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-[#E2E8F0] bg-white pt-4">
                <button
                  type="button"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-2 text-sm font-semibold text-[#334155]"
                  onClick={() => setShowAddModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#6366F1] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] disabled:opacity-50"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creation...' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_20px_50px_rgba(2,6,23,0.25)]">
            <h2 className="text-lg font-semibold text-[#0F172A]">Confirmer la suppression</h2>
            <p className="mt-2 text-sm text-[#64748B]">Cette action est irreversible. L'utilisateur sera supprime definitivement.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155]"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteLoading}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => handleDeleteUser(deleteConfirmId)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
