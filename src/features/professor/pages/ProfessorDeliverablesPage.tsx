import React from 'react';
import { FileText, FileArchive, Link as LinkIcon, File, Download, ExternalLink, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { groupDeliverables } from '../../../shared/data/mockData';

const Deliverables: React.FC = () => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF': return <FileText className="text-red-500" size={24} />;
      case 'ZIP': return <FileArchive className="text-amber-500" size={24} />;
      case 'LINK': return <LinkIcon className="text-blue-500" size={24} />;
      case 'DOC': return <File className="text-indigo-500" size={24} />;
      default: return <File className="text-gray-400" size={24} />;
    }
  };

  return (
    <div className="flex-1 bg-white text-gray-900 p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold">Group Deliverables</h1>
          <p className="text-gray-400 mt-2">View and manage all project deliverables by group</p>
        </div>
      </header>

      <div className="space-y-12">
        {groupDeliverables.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100"></div>
              <h2 className="text-xl font-bold text-indigo-600 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">
                {group.groupName}
              </h2>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.deliverables.map((deliverable) => (
                <motion.div
                  key={deliverable.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:border-indigo-100 transition-all group relative"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-gray-50 rounded-2xl">
                      {getIcon(deliverable.type)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                        deliverable.status === 'SUBMITTED' ? 'bg-green-100 text-green-600' :
                        deliverable.status === 'LATE' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {deliverable.status}
                      </span>
                      <button className="text-gray-400 hover:text-gray-600 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-2 text-gray-800 group-hover:text-indigo-600 transition-colors">
                    {deliverable.title}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-6">
                    <span>{deliverable.date}</span>
                    {deliverable.size && (
                      <>
                        <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                        <span>{deliverable.size}</span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {deliverable.type === 'LINK' ? (
                      <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-sm font-semibold text-white transition-all shadow-md">
                        <ExternalLink size={16} /> Open Link
                      </button>
                    ) : (
                      <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-sm font-semibold text-gray-700 transition-all border border-gray-200">
                        <Download size={16} /> Download
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Deliverables;
