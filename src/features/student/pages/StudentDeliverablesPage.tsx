import React, { useState } from 'react';
import { Upload, FileText, History, Download, Trash2, Plus, ExternalLink, CheckCircle2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeliverableVersion {
  version: string;
  date: string;
  author: string;
  comment: string;
}

interface StudentDeliverable {
  id: string;
  title: string;
  type: 'PDF' | 'Diagram' | 'Screenshot' | 'Report';
  status: 'Validated' | 'Pending' | 'Rejected';
  lastModified: string;
  versions: DeliverableVersion[];
}

const StudentDeliverables: React.FC = () => {
  const [deliverables, setDeliverables] = useState<StudentDeliverable[]>([
    {
      id: '1',
      title: 'Iteration 1 Report',
      type: 'Report',
      status: 'Validated',
      lastModified: '2026-04-10',
      versions: [
        { version: 'v1.2', date: '2026-04-10', author: 'Hira R', comment: 'Final version with supervisor feedback.' },
        { version: 'v1.1', date: '2026-04-08', author: 'Anas M', comment: 'Added diagrams.' },
        { version: 'v1.0', date: '2026-04-05', author: 'Hira R', comment: 'Initial draft.' },
      ]
    },
    {
      id: '2',
      title: 'Database Schema Diagram',
      type: 'Diagram',
      status: 'Pending',
      lastModified: '2026-04-14',
      versions: [
        { version: 'v2.0', date: '2026-04-14', author: 'Sara K', comment: 'Updated relations.' },
        { version: 'v1.0', date: '2026-04-12', author: 'Sara K', comment: 'Initial schema.' },
      ]
    }
  ]);

  const [selectedDoc, setSelectedDoc] = useState<StudentDeliverable | null>(null);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex-1 bg-white p-8 flex flex-col overflow-hidden">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deliverables</h1>
          <p className="text-gray-500 mt-1">Upload and manage your project documents and versions.</p>
        </div>
        <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
          <Upload size={20} />
          Upload Document
        </button>
      </header>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Deliverables List */}
        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {deliverables.map((doc) => (
              <motion.div 
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`p-6 rounded-[32px] border-2 transition-all cursor-pointer ${
                  selectedDoc?.id === doc.id 
                    ? 'border-indigo-500 bg-indigo-50/30' 
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    <FileText className="text-indigo-600" size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                    doc.status === 'Validated' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {doc.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-1">{doc.title}</h3>
                <p className="text-sm text-gray-500 mb-6">{doc.type} • Last updated {doc.lastModified}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                    <History size={14} />
                    {doc.versions.length} Versions
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all"
                      title="View versions"
                      onClick={e => { e.stopPropagation(); setSelectedDoc(doc); setShowModal(true); }}
                    >
                      <Eye size={18} />
                    </button>
                    <button className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all">
                      <Download size={18} />
                    </button>
                    <button className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-red-600 transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                      {/* Modal pour afficher les versions */}
                      {showModal && selectedDoc && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                          <div className="bg-white rounded-[40px] p-8 border border-gray-100 flex flex-col w-full max-w-lg relative">
                            <div className="flex justify-between items-center mb-8">
                              <h3 className="text-xl font-bold">Version History</h3>
                              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold" aria-label="Close">&times;</button>
                            </div>
                            <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                              {selectedDoc.versions.map((v, i) => (
                                <div key={i} className="relative pl-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200 last:before:hidden">
                                  <div className="absolute left-[-4px] top-2 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white"></div>
                                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm font-bold text-indigo-600">{v.version}</span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{v.date}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3">{v.comment}</p>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <img src={`https://picsum.photos/seed/${v.author}/50/50`} className="w-5 h-5 rounded-full" alt="" />
                                        <span className="text-xs font-medium text-gray-500">{v.author}</span>
                                      </div>
                                      <button className="text-indigo-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <Download size={12} />
                                        Download
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Version History Sidebar supprimée, seul le popup reste */}
      </div>
    </div>
  );
};

export default StudentDeliverables;
