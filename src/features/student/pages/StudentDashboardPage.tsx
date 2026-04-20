import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, Target, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface DashboardData {
  iteration: any;
  supervisor: any;
  completedTasks: any[];
  pendingTasks: any[];
  totalTasks: number;
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // 1. Get current logged in user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Get student details (to find project_id)
        const { data: student, error: studentError } = await supabase
          .from('etudiants')
          .select('projet_id')
          .eq('id', user.id)
          .single();
          
        if (studentError || !student?.projet_id) throw new Error("Projet non trouvé.");

        // 3. Get Project and Supervisor info
        const { data: project } = await supabase
          .from('projets')
          .select('encadrant_id')
          .eq('id', student.projet_id)
          .single();

        let supervisor = null;
        if (project?.encadrant_id) {
          const { data: prof } = await supabase
            .from('utilisateurs')
            .select('nom, prenom')
            .eq('id', project.encadrant_id)
            .single();
          supervisor = prof;
        }

        // 4. Get active iteration
        const { data: iteration } = await supabase
          .from('iterations')
          .select('*')
          .eq('projet_id', student.projet_id)
          .eq('statut', 'EN_COURS')
          .single();

        // 5. Get tasks for this iteration
        let completedTasks: any[] = [];
        let pendingTasks: any[] = [];
        let totalTasks = 0;

        if (iteration) {
          const { data: tasks } = await supabase
            .from('taches')
            .select('*')
            .eq('iteration_id', iteration.id);

          if (tasks) {
            completedTasks = tasks.filter(t => t.etat === 'TERMINE');
            pendingTasks = tasks.filter(t => t.etat !== 'TERMINE');
            totalTasks = tasks.length;
          }
        }

        setData({
          iteration,
          supervisor,
          completedTasks,
          pendingTasks,
          totalTasks
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleSendMessage = () => {
    navigate('/chat?user=prof.ahmed.alami');
  };

  if (loading) {
    return <div className="flex-1 flex justify-center items-center h-full">Chargement des données...</div>;
  }

  // Calculate stats
  const completedCount = data?.completedTasks.length || 0;
  const percentage = data?.totalTasks ? Math.round((completedCount / data.totalTasks) * 100) : 0;
  const strokeDashoffset = 440 - (440 * percentage) / 100;

  // Calculate days remaining
  let daysRemaining = 0;
  if (data?.iteration?.date_fin) {
    const end = new Date(data.iteration.date_fin).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  return (
    <div className="flex-1 bg-white overflow-hidden h-screen flex justify-center items-center">
      <div className="w-full h-full p-8" style={{ zoom: "0.85" }}>
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back! Here's what's happening in your current iteration.</p>
          </div>
          {data?.iteration?.date_fin && (
            <div className={`px-6 py-3 rounded-2xl border flex items-center gap-4 ${daysRemaining > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
              <div className="text-right">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${daysRemaining > 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                  {daysRemaining > 0 ? "Iteration Ends In" : "Iteration Status"}
                </p>
                <p className={`text-xl font-bold ${daysRemaining > 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {daysRemaining > 0 ? `${daysRemaining} Days` : "Terminée"}
                </p>
              </div>
              <Clock className={daysRemaining > 0 ? "text-indigo-600" : "text-red-600"} size={24} />
            </div>
          )}
        </header>

      <div className="flex flex-col gap-8">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Iteration Objective */}
          <div className="lg:col-span-2">
            <section className="bg-[#1a1a1a] rounded-[40px] p-10 text-white relative overflow-hidden h-full">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Target className="text-[#ff4d4d]" size={24} />
                  <span className="text-sm font-bold uppercase tracking-widest text-white/60">Current Objective</span>
                </div>
                <h2 className="text-4xl font-bold mb-4 leading-tight">
                  {data?.iteration?.objectif || "Aucun objectif défini pour cette itération."}
                </h2>
                <p className="text-white/40 max-w-xl mb-8">
                  Defined by {data?.supervisor ? `Prof. ${data.supervisor.prenom} ${data.supervisor.nom}` : "votre encadrant"}. Focus on delivering the expected results on time.
                </p>
              </div>
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#ff4d4d]/10 rounded-full blur-3xl"></div>
            </section>
          </div>

          {/* Iteration Progress */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm h-full">
              <h3 className="text-lg font-bold mb-6">Iteration Progress</h3>
              <div className="relative h-48 flex items-center justify-center">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                  <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-indigo-600 transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">{percentage}%</span>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Done</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tasks Completed</span>
                  <span className="font-bold">{completedCount}/{data?.totalTasks || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Days Remaining</span>
                  <span className="font-bold text-[#ff4d4d]">{daysRemaining} Days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Activity / Next Steps / Supervisor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Completed Tasks */}
          <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={20} />
              Completed Tasks
            </h3>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {data?.completedTasks.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune tâche terminée.</p>
              ) : (
                data?.completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-green-500 min-w-[8px]"></div>
                    <span className="text-sm font-medium text-gray-700 line-clamp-1">{task.titre}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <AlertCircle className="text-amber-500" size={20} />
              Pending Actions
            </h3>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {data?.pendingTasks.length === 0 ? (
               <p className="text-sm text-gray-400">Aucune tâche en attente.</p>
              ) : (
                data?.pendingTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 group cursor-pointer hover:border-indigo-200 transition-all">
                    <span className="text-sm font-medium text-gray-700 line-clamp-1 mr-2">{task.titre}</span>
                    <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-all shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Supervisor Info */}
          <div className="bg-indigo-600 rounded-[32px] p-8 text-white h-full flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold mb-6">Supervisor</h3>
              <div className="flex items-center gap-4 mb-6">
                <img 
                  src={`https://ui-avatars.com/api/?name=${data?.supervisor?.prenom}+${data?.supervisor?.nom}&background=random`} 
                  alt="Prof" 
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20"
                />
                <div>
                  <p className="font-bold">Prof. {data?.supervisor?.prenom} {data?.supervisor?.nom}</p>
                  <p className="text-xs text-white/60">Software Engineering</p>
                </div>
              </div>
            </div>
            <button 
              className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-sm transition-all"
              onClick={handleSendMessage}
            >
              Send Message
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
