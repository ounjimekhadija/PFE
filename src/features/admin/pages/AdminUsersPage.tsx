import React, { useState } from 'react';
import { UserPlus, Upload, Trash2, Search, Filter, MoreVertical, Mail, Shield, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Professor';
  status: 'Active' | 'Inactive';
  avatar: string;
}

const AdminUsers: React.FC = () => {
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    filiere: '',
    nom: '',
    prenom: '',
    phone: '',
    email: '',
    groupe: '',
    projet: '',
  });
  // Mock filieres, groupes, projets
  const filieres = ['Prototyping', 'Shopping', 'Medical', 'Wireframing'];
  const groupes = ['Web Designing Group', 'Mobile App Group', 'Medical Dashboard Group'];
  const projets = ['Web Designing', 'Mobile App', 'Dashboard'];
  const [users] = useState<UserAccount[]>([
    { id: '1', name: 'Dr. Sarah Wilson', email: 'sarah.w@univ.edu', role: 'Professor', status: 'Active', avatar: 'https://picsum.photos/seed/sarah/100/100' },
    { id: '2', name: 'John Doe', email: 'john.doe@student.edu', role: 'Student', status: 'Active', avatar: 'https://picsum.photos/seed/john/100/100' },
    { id: '3', name: 'Prof. James Miller', email: 'j.miller@univ.edu', role: 'Professor', status: 'Inactive', avatar: 'https://picsum.photos/seed/james/100/100' },
    { id: '4', name: 'Emma Thompson', email: 'emma.t@student.edu', role: 'Student', status: 'Active', avatar: 'https://picsum.photos/seed/emma/100/100' },
  ]);

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Create, import, and manage student and teacher accounts.</p>
        </div>
        <div className="flex items-center gap-3 justify-end w-full md:w-auto">
          <button className="bg-white text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm text-sm">
            <Upload size={16} />
            Import CSV
          </button>
          <button
            className="bg-[#1a1a1a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg text-sm"
            style={{ minWidth: 'auto' }}
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={16} />
            Add User
          </button>
              {/* Add Professor Modal */}
              {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg relative animate-fadeIn">
                    <button
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
                      onClick={() => setShowAddModal(false)}
                      aria-label="Close"
                    >
                      &times;
                    </button>
                    <h2 className="text-2xl font-bold mb-6 text-gray-900">Créer un professeur</h2>
                    <form className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Filière</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          value={form.filiere}
                          onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}
                        >
                          <option value="">Choisir...</option>
                          {filieres.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Nom</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.nom}
                            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Prénom</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.prenom}
                            onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Numéro de téléphone</label>
                        <input
                          type="tel"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Email</label>
                        <input
                          type="email"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Nom du groupe</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            value={form.groupe}
                            onChange={e => setForm(f => ({ ...f, groupe: e.target.value }))}
                          >
                            <option value="">Choisir...</option>
                            {groupes.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold mb-1">Nom du projet</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            value={form.projet}
                            onChange={e => setForm(f => ({ ...f, projet: e.target.value }))}
                          >
                            <option value="">Choisir...</option>
                            {projets.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                          onClick={() => setShowAddModal(false)}
                        >Annuler</button>
                        <button
                          type="submit"
                          className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow"
                          onClick={e => { e.preventDefault(); setShowAddModal(false); }}
                        >Créer</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
        </div>
      </header>



      {/* Users Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-bottom border-gray-100">
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Prénom</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Téléphone</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Filière</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom du groupe</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nom du projet</th>
              <th className="px-4 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {/* Affichage fictif, à adapter selon la structure réelle des données */}
            <tr>
              <td className="px-4 py-5 font-bold text-gray-900">Sarah</td>
              <td className="px-4 py-5 text-gray-900">Wilson</td>
              <td className="px-4 py-5 text-gray-900">+212 600-000000</td>
              <td className="px-4 py-5 text-gray-900">sarah.w@univ.edu</td>
              <td className="px-4 py-5 text-gray-900">Prototyping</td>
              <td className="px-4 py-5 text-gray-900">Web Designing Group</td>
              <td className="px-4 py-5 text-gray-900">Web Designing</td>
              <td className="px-4 py-5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
            {/* Répéter pour chaque professeur réel, ou mapper sur la vraie liste si disponible */}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
