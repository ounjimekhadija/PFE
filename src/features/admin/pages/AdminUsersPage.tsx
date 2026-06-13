import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Filter, GraduationCap, MoreVertical, ShieldCheck, User, UserPlus, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';
import { registerSchema } from '../../../shared/schemas';
import { z } from 'zod';


interface DbUser {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
}

const resolveAvatar = (avatarUrl: string | null | undefined, name: string): string => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&size=64`;
  if (!avatarUrl) return fallback;
  const raw = avatarUrl.trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const clean = raw.replace(/^\/+/, '').replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);
  return data?.publicUrl || fallback;
};

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
  avatar: string;
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
  if (role === 'ADMINISTRATEUR') return 'bg-[#DCEBFA]/40 text-[#172D49]';
  if (role === 'ENCADRANT') return 'bg-[#ECFDF5] text-[#065F46]';
  return 'bg-[#FFF7ED] text-[#9A3412]';
};

const roleLabel = (role: string): string => {
  if (role === 'ADMINISTRATEUR') return 'Admin';
  if (role === 'ENCADRANT') return 'Encadrant';
  return 'Etudiant';
};


const PAGE_SIZE = 10;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrentPage(1); }, [rows]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [form, setForm] = useState({
    role: 'ENCADRANT',
    nom: '',
    prenom: '',
    phone: '',
    email: '',
    password: '',
    nomOrganisation: '',
    // niveauAcces removed
    // grade, specialite, bureau removed
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

  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const roles = [
    { value: 'ADMINISTRATEUR', label: 'Admin' },
    { value: 'ENCADRANT', label: 'Encadrant' },
    { value: 'ETUDIANT', label: 'Etudiant' },
  ];

  // access level removed

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, studentsRes, projectsRes, encadrantsRes] = await Promise.all([
        supabase.from('utilisateurs').select('id, nom, prenom, telephone, email, role, avatar_url'),
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
        .map((u) => {
          const name = `${toText(u.prenom)} ${toText(u.nom)}`.trim();
          return {
            id: String(u.id),
            nom: toText(u.nom),
            prenom: toText(u.prenom),
            telephone: toText(u.telephone),
            email: toText(u.email),
            role: 'ADMINISTRATEUR',
            filiere: 'N/A',
            groupe: 'N/A',
            projet: 'N/A',
            avatar: resolveAvatar(u.avatar_url, name),
          };
        });

      const studentRows: TableRow[] = users
        .filter((u) => u.role === 'ETUDIANT')
        .map((u) => {
          const student = studentById.get(String(u.id));
          const project = student?.projet_id ? projectById.get(String(student.projet_id)) : undefined;
          const name = `${toText(u.prenom)} ${toText(u.nom)}`.trim();
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
            avatar: resolveAvatar(u.avatar_url, name),
          };
        });

      const professorRows: TableRow[] = users
        .filter((u) => u.role === 'ENCADRANT')
        .map((u) => {
          const encadrantId = encadrantByUserId.get(String(u.id));
          const relatedProject = projects.find(
            (p) => p.encadrant_id === u.id || (encadrantId ? p.encadrant_id === encadrantId : false)
          );
          const name = `${toText(u.prenom)} ${toText(u.nom)}`.trim();
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
            avatar: resolveAvatar(u.avatar_url, name),
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
          : 'Error loading users.';
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Utilisateur non authentifié. Reconnectez-vous.');
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error('Session invalide ou expirée. Reconnectez-vous.');
    }

    return session.access_token;
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
      if (!response.ok) throw new Error(body?.error || 'Deletion failed.');
      setCreateSuccess('User successfully deleted.');
      setDeleteConfirmId(null);
      await fetchUsers();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Error during deletion.';
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
    if (!response.ok) throw body;
    return body;
  };

  const handleExportExcel = async () => {
    try {
      setCreateError(null);
      setCreateSuccess(null);
      setExportLoading(true);

      if (rows.length === 0) throw new Error('No data to export.');

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

      setCreateSuccess('Excel export successful.');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : "Error during Excel export.";
      setCreateError(message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const validation = registerSchema.safeParse(form);
    if (!validation.success) {
      const flattenedErrors = validation.error.flatten().fieldErrors;
      setFormErrors(flattenedErrors as Record<string, string[]>);
      setCreateError('Please fix the errors in the form.');
      return;
    }
    setFormErrors({});

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
        // grade, specialite, bureau removed
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

      setCreateSuccess('User successfully created.');
      await fetchUsers();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      // If backend returns field-specific errors (from validate middleware)
      if (err.errors) {
        setFormErrors(err.errors);
        setCreateError('Server validation error.');
      } else {
        const message = err.error || err.message || 'Error creating user.';
        setCreateError(message);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const filieres = useMemo(
    () => Array.from(new Set(projectOptions.map((p) => p.domaine).filter((d) => d !== 'N/A'))),
    [projectOptions]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) => r.role === 'ADMINISTRATEUR').length;
    const encadrants = rows.filter((r) => r.role === 'ENCADRANT').length;
    const etudiants = rows.filter((r) => r.role === 'ETUDIANT').length;
    return { total, admins, encadrants, etudiants };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] p-5 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1a]">User Management</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Oversee your organization's members and their specific roles.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(15,23,42,0.2)] transition hover:bg-[#172D49]"
            onClick={() => { setCreateError(null); setCreateSuccess(null); resetForm(); setShowAddModal(true); }}>
            <UserPlus size={14} />Add User
          </button>
        </div>
      </header>

      {/* Banners */}
      {loading && <div className="mb-3 shrink-0 rounded-2xl border border-transparent bg-[#EEF3F8] px-4 py-2 text-sm text-[#334155]">Loading users...</div>}
      {!loading && error && <div className="mb-3 shrink-0 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm text-[#B91C1C]">{error}</div>}
      {!showAddModal && createError && <div className="mb-3 shrink-0 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm text-[#B91C1C]">{createError}</div>}
      {!showAddModal && createSuccess && <div className="mb-3 shrink-0 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm text-[#15803D]">{createSuccess}</div>}

      {/* Stat Cards */}
      <section className="mb-4 shrink-0 grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL USERS', value: stats.total, icon: Users, trend: `+${Math.max(1, Math.round(stats.total * 0.08))}%` },
          { label: 'ADMINS', value: stats.admins, icon: ShieldCheck, trend: null },
          { label: 'ENCADRANTS', value: stats.encadrants, icon: GraduationCap, trend: null },
          { label: 'ETUDIANTS', value: stats.etudiants, icon: User, trend: null },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#1E3A5F]"><card.icon size={18} /></div>
              {card.trend && <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#10B981]">{card.trend}</span>}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{card.label}</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-[#1a1c1a]">{card.value}</p>
          </article>
        ))}
      </section>

      {/* Directory */}
      <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="shrink-0 flex items-center justify-between border-b border-transparent px-5 py-3">
          <h2 className="font-semibold text-[#1a1c1a]">Directory</h2>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition hover:bg-[#EEF3F8]">
            <Filter size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 && !loading && <p className="py-12 text-center text-sm text-[#64748B]">No users found.</p>}
          {rows.length > 0 && (
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead className="sticky top-0 bg-[#EEF3F8]">
                <tr>
                  {['NOM & PRENOM', 'ROLE', 'CONTACT', 'FILIERE / GROUPE', 'PROJET', 'ACTIONS'].map((h) => (
                    <th key={h} className="border-b border-transparent px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => (
                  <tr key={row.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#DCEBFA]/10 transition-colors`}>
                    <td className="border-b border-transparent px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={row.avatar}
                          alt={`${row.prenom} ${row.nom}`}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1a1c1a]">{row.prenom} {row.nom}</p>
                          <p className="text-xs text-[#64748B]">ID: #{row.id.slice(0, 6)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-transparent px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(row.role)}`}>{roleLabel(row.role)}</span>
                    </td>
                    <td className="border-b border-transparent px-4 py-3">
                      <p className="truncate text-xs text-[#1a1c1a]">{row.email}</p>
                      <p className="text-xs text-[#64748B]">{row.telephone}</p>
                    </td>
                    <td className="border-b border-transparent px-4 py-3">
                      <p className="truncate text-xs text-[#1a1c1a]">{row.filiere}</p>
                      <p className="truncate text-xs text-[#64748B]">{row.groupe}</p>
                    </td>
                    <td className="border-b border-transparent px-4 py-3">
                      <p className="truncate text-sm text-[#1a1c1a]">{row.projet === 'N/A' ? '—' : row.projet}</p>
                    </td>
                    <td className="border-b border-transparent px-4 py-3">
                      <div className="relative" ref={openMenuId === row.id ? menuRef : null}>
                        <button type="button" onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#EEF3F8]">
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === row.id && (
                          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-transparent bg-white shadow-[0_4px_16px_rgba(15,23,42,0.12)]">
                            <button type="button" onClick={() => { setDeleteConfirmId(row.id); setOpenMenuId(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm text-[#ba1a1a] transition hover:bg-[#ffdad6]">
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="shrink-0 flex items-center justify-between border-t border-transparent px-5 py-3">
          <p className="text-sm text-[#64748B]">Showing {paginatedRows.length} of {rows.length} results</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="rounded-xl border border-transparent bg-white px-4 py-1.5 text-sm font-medium text-[#334155] transition hover:border-[#c4b99a] disabled:opacity-40">
              Previous
            </button>
            <span className="text-sm text-[#64748B]">{currentPage} / {totalPages}</span>
            <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="rounded-xl border border-transparent bg-white px-4 py-1.5 text-sm font-medium text-[#334155] transition hover:border-[#c4b99a] disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </section>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-md p-4 transition-all animate-in fade-in duration-300">
          <div className="my-4 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]">
            <div className="flex items-center justify-between border-b border-transparent px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1a1c1a]">Create a user</h2>
              <button className="text-[#64748B]" onClick={() => setShowAddModal(false)} aria-label="Close">
                &times;
              </button>
            </div>

            <form className="max-h-[80vh] overflow-y-auto px-6 py-5" onSubmit={handleCreateUser}>
              <div className="space-y-4">
                {createError && <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{createError}</div>}
                {createSuccess && <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm text-[#15803D]">{createSuccess}</div>}

                <div className="relative" ref={roleDropdownRef}>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Role</label>
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#dcd6c1] bg-white px-3 py-2 text-sm text-[#1a1c1a] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                  >
                    <span>{roles.find(r => r.value === form.role)?.label}</span>
                    <svg className={`h-4 w-4 text-[#64748B] transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showRoleDropdown && (
                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[#dcd6c1] bg-white shadow-[0_10px_25px_rgba(15,23,42,0.1)] transition-all animate-in fade-in slide-in-from-top-1">
                      {roles.map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, role: role.value }));
                            setShowRoleDropdown(false);
                          }}
                          className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors ${form.role === role.value
                            ? 'bg-[#1E3A5F] text-white'
                            : 'text-[#1a1c1a] hover:bg-[#1E3A5F]/5'
                            }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Last name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      required
                    />
                    {formErrors.nom && <p className="mt-1 text-xs text-red-500">{formErrors.nom[0]}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">First name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                      value={form.prenom}
                      onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                      required
                    />
                    {formErrors.prenom && <p className="mt-1 text-xs text-red-500">{formErrors.prenom[0]}</p>}
                  </div>
                </div>

                {form.role !== 'ETUDIANT' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Phone number</label>
                      <input
                        type="tel"
                        className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Email</label>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                      {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email[0]}</p>}
                    </div>
                  </div>
                )}

                {form.role === 'ETUDIANT' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#334155]">Email</label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                    {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email[0]}</p>}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#334155]">Password</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                  />
                  {formErrors.password && <p className="mt-1 text-xs text-red-500">{formErrors.password[0]}</p>}
                </div>

                {form.role === 'ADMINISTRATEUR' && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Organization name</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 [&>option]:bg-white [&>option]:text-[#1a1c1a] [&>option:checked]:bg-[#1E3A5F] [&>option:checked]:text-white [&>option:hover]:bg-[#1a1c1a] [&>option:hover]:text-white" style={{ accentColor: '#1E3A5F' }}
                        value={form.nomOrganisation}
                        onChange={(e) => setForm((f) => ({ ...f, nomOrganisation: e.target.value }))}
                        required
                      />
                    </div>
                    {/* Niveau acces removed */}
                  </>
                )}

                {/* Encadrant-specific fields removed */}

                {form.role === 'ETUDIANT' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">Student number</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                        value={form.numeroEtudiant}
                        onChange={(e) => setForm((f) => ({ ...f, numeroEtudiant: e.target.value }))}
                        required
                      />
                      {formErrors.numeroEtudiant && <p className="mt-1 text-xs text-red-500">{formErrors.numeroEtudiant[0]}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#334155]">CIN</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-3 py-2 text-sm text-[#1a1c1a] outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                        value={form.cin}
                        onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))}
                      />
                      {formErrors.cin && <p className="mt-1 text-xs text-red-500">{formErrors.cin[0]}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white pt-4">
                <button
                  type="button"
                  className="rounded-xl border border-[#dcd6c1] shadow-[0_2px_4px_rgba(15,23,42,0.05)] transition-all hover:border-[#c4b99a] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] bg-white px-5 py-2 text-sm font-semibold text-[#334155]"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1E3A5F] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(15,23,42,0.2)] disabled:opacity-50"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-2xl border border-transparent bg-white p-6 shadow-[0_20px_50px_rgba(2,6,23,0.25)]">
            <h2 className="text-lg font-semibold text-[#1a1c1a]">Confirm Deletion</h2>
            <p className="mt-2 text-sm text-[#64748B]">This action is irreversible. The user will be permanently deleted.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-semibold text-[#334155]"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => handleDeleteUser(deleteConfirmId)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminUsers;
