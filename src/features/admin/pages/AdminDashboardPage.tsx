import React, { useState } from 'react';
import { projects, groupDeliverables, members } from '../../../shared/data/mockData';
import { Users, Layers, TrendingUp, Clock, PieChart as PieIcon, BarChart as BarIcon, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';

const AdminDashboard: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  // Extraire les filières (catégories) uniques
  const filieres = Array.from(new Set(projects.map(p => p.category)));
  const [selectedFiliere, setSelectedFiliere] = useState<string>(filieres[0] || '');
  const stats = [
    { label: 'Total Students', value: '450', icon: Users, color: 'bg-blue-500' },
    { label: 'Active Projects', value: '120', icon: Layers, color: 'bg-purple-500' },
    { label: 'Completion Rate', value: '85%', icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Avg. Delay', value: '2.4 days', icon: Clock, color: 'bg-red-500' },
  ];

  // Calculer la distribution pour la filière sélectionnée
  const projectsFiliere = projects.filter(p => p.category === selectedFiliere);
  const projectStatusData = [
    {
      name: 'Completed',
      value: projectsFiliere.filter(p => p.progress >= 80).length,
      color: '#10b981',
    },
    {
      name: 'In Progress',
      value: projectsFiliere.filter(p => p.progress > 0 && p.progress < 80).length,
      color: '#6366f1',
    },
    {
      name: 'Delayed',
      value: projectsFiliere.filter(p => p.title.toLowerCase().includes('dashboard')).length,
      color: '#ef4444',
    },
    {
      name: 'Pending',
      value: projectsFiliere.filter(p => p.progress === 0).length,
      color: '#f59e0b',
    },
  ];


  // Simuler une notification : 1 groupe créé, 1 projet terminé
  const [notifications] = useState([
    { id: 1, type: 'group', message: 'A new group has been created.' },
    { id: 2, type: 'project', message: 'A project has been marked as done.' },
  ]);
  const [showNotif, setShowNotif] = useState(false);

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Statistics</h1>
          <p className="text-gray-500 mt-1">Overview of the entire platform's performance and progress.</p>
        </div>
        <div>
          <button
            className="fixed top-6 right-6 z-50 bg-gray-100 p-3 rounded-full shadow hover:bg-gray-200 transition"
            onClick={() => setShowNotif(v => !v)}
            aria-label="Notifications"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
          >
            <Bell className="w-7 h-7 text-gray-500" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{notifications.length}</span>
            )}
          </button>
          {showNotif && (
            <div
              className="z-50"
              style={{
                position: 'fixed',
                top: '70px',
                right: '1rem',
                left: 'auto',
                width: 'min(95vw, 20rem)',
                background: '#fff',
                borderRadius: '1rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid #f3f4f6',
              }}
            >
              <div className="p-4">
                <h4 className="font-bold text-gray-800 mb-2">Notifications</h4>
                {notifications.map(n => (
                  <div key={n.id} className="flex items-center gap-2 mb-2 last:mb-0">
                    {n.type === 'group' && <Users className="w-5 h-5 text-blue-500" />}
                    {n.type === 'project' && <Layers className="w-5 h-5 text-green-500" />}
                    <span className="text-sm text-gray-700">{n.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-2xl text-white`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"
        >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <PieIcon className="text-indigo-500" />
                  Project Distribution
                </h3>
                {/* Sélection de filière à droite du titre */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <select
                      className="appearance-none bg-transparent pr-6 pl-2 py-2 text-gray-800 font-semibold focus:outline-none cursor-pointer"
                      value={selectedFiliere}
                      onChange={e => {
                        setSelectedFiliere(e.target.value);
                        setSelectedStatus(null);
                      }}
                      style={{ minWidth: 0 }}
                    >
                      {filieres.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <svg className="w-4 h-4 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedStatus(entry.name)}
                      opacity={selectedStatus && selectedStatus !== entry.name ? 0.4 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {projectStatusData.map((item) => (
              <button
                key={item.name}
                className={`flex items-center gap-2 focus:outline-none ${selectedStatus === item.name ? 'font-bold text-black' : 'text-gray-600'}`}
                onClick={() => setSelectedStatus(item.name)}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-sm font-medium">{item.name}: {item.value}%</span>
              </button>
            ))}
          </div>

          {/* Liste des projets filtrés avec nom, encadrant et groupe */}
          {selectedStatus && (
            <div className="mt-8">
              <h4 className="text-lg font-bold mb-2">Projects: {selectedStatus}</h4>
              <div className="space-y-3">
                {projectsFiliere
                  .filter(p => {
                    if (selectedStatus === 'Completed') return p.progress >= 80;
                    if (selectedStatus === 'In Progress') return p.progress > 0 && p.progress < 80;
                    if (selectedStatus === 'Delayed') return p.title.toLowerCase().includes('dashboard');
                    if (selectedStatus === 'Pending') return p.progress === 0;
                    return false;
                  })
                  .map((p, idx) => {
                    // Trouver le groupe (par titre du projet)
                    const group = groupDeliverables.find(g => p.title.toLowerCase().includes(g.groupName.toLowerCase().split(' ')[0]))?.groupName || 'N/A';
                    // Encadrant fictif (par index)
                    const encadrant = members[idx % members.length]?.name || 'N/A';
                    return (
                      <div key={p.id} className="bg-white/90 rounded-2xl p-6 border border-gray-100 shadow flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:shadow-lg transition-all">
                        <div className="flex flex-col gap-1">
                          <div className="font-bold text-gray-800 text-lg tracking-wide">{p.title}</div>
                          <div className="text-xs text-blue-600 font-semibold">{group !== 'N/A' ? group : 'No group assigned'}</div>
                        </div>
                        <div className="flex flex-col md:items-end gap-1">
                          <span className="text-base font-semibold text-green-600">Progress: <span className="font-bold text-gray-900">{p.progress}%</span></span>
                          <span className="text-xs text-gray-500">Encadrant: <span className="font-medium text-indigo-600">{encadrant}</span></span>
                        </div>
                      </div>
                    );
                  })}
                {projectsFiliere.filter(p => {
                  if (selectedStatus === 'Completed') return p.progress >= 80;
                  if (selectedStatus === 'In Progress') return p.progress > 0 && p.progress < 80;
                  if (selectedStatus === 'Delayed') return p.title.toLowerCase().includes('dashboard');
                  if (selectedStatus === 'Pending') return p.progress === 0;
                  return false;
                }).length === 0 && (
                  <div className="text-gray-400 italic">No projects found for this status.</div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
