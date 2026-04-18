import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const AdminMembers: React.FC = () => {
  // Mock groupes et étudiants
  const groupes = [
    { name: 'Groupe A', filiere: 'Prototyping', students: [1, 2, 3] },
    { name: 'Groupe B', filiere: 'Medical', students: [4, 5] },
    { name: 'Groupe C', filiere: 'Prototyping', students: [6, 7, 8, 9] },
  ];
  const filieres = ['Prototyping', 'Medical'];
  const [showGroupes, setShowGroupes] = useState(false);
  const [selectedFiliere, setSelectedFiliere] = useState('');

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

      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8">
        <div className="space-y-4">
          {!showGroupes ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <img src={`https://picsum.photos/seed/student${i}/100/100`} alt="Student" className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Student Name {i}</p>
                    <p className="text-xs text-gray-500">CNE: 123456789</p>
                  </div>
                  <CheckCircle2 className="text-emerald-500" size={18} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
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
                  <svg className="w-5 h-5 text-gray-700 z-0 pointer-events-none mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {groupes.filter(g => !selectedFiliere || g.filiere === selectedFiliere).map((g, idx) => (
                <div key={g.name}>
                  <h3 className="text-lg font-bold text-indigo-600 mb-3">{g.name} <span className="text-xs text-gray-400 font-normal">({g.filiere})</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {g.students.map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <img src={`https://picsum.photos/seed/student${i}/100/100`} alt="Student" className="w-12 h-12 rounded-full object-cover" />
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">Student Name {i}</p>
                          <p className="text-xs text-gray-500">CNE: 123456789</p>
                        </div>
                        <CheckCircle2 className="text-emerald-500" size={18} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMembers;
