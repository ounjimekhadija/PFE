import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileText, History, Download, Trash2, Eye, PlusCircle, FileCode, FileImage, MessageSquare, X, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { notifyProjectProfessor } from '../../../lib/notifications';

interface DeliverableVersion {
  id: string;
  version: string;
  date: string;
  author: string;
  comment: string;
  url?: string;
}

interface StudentDeliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  lastModified: string;
  versions: DeliverableVersion[];
}

const StudentDeliverables: React.FC = () => {
  const [deliverables, setDeliverables] = useState<StudentDeliverable[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comments, setComments] = useState<{ id: string; contenu: string; created_at: string; auteur_nom: string; auteur_prenom: string; }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<StudentDeliverable | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Report');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [versionComment, setVersionComment] = useState('Nouvelle version');

  const getCurrentStudentContext = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Session utilisateur introuvable. Veuillez vous reconnecter.");

    const { data: student, error } = await supabase
      .from('etudiants')
      .select('id, projet_id')
      .eq('id', user.id)
      .single();

    if (error || !student) throw new Error("Student profile not found for logged in user.");
    if (!student.projet_id) throw new Error("No project associated with this student.");

    return { studentId: student.id, projectId: student.projet_id };
  };

  useEffect(() => {
    fetchDeliverables();

    const channel = supabase.channel('livrables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'livrables' }, () => {
        fetchDeliverables();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDeliverables = async () => {
    try {
      setLoading(true);
      const { projectId } = await getCurrentStudentContext();

      const { data, error } = await supabase
        .from('livrables')
        .select(`
          id, titre, type_document, statut, created_at,
          livrable_versions (
            id, version, created_at, url_externe, chemin_fichier,
            etudiants:depose_par (utilisateurs (nom, prenom))
          )
        `)
        .eq('projet_id', projectId);

      if (error) throw error;

      if (data) {
        const formattedData: StudentDeliverable[] = data.map((item: any) => ({
          id: item.id,
          title: item.titre,
          type: item.type_document,
          status: item.statut,
          lastModified: new Date(item.created_at).toISOString().split('T')[0],
          versions: item.livrable_versions?.map((v: any) => ({
            id: v.id,
            version: v.version,
            date: new Date(v.created_at).toISOString().split('T')[0],
            author: v.etudiants?.utilisateurs ? `${v.etudiants.utilisateurs.prenom} ${v.etudiants.utilisateurs.nom}` : 'Unknown',
            comment: `Version soumise`,
            url: v.chemin_fichier || v.url_externe
          })) || []
        }));
        setDeliverables(formattedData);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowComments = async (doc: StudentDeliverable) => {
    setSelectedDoc(doc);
    setComments([]);
    setShowCommentModal(true);
    try {
      const { data, error } = await supabase.rpc('get_comments_with_author', {
        p_livrable_id: doc.id
      });
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Erreur lors de la récupération des commentaires:", error);
      setComments([]);
    }
  };

  const handleUpload = async () => {
    if (!newTitle.trim() || !selectedFile) {
      alert("Please enter a title and select a file.");
      return;
    }
    try {
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile);
      if (uploadError) throw new Error(`Erreur Storage: ${uploadError.message}`);

      const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      const { studentId, projectId } = await getCurrentStudentContext();

      const { data, error } = await supabase
        .from('livrables')
        .insert({ titre: newTitle.trim(), type_document: newType, statut: 'PENDING', projet_id: projectId })
        .select()
        .single();

      if (error) throw new Error(`Deliverables Error: ${error.message}`);

      const { error: vError } = await supabase.from('livrable_versions').insert({
        livrable_id: data.id,
        version: 'v1.0',
        est_lien_externe: false,
        chemin_fichier: filePath,
        url_externe: null,
        taille_fichier: `${fileSizeInMB} MB`,
        depose_par: studentId
      });

      if (vError) throw new Error(`Erreur Version: ${vError.message}`);

      setShowUploadModal(false);
      setNewTitle('');
      setSelectedFile(null);
      fetchDeliverables();

      await notifyProjectProfessor({
        projectId,
        senderId: studentId,
        title: 'New Deliverable Submitted',
        message: `Student submitted a new deliverable: "${newTitle.trim()}".`,
        type: 'SUBMISSION_LIVRABLE'
      });
    } catch (error: any) {
      alert(`Error creating deliverable: \n${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddNewVersion = async () => {
    if (!selectedDoc || !selectedFile) {
      alert("Please select a file.");
      return;
    }
    try {
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile);
      if (uploadError) throw new Error(`Erreur Storage: ${uploadError.message}`);

      const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      const { studentId } = await getCurrentStudentContext();

      let nextVersion = "v1.0";
      if (selectedDoc.versions && selectedDoc.versions.length > 0) {
        const lastVersionStr = selectedDoc.versions[0].version;
        const match = lastVersionStr.match(/v(\d+)\.0/);
        if (match) nextVersion = `v${parseInt(match[1]) + 1}.0`;
        else nextVersion = `v${selectedDoc.versions.length + 1}.0`;
      }

      const { error: vError } = await supabase.from('livrable_versions').insert({
        livrable_id: selectedDoc.id,
        version: nextVersion,
        est_lien_externe: false,
        chemin_fichier: filePath,
        url_externe: null,
        taille_fichier: `${fileSizeInMB} MB`,
        depose_par: studentId
      });

      if (vError) throw new Error(`Erreur insertion: ${vError.message}`);

      setShowAddVersionModal(false);
      setSelectedFile(null);
      setVersionComment('Nouvelle version');
      fetchDeliverables();

      const { projectId } = await getCurrentStudentContext();
      await notifyProjectProfessor({
        projectId,
        senderId: studentId,
        title: 'New Deliverable Version',
        message: `Student uploaded a new version of "${selectedDoc.title}".`,
        type: 'SUBMISSION_LIVRABLE'
      });
    } catch (error: any) {
      alert(`Erreur lors de l'ajout de version: \n${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const getStatusClass = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'VALIDATED' || s === 'VALIDE') return 'bg-green-100 text-green-600';
    if (s === 'REJECTED' || s === 'REJETE') return 'bg-[#ffdad6] text-[#ba1a1a]';
    return 'bg-[#ffd464] text-[#594400]';
  };

  const getDocIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('PDF')) return <FileText className="text-[#ba1a1a]" size={24} />;
    if (t.includes('DIAGRAM') || t.includes('SCHEMA')) return <FileImage className="text-[#765b00]" size={24} />;
    if (t.includes('PROGRAM') || t.includes('CODE')) return <FileCode className="text-[#1a1c1a]" size={24} />;
    return <FileText className="text-[#765b00]" size={24} />;
  };

  const getInitials = (prenom: string, nom: string) =>
    `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();

  return (
    // Conteneur racine : hauteur pleine et scroll
    <div
      className="bg-[#faf9f6] text-[#1a1c1a] h-screen overflow-y-auto"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      {/* Conteneur interne avec un grand padding-bottom pour voir le bas des cartes */}
      <div className="p-6 md:p-8 pb-32">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1c1a]">Deliverables</h1>
            <p className="mt-1 text-sm text-[#7f7664]">Upload and manage your project documents and versions.</p>
          </div>
          <button
            className="bg-[#765b00] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-[#594400] transition-all shadow-sm"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={20} />
            Upload Document
          </button>
        </header>

        {/* Deliverables grid with extra bottom margin */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {deliverables.map((doc) => (
            <motion.div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`cursor-pointer rounded-2xl border-2 p-5 shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition-all ${
                selectedDoc?.id === doc.id
                  ? 'border-transparent bg-[#ffd464]/10'
                  : 'border-transparent bg-white hover:border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${getStatusClass(doc.status)}`}>
                  {doc.status}
                </span>
              </div>

              <h3 className="mb-1 text-base font-bold text-[#1a1c1a]">{doc.title}</h3>
              <p className="mb-4 text-sm text-[#7f7664]">{doc.type} • Last updated {doc.lastModified}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#7f7664]">
                  <History size={14} />
                  {doc.versions.length} Versions
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-xl border border-transparent bg-white p-2 text-[#7f7664] transition-all hover:text-[#765b00]"
                    title="View comments"
                    onClick={e => { e.stopPropagation(); handleShowComments(doc); }}
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button
                    className="rounded-xl border border-transparent bg-[#765b00] p-2 text-white transition-all hover:bg-[#594400]"
                    title="View versions"
                    onClick={e => { e.stopPropagation(); setSelectedDoc(doc); setShowModal(true); }}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    className="rounded-xl border border-transparent bg-white p-2 text-[#7f7664] transition-all hover:text-[#765b00]"
                    title="Upload new version"
                    onClick={e => { e.stopPropagation(); setSelectedDoc(doc); setShowAddVersionModal(true); }}
                  >
                    <PlusCircle size={18} />
                  </button>
                  <button
                    className="rounded-xl border border-transparent bg-[#ffd464] p-2 text-white transition-all hover:bg-[#ebc254]"
                    title="Download latest version"
                    onClick={e => {
                      e.stopPropagation();
                      if (doc.versions && doc.versions.length > 0 && doc.versions[0].url) {
                        let fileUrl = doc.versions[0].url;
                        if (fileUrl.includes('/storage/v1/object/public/documents/')) {
                          fileUrl = fileUrl.split('/storage/v1/object/public/documents/')[1];
                        }
                        if (fileUrl.startsWith('http')) {
                          window.open(fileUrl, '_blank');
                        } else {
                          supabase.storage.from('documents').createSignedUrl(fileUrl, 3600, { download: true }).then(({ data, error }) => {
                            if (error) { alert("Error accessing file: " + error.message); return; }
                            if (data?.signedUrl) {
                              const link = document.createElement('a');
                              link.href = data.signedUrl;
                              link.setAttribute('download', '');
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          });
                        }
                      } else {
                        alert("The file is not available in Storage.");
                      }
                    }}
                  >
                    <Download size={18} />
                  </button>
                  <button
                    className="rounded-xl border border-transparent bg-[#ba1a1a] p-2 text-white transition-all hover:bg-[#8c1d18]"
                    title="Delete deliverable"
                    onClick={async e => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this deliverable and permanently erase its files from Storage?')) {
                        try {
                          const { data: versions } = await supabase
                            .from('livrable_versions')
                            .select('chemin_fichier')
                            .eq('livrable_id', doc.id);

                          if (versions && versions.length > 0) {
                            const filesToRemove = versions.map((v: any) => v.chemin_fichier).filter(Boolean);
                            if (filesToRemove.length > 0) {
                              await supabase.storage.from('documents').remove(filesToRemove);
                            }
                          }
                          await supabase.from('livrable_versions').delete().eq('livrable_id', doc.id);
                          await supabase.from('livrables').delete().eq('id', doc.id);
                          fetchDeliverables();
                        } catch (err) {
                          alert("Unable to delete the deliverable.");
                        }
                      }
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modaux - inchangés */}
      {showUploadModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4 text-[#1a1c1a]">Nouveau document</h2>
            <input
              type="text"
              placeholder="Titre du document..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full mb-4 px-4 py-2 border border-[#e8e6e0] rounded-xl focus:outline-none text-center"
              autoFocus
            />
            <div className="relative w-full mb-4">
              <button
                type="button"
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className="w-full px-4 py-2 border border-[#e8e6e0] rounded-xl focus:outline-none bg-white flex justify-between items-center text-[#1a1c1a] text-center"
              >
                <span className="flex-1 font-medium">{newType === 'Report' ? 'Report / Rapport' : newType === 'Diagram' ? 'Diagram / Schéma' : 'Document PDF'}</span>
                <ChevronDown size={16} className={`text-[#7f7664] transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {typeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setTypeDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 z-[101] mt-1 bg-white border border-[#e8e6e0] rounded-xl shadow-lg overflow-hidden py-1">
                    {[
                      { value: 'Report', label: 'Report / Rapport' },
                      { value: 'Diagram', label: 'Diagram / Schéma' },
                      { value: 'PDF', label: 'Document PDF' },
                    ].map(type => (
                      <div
                        key={type.value}
                        className={`px-4 py-2 cursor-pointer transition-colors text-sm font-bold text-center ${
                          newType === type.value ? 'bg-[#ffd464]/20 text-[#765b00]' : 'text-[#4d4636] hover:bg-[#f4f3f1]'
                        }`}
                        onClick={() => {
                          setNewType(type.value);
                          setTypeDropdownOpen(false);
                        }}
                      >
                        {type.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="w-full mb-6 border-2 border-dashed border-[#e8e6e0] rounded-xl p-4 relative text-center hover:bg-[#f4f3f1] transition-colors">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload size={24} className="text-[#7f7664]" />
                <span className="text-sm font-medium text-[#4d4636]">
                  {selectedFile ? selectedFile.name : "Click to upload a file"}
                </span>
                {selectedFile && (
                  <span className="text-xs text-[#7f7664]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                )}
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                className={`flex-1 font-bold py-2 rounded-xl transition-all ${(!newTitle.trim() || !selectedFile || uploading) ? 'bg-[#ebc254] text-white cursor-not-allowed' : 'bg-[#765b00] hover:bg-[#594400] text-white'}`}
                onClick={handleUpload}
                disabled={!newTitle.trim() || !selectedFile || uploading}
              >
                {uploading ? 'Upload...' : 'Upload'}
              </button>
              <button
                className="flex-1 bg-[#efeeeb] hover:bg-[#e3e2e0] text-[#4d4636] font-bold py-2 rounded-xl transition-all"
                onClick={() => { setShowUploadModal(false); setNewTitle(''); setSelectedFile(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCommentModal && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div
            className="bg-white flex flex-col w-full max-w-lg relative overflow-hidden"
            style={{ borderRadius: '24px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
          >
            <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #f0ede6' }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: '#f4f3f1' }}>
                <MessageSquare size={20} color="#765b00" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1a1c1a]" style={{ fontSize: 15, margin: 0 }}>Commentaires</p>
                <p className="text-[#7f7664] uppercase tracking-widest font-semibold truncate" style={{ fontSize: 11, margin: 0 }}>
                  {selectedDoc.title}
                </p>
              </div>
              <button
                onClick={() => setShowCommentModal(false)}
                className="flex items-center justify-center flex-shrink-0 text-[#7f7664] hover:text-[#1a1c1a] transition-colors"
                style={{ width: 32, height: 32, borderRadius: 10, background: '#f4f3f1', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 420 }}>
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex items-center justify-center mb-3" style={{ width: 48, height: 48, borderRadius: 16, background: '#f4f3f1' }}>
                    <MessageSquare size={22} color="#c5b98a" />
                  </div>
                  <p className="font-medium text-[#7f7664]" style={{ fontSize: 14, margin: 0 }}>No comments</p>
                  <p style={{ fontSize: 12, color: '#b0a88a', marginTop: 4 }}>Professor's comments will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {comments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: 12 }}>
                      <div
                        className="flex items-center justify-center flex-shrink-0 font-bold text-[#594400]"
                        style={{ width: 36, height: 36, borderRadius: '50%', background: '#ffd464', fontSize: 12 }}
                      >
                        {getInitials(comment.auteur_prenom, comment.auteur_nom)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span className="font-bold text-[#1a1c1a]" style={{ fontSize: 14 }}>
                            {comment.auteur_prenom} {comment.auteur_nom}
                          </span>
                          <span className="text-[#b0a88a]" style={{ fontSize: 12 }}>
                            🕐 {new Date(comment.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ background: '#f4f3f1', borderRadius: '0 12px 12px 12px', padding: '10px 14px' }}>
                          <p className="text-[#4d4636]" style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{comment.contenu}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showModal && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] p-8 flex flex-col w-full max-w-lg relative" style={{ maxHeight: '80vh' }}>
            <div className="flex justify-between items-center mb-8 flex-shrink-0">
              <h3 className="text-xl font-bold text-[#1a1c1a]">Version History</h3>
              <button onClick={() => setShowModal(false)} className="flex items-center justify-center text-[#7f7664] hover:text-[#1a1c1a] transition-colors" style={{ width: 32, height: 32, borderRadius: 10, background: '#f4f3f1' }}>
                <X size={16} />
              </button>
            </div>
            {selectedDoc.versions.length === 0 ? (
              <p className="text-center text-[#7f7664] py-4">Aucune version disponible.</p>
            ) : (
              <div className="overflow-y-auto pr-2" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {selectedDoc.versions.map((v, i) => (
                  <div key={i} className="relative pl-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-[#d1c5b0] last:before:hidden">
                    <div className="absolute left-[-4px] top-2 w-2.5 h-2.5 rounded-full bg-[#765b00] border-2 border-white" />
                    <div className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-[#f0ede6]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-[#765b00]">{v.version}</span>
                        <span className="text-[10px] font-bold text-[#7f7664] uppercase tracking-widest">{v.date}</span>
                      </div>
                      <p className="text-sm text-[#4d4636] mb-3">{v.comment}</p>
                      <div className="flex items-center gap-2">
                        <img src={`https://picsum.photos/seed/${v.author.replace(/ /g, '')}/50/50`} className="w-5 h-5 rounded-full" alt={v.author} />
                        <span className="text-xs font-medium text-[#7f7664]">{v.author}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {showAddVersionModal && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2 text-[#1a1c1a]">Nouvelle version</h2>
            <p className="text-sm text-[#7f7664] mb-6 text-center">{selectedDoc.title}</p>
            <div className="w-full mb-6 border-2 border-dashed border-[#e8e6e0] rounded-xl p-4 relative text-center hover:bg-[#f4f3f1] transition-colors">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload size={24} className="text-[#7f7664]" />
                <span className="text-sm font-medium text-[#4d4636]">
                  {selectedFile ? selectedFile.name : "Click to upload a file"}
                </span>
                {selectedFile && (
                  <span className="text-xs text-[#7f7664]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                )}
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                className={`flex-1 font-bold py-2 rounded-xl transition-all ${(!selectedFile || uploading) ? 'bg-[#ebc254] text-white cursor-not-allowed' : 'bg-[#765b00] hover:bg-[#594400] text-white'}`}
                onClick={handleAddNewVersion}
                disabled={!selectedFile || uploading}
              >
                {uploading ? 'Upload...' : 'Update'}
              </button>
              <button
                className="flex-1 bg-[#efeeeb] hover:bg-[#e3e2e0] text-[#4d4636] font-bold py-2 rounded-xl transition-all"
                onClick={() => { setShowAddVersionModal(false); setSelectedFile(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentDeliverables;