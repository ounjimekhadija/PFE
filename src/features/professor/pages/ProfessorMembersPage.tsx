import React from 'react';
import { Mail, Phone, CreditCard, GraduationCap, Linkedin, Github, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { members } from '../../../shared/data/mockData';

const Members: React.FC = () => {
  return (
    <div className="flex-1 bg-white text-gray-900 p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-gray-400 mt-2">Manage and view information of all students in the group</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md">
            Add Member
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members.map((member) => (
          <motion.div
            key={member.id}
            whileHover={{ y: -8 }}
            className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-50 to-teal-50"></div>
            
            <div className="relative flex flex-col items-center pt-4">
              <div className="relative mb-4">
                <img 
                  src={member.avatar} 
                  alt={member.name} 
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white"></div>
              </div>
              
              <h3 className="text-xl font-bold mb-1 text-gray-800">{member.name}</h3>
              <p className="text-indigo-600 text-xs font-medium uppercase tracking-wider mb-6">Student Member</p>

              <div className="w-full space-y-3 mb-8">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-indigo-100 transition-colors">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Email</p>
                    <p className="text-xs truncate text-gray-700">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-teal-100 transition-colors">
                  <div className="p-2 bg-teal-500/10 rounded-lg text-teal-600">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Phone</p>
                    <p className="text-xs text-gray-700">{member.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-orange-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap size={14} className="text-orange-500" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">CNE</p>
                    </div>
                    <p className="text-xs font-mono text-gray-700">{member.cne}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-rose-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard size={14} className="text-rose-500" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">CIN</p>
                    </div>
                    <p className="text-xs font-mono text-gray-700">{member.cin}</p>
                  </div>
                </div>
              </div>

              <div className="w-full flex gap-3">
                <a 
                  href={`https://${member.linkedin}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100"
                >
                  <Linkedin size={16} className="text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">LinkedIn</span>
                </a>
                <a 
                  href={`https://${member.github}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100"
                >
                  <Github size={16} className="text-gray-700" />
                  <span className="text-xs font-medium text-gray-700">GitHub</span>
                </a>
              </div>
            </div>

            <button className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Members;
