import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Download, Trash2 } from 'lucide-react';
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

  // Modal state
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
        const candidates = [e.utilisateur_id, e.user_id, e.auth_user_id]
          .filter((value) => typeof value === 'string' && value.length > 0) as string[];
        candidates.forEach((c) => { encadrantByUserId.set(c, encadrantId); });
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
          const relatedProject = projects.find((p) => p.encadrant_id === u.id || (encadrantId ? p.encadrant_id === encadrantId : false));
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
      console.error('Erreur chargement users admin:', err);
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

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Create and manage student and teacher accounts.</p>
        </div>
        <div className="flex items-center gap-3 justify-end w-full md:w-auto">
          <button
            type="button"
            className="bg-white text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm text-sm disabled:opacity-60"
            onClick={handleExportExcel}
            disabled={exportLoading}
          >
            <Download size={16} />
            {exportLoading ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            type="button"
            className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg text-sm"
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

          {/* Add User Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm overflow-y-auto p-4 sm:p-6">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl relative animate-fadeIn max-h-[92vh] flex flex-col overflow-hidden my-4">
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <div className="px-8 pt-8 pb-4 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Creer un utilisateur</h2>
                </div>
                <form className="flex-1 overflow-y-auto px-8 py-6 space-y-4" onSubmit={handleCreateUser}>
                  {createError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {createError}
                    </div>
                  )}
                  {createSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      {createSuccess}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-1">Role</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    >
                      <option value="ADMINISTRATEUR">Admin</option>
                      <option value="ENCADRANT">Encadrant</option>
                      <option value="ETUDIANT">Etudiant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nom</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.nom}
                      onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold mb-1">Prenom</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={form.prenom}
                        onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold mb-1">Numero de telephone</label>
                      <input
                        type="tel"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Mot de passe</label>
                    <input
                      type="password"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                    />
                  </div>

                  {form.role === 'ADMINISTRATEUR' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Nom organisation</label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.nomOrganisation}
                          onChange={e => setForm(f => ({ ...f, nomOrganisation: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Niveau acces</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          value={form.niveauAcces}
                          onChange={e => setForm(f => ({ ...f, niveauAcces: e.target.value }))}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </div>
                    </>
                  )}

                  {form.role === 'ENCADRANT' && (
                    <>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Grade</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.grade}
                            onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Specialite</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.specialite}
                            onChange={e => setForm(f => ({ ...f, specialite: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Bureau</label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.bureau}
                          onChange={e => setForm(f => ({ ...f, bureau: e.target.value }))}
                          required
                        />
                      </div>
                    </>
                  )}

                  {form.role === 'ETUDIANT' && (
                    <>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Numero etudiant</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.numeroEtudiant}
                            onChange={e => setForm(f => ({ ...f, numeroEtudiant: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Niveau</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.niveau}
                            onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Filiere</label>
                          <input
                            type="text"
                            list="filiere-options"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.filiere}
                            onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}
                            required
                          />
                          <datalist id="filiere-options">
                            {filieres.map(f => <option key={f} value={f} />)}
                          </datalist>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Titre profil</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.titreProfil}
                            onChange={e => setForm(f => ({ ...f, titreProfil: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">CNE</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.cne}
                            onChange={e => setForm(f => ({ ...f, cne: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">CIN</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.cin}
                            onChange={e => setForm(f => ({ ...f, cin: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Competences (separees par virgule)</label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.competences}
                          onChange={e => setForm(f => ({ ...f, competences: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">GitHub URL</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.githubUrl}
                            onChange={e => setForm(f => ({ ...f, githubUrl: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">LinkedIn URL</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.linkedinUrl}
                            onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Portfolio URL</label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.portfolioUrl}
                          onChange={e => setForm(f => ({ ...f, portfolioUrl: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Nom du groupe</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            value={form.projetId ? (projets.find((p) => p.id === form.projetId)?.nom_groupe || '') : ''}
                            onChange={e => {
                              const selected = projets.find((p) => p.nom_groupe === e.target.value);
                              setForm(f => ({ ...f, projetId: selected?.id || '' }));
                            }}
                          >
                            <option value="">Choisir...</option>
                            {groupes.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Nom du projet</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            value={form.projetId}
                            onChange={e => setForm(f => ({ ...f, projetId: e.target.value }))}
                          >
                            <option value="">Choisir...</option>
                            {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="sticky bottom-0 bg-white pt-4 pb-1 flex justify-end gap-2 border-t border-gray-100 mt-6">
                    <button
                      type="button"
                      className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                      onClick={() => setShowAddModal(false)}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow disabled:opacity-50"
                      disabled={createLoading}
                    >
                      {createLoading ? 'Creation...' : 'Creer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </header>

      {loading && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Chargement des utilisateurs depuis la base de donnees...
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!showAddModal && createError && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {createError}
        </div>
      )}

      {!showAddModal && createSuccess && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
          {createSuccess}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-bottom border-gray-100">
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Prénom</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Rôle</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Téléphone</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Filière</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom du groupe</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom du projet</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                  Aucun utilisateur trouve.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-5 font-bold text-gray-900">{row.nom}</td>
                <td className="px-4 py-5 text-gray-900">{row.prenom}</td>
                <td className="px-4 py-5">
                  {row.role === 'ADMINISTRATEUR' && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Admin</span>
                  )}
                  {row.role === 'ENCADRANT' && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Encadrant</span>
                  )}
                  {row.role === 'ETUDIANT' && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Etudiant</span>
                  )}
                </td>
                <td className="px-4 py-5 text-gray-900">{row.telephone}</td>
                <td className="px-4 py-5 text-gray-900">{row.email}</td>
                <td className="px-4 py-5 text-gray-900">{row.filiere}</td>
                <td className="px-4 py-5 text-gray-900">{row.groupe}</td>
                <td className="px-4 py-5 text-gray-900">{row.projet}</td>
                <td className="px-4 py-5 text-right">
                  <button
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Supprimer"
                    onClick={() => setDeleteConfirmId(row.id)}
                    disabled={deleteLoading}
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-4 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-gray-600 text-sm">Cette action est irreversible. L'utilisateur sera supprime definitivement.</p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteLoading}
              >
                Annuler
              </button>
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow disabled:opacity-50"
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
