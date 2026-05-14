import React, { useState, useEffect } from 'react';
import { Upload, FileText, History, Download, Trash2, Plus, ExternalLink, Eye, PlusCircle, FileCode, FileImage, MessageSquare } from 'lucide-react';
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

    if (error || !student) throw new Error("Profil étudiant introuvable pour l'utilisateur connecté.");
    if (!student.projet_id) throw new Error("Aucun projet associé à cet étudiant.");

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
            author: v.etudiants?.utilisateurs ? `${v.etudiants.utilisateurs.prenom} ${v.etudiants.utilisateurs.nom}` : 'Inconnu',
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
    setShowCommentModal(true);
    try {
      const { data, error } = await supabase.rpc('get_comments_with_author', {
        p_livrable_id: doc.id
      });

      if (error) {
        console.error("Supabase RPC error:", error);
        throw error;
      }
      
      console.log('Comments received from database:', data); // Debugging line
      setComments(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des commentaires:", error);
      setComments([]);
    }
  };

  const handleUpload = async () => {
    if (!newTitle.trim() || !selectedFile) {
      alert("Veuillez entrer un titre et sélectionner un fichier.");
      return;
    }

    try {
      setUploading(true);

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile);
      if (uploadError) throw new Error(`Erreur Storage (Bucket 'documents' introuvable ou RLS bloqué): ${uploadError.message}`);

      const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      const { studentId, projectId } = await getCurrentStudentContext();

      const { data, error } = await supabase
        .from('livrables')
        .insert({ titre: newTitle.trim(), type_document: newType, statut: 'PENDING', projet_id: projectId })
        .select()
        .single();

      if (error) throw new Error(`Erreur Livrables: ${error.message}`);

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

      // Notify professor
      await notifyProjectProfessor({
        projectId: projectId,
        senderId: studentId,
        title: 'New Deliverable Submitted',
        message: `Student submitted a new deliverable: "${newTitle.trim()}".`,
        type: 'SUBMISSION_LIVRABLE'
      });
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de la création du livrable: \n${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddNewVersion = async () => {
    if (!selectedDoc || !selectedFile) {
      alert("Veuillez sélectionner un fichier.");
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

      // Notify professor
      const { projectId } = await getCurrentStudentContext();
      await notifyProjectProfessor({
        projectId: projectId,
        senderId: studentId,
        title: 'New Deliverable Version',
        message: `Student uploaded a new version of "${selectedDoc.title}".`,
        type: 'SUBMISSION_LIVRABLE'
      });
    } catch (error: any) {
      console.error(error);
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="relative flex h-full w-full flex-col">
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

        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center border border-transparent">
              <h2 className="text-xl font-bold mb-4 text-[#1a1c1a]">Nouveau document</h2>
              <input
                type="text"
                placeholder="Titre du document..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full mb-4 px-4 py-2 border border-transparent rounded-xl focus:outline-none focus:border-transparent text-center"
                autoFocus
              />
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full mb-4 px-4 py-2 border border-transparent rounded-xl focus:outline-none focus:border-transparent text-center bg-white"
              >
                <option value="Report">Report / Rapport</option>
                <option value="Diagram">Diagram / Schéma</option>
                <option value="PDF">Document PDF</option>
              </select>

              <div className="w-full mb-6 border-2 border-dashed border-transparent rounded-xl p-4 relative text-center hover:bg-[#f4f3f1] transition-colors">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload size={24} className="text-[#7f7664]" />
                  <span className="text-sm font-medium text-[#4d4636]">
                    {selectedFile ? selectedFile.name : "Cliquez pour uploader un fichier"}
                  </span>
                  {selectedFile && (
                    <span className="text-xs text-[#7f7664]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  className={`flex-1 font-bold py-2 rounded-xl transition-all ${
                    (!newTitle.trim() || !selectedFile || uploading)
                      ? 'bg-[#ebc254] text-white cursor-not-allowed'
                      : 'bg-[#765b00] hover:bg-[#594400] text-white'
                  }`}
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
          </div>
        )}

        <div className="flex flex-1 gap-8 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {deliverables.map((doc) => (
                <motion.div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`mb-6 cursor-pointer rounded-2xl border-2 p-6 shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition-all ${
                    selectedDoc?.id === doc.id
                      ? 'border-transparent bg-[#ffd464]/10'
                      : 'border-transparent bg-white hover:border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="rounded-2xl bg-[#f4f3f1] p-4 shadow-sm">
                      {getDocIcon(doc.type)}
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${getStatusClass(doc.status)}`}>
                      {doc.status}
                    </span>
                  </div>

                  <h3 className="mb-1 text-lg font-bold text-[#1a1c1a]">{doc.title}</h3>
                  <p className="mb-6 text-sm text-[#7f7664]">{doc.type} • Last updated {doc.lastModified}</p>

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
                                if (error) { alert("Erreur d'accès au fichier sécurisé dans le Storage: " + error.message); return; }
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
                            alert("Le fichier n'est pas disponible dans le Storage.");
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
                          if (window.confirm('Voulez-vous vraiment supprimer ce livrable et effacer définitivement ses fichiers du Storage ?')) {
                            try {
                              const { data: versions } = await supabase
                                .from('livrable_versions')
                                .select('chemin_fichier')
                                .eq('livrable_id', doc.id);

                              if (versions && versions.length > 0) {
                                const filesToRemove = versions.map(v => v.chemin_fichier).filter(Boolean);
                                if (filesToRemove.length > 0) {
                                  await supabase.storage.from('documents').remove(filesToRemove);
                                }
                              }

                              await supabase.from('livrable_versions').delete().eq('livrable_id', doc.id);
                              await supabase.from('livrables').delete().eq('id', doc.id);
                              fetchDeliverables();
                            } catch (err) {
                              console.error("Erreur globale de suppression:", err);
                              alert("Impossible de supprimer le livrable.");
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
        </div>

        {showCommentModal && selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] p-8 border border-transparent flex flex-col w-full max-w-lg relative">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-[#1a1c1a]">Commentaires sur "{selectedDoc.title}"</h3>
                <button onClick={() => setShowCommentModal(false)} className="text-[#7f7664] hover:text-[#4d4636] text-2xl font-bold" aria-label="Close">&times;</button>
              </div>
              {comments.length === 0 ? (
                <p className="text-center text-[#7f7664] py-4">Aucun commentaire pour ce livrable.</p>
              ) : (
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-[#f4f3f1] p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-bold text-[#4d4636]">{`${comment.auteur_prenom} ${comment.auteur_nom}`}</p>
                        <p className="text-xs text-right text-[#7f7664]">{new Date(comment.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className="text-sm text-[#4d4636]">{comment.contenu}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showModal && selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] p-8 border border-transparent flex flex-col w-full max-w-lg relative">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-[#1a1c1a]">Version History</h3>
                <button onClick={() => setShowModal(false)} className="text-[#7f7664] hover:text-[#4d4636] text-2xl font-bold" aria-label="Close">&times;</button>
              </div>
              {selectedDoc.versions.length === 0 ? (
                <p className="text-center text-[#7f7664] py-4">Aucune version disponible.</p>
              ) : (
                <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                  {selectedDoc.versions.map((v, i) => (
                    <div key={i} className="relative pl-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-[#d1c5b0] last:before:hidden">
                      <div className="absolute left-[-4px] top-2 w-2.5 h-2.5 rounded-full bg-[#765b00] border-2 border-white"></div>
                      <div className="bg-white p-5 rounded-2xl border border-transparent shadow-sm hover:shadow-md transition-shadow">
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
          </div>
        )}

        {showAddVersionModal && selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center border border-transparent">
              <h2 className="text-xl font-bold mb-2 text-[#1a1c1a]">Nouvelle version</h2>
              <p className="text-sm text-[#7f7664] mb-6 text-center">{selectedDoc.title}</p>

              <div className="w-full mb-6 border-2 border-dashed border-transparent rounded-xl p-4 relative text-center hover:bg-[#f4f3f1] transition-colors">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload size={24} className="text-[#7f7664]" />
                  <span className="text-sm font-medium text-[#4d4636]">
                    {selectedFile ? selectedFile.name : "Cliquez pour uploader un fichier"}
                  </span>
                  {selectedFile && (
                    <span className="text-xs text-[#7f7664]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  className={`flex-1 font-bold py-2 rounded-xl transition-all ${
                    (!selectedFile || uploading)
                      ? 'bg-[#ebc254] text-white cursor-not-allowed'
                      : 'bg-[#765b00] hover:bg-[#594400] text-white'
                  }`}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDeliverables;
