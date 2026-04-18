import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, Target, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const handleSendMessage = () => {
    // Redirige vers la page de chat avec l'encadrant (Prof. Ahmed Alami)
    navigate('/chat?user=prof.ahmed.alami');
  };
  return (
    <div className="flex-1 bg-white p-8 overflow-y-auto">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening in your current iteration.</p>
        </div>
        <div className="bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100 flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Iteration Ends In</p>
            <p className="text-xl font-bold text-indigo-600">08d 14h 22m</p>
          </div>
          <Clock className="text-indigo-600" size={24} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Iteration Objective */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-[#1a1a1a] rounded-[40px] p-10 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Target className="text-[#ff4d4d]" size={24} />
                <span className="text-sm font-bold uppercase tracking-widest text-white/60">Current Objective</span>
              </div>
              <h2 className="text-4xl font-bold mb-4 leading-tight">Implement the core authentication and real-time chat features.</h2>
              <p className="text-white/40 max-w-xl mb-8">
                Defined by Prof. Ahmed. Focus on security and low-latency communication. Deliverables include the auth module and chat service.
              </p>

            </div>
            {/* Abstract background shape */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#ff4d4d]/10 rounded-full blur-3xl"></div>
          </section>

          {/* Recent Activity / Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={20} />
                Completed Tasks
              </h3>
              <div className="space-y-4">
                {[
                  'Setup project structure',
                  'Design database schema',
                  'Create UI components'
                ].map((task, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-700">{task}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={20} />
                Pending Actions
              </h3>
              <div className="space-y-4">
                {[
                  'Submit iteration report',
                  'Upload PDF diagrams',
                  'Review peer code'
                ].map((task, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 group cursor-pointer hover:border-indigo-200 transition-all">
                    <span className="text-sm font-medium text-gray-700">{task}</span>
                    <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          {/* Iteration Progress */}
          <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Iteration Progress</h3>
            <div className="relative h-48 flex items-center justify-center">
              {/* Simple Circular Progress SVG */}
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-gray-100"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * 65) / 100}
                  strokeLinecap="round"
                  className="text-indigo-600"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">65%</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Done</span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tasks Completed</span>
                <span className="font-bold">12/18</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Days Remaining</span>
                <span className="font-bold text-[#ff4d4d]">8 Days</span>
              </div>
            </div>
          </div>

          {/* Supervisor Info */}
          <div className="bg-indigo-600 rounded-[32px] p-8 text-white">
            <h3 className="text-lg font-bold mb-6">Supervisor</h3>
            <div className="flex items-center gap-4 mb-6">
              <img 
                src="https://picsum.photos/seed/prof/100/100" 
                alt="Prof" 
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20"
              />
              <div>
                <p className="font-bold">Prof. Ahmed Alami</p>
                <p className="text-xs text-white/60">Software Engineering</p>
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
  );
};

export default StudentDashboard;
