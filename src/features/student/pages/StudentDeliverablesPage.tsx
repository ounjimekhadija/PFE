import React, { useState, useEffect } from 'react';
import { Upload, FileText, History, Download, Trash2, Plus, ExternalLink, CheckCircle2, Eye, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';

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

  const [selectedDoc, setSelectedDoc] = useState<StudentDeliverable | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Report');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [versionComment, setVersionComment] = useState('Nouvelle version');

  useEffect(() => {
    fetchDeliverables();
    
    // S'abonner aux changements de statut des livrables (Real-time)
    const channel = supabase.channel('livrables_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'livrables' },
        (payload) => {
          console.log('Changement détecté dans les livrables:', payload);
          // Recharger les données quand un livrable est modifié, ajouté ou supprimé
          fetchDeliverables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDeliverables = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('livrables')
        .select(`
          id,
          titre,
          type_document,
          statut,
          created_at,
          livrable_versions (
            id,
            version,
            created_at,
            url_externe,
            chemin_fichier,
            etudiants:depose_par (
              utilisateurs (nom, prenom)
            )
          )
        `);

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

  const handleUpload = async () => {
    if (!newTitle.trim() || !selectedFile) {
      alert("Veuillez entrer un titre et sélectionner un fichier.");
      return;
    }

    try {
      setUploading(true);
      
      // 1. Upload le fichier dans le storage Supabase (bucket 'documents' ou 'livrables')
      // On s'assure d'utiliser un nom unique pour éviter les collisions
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents') // Si le bucket s'appelle différemment (ex: 'livrables'), on peut le changer ici
        .upload(filePath, selectedFile);
        
      if (uploadError) {
        console.error("Erreur d'upload Storage:", uploadError);
        throw new Error(`Erreur Storage (Bucket 'documents' introuvable ou RLS bloqué): ${uploadError.message}`);
        // Si le bucket "documents" n'existe pas, il faut le créer dans Supabase Dashboard > Storage
      }

      // Le lien public n'est pas utilisé ici car le bucket est privé
      // On va plutôt stocker uniquement le chemin, et générer un "Signed URL" à la demande.

      // Calcul de la taille du fichier pour affichage (ex: "1.5 MB")
      const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);

      // --- On récupère dynamiquement le premier étudiant et le premier projet ---
      const { data: studentData, error: studentError } = await supabase.from('etudiants').select('id').limit(1).single();
      const testUserId = studentData?.id;

      if (!testUserId) {
        throw new Error("Aucun Étudiant trouvé dans la table 'etudiants'. Veuillez en créer un.");
      }

      const { data: projData, error: projError } = await supabase.from('projets').select('id').limit(1).single();

      if (!projData?.id) {
        throw new Error("Il manque un 'projet' dans la base de données. Veuillez en créer un avant de déposer un livrable.");
      }

      // 2. Créer le livrable parent en le rattachant au projet test
      const { data, error } = await supabase
        .from('livrables')
        .insert({
          titre: newTitle.trim(),
          type_document: newType,
          statut: 'PENDING',
          projet_id: projData.id
        })
        .select()
        .single();
        
      if (error) throw new Error(`Erreur Livrables: ${error.message} - Détails: ${error.details || ''}`);

      // 3. Créer la première version attachée au parent avec le chemin du fichier
      const { error: vError } = await supabase.from('livrable_versions').insert({
        livrable_id: data.id,
        version: 'v1.0',
        est_lien_externe: false,
        chemin_fichier: filePath, // On sauvegarde le chemin réel dans le storage!
        url_externe: null, // Pas de lien public, c'est sécurisé
        taille_fichier: `${fileSizeInMB} MB`,
        depose_par: testUserId
      });

      if (vError) throw new Error(`Erreur Version: ${vError.message} - Détails: ${vError.details || ''}`);

      setShowUploadModal(false);
      setNewTitle('');
      setSelectedFile(null);
      fetchDeliverables();
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

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);
        
      if (uploadError) {
        throw new Error(`Erreur Storage: ${uploadError.message}`);
      }

      const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);

      const { data: studentData } = await supabase.from('etudiants').select('id').limit(1).single();
      const testUserId = studentData?.id;

      if (!testUserId) throw new Error("Aucun Étudiant trouvé.");

      // Calculer le prochain numéro de version
      let nextVersion = "v1.0";
      if (selectedDoc.versions && selectedDoc.versions.length > 0) {
        const lastVersionStr = selectedDoc.versions[0].version; // On suppose que le premier est le plus récent selon le tri DB
        const match = lastVersionStr.match(/v(\d+)\.0/);
        if (match) {
          nextVersion = `v${parseInt(match[1]) + 1}.0`;
        } else {
          nextVersion = `v${selectedDoc.versions.length + 1}.0`;
        }
      }

      const { error: vError } = await supabase.from('livrable_versions').insert({
        livrable_id: selectedDoc.id,
        version: nextVersion,
        est_lien_externe: false,
        chemin_fichier: filePath,
        url_externe: null,
        taille_fichier: `${fileSizeInMB} MB`,
        depose_par: testUserId
      });

      if (vError) throw new Error(`Erreur insertion: ${vError.message}`);

      setShowAddVersionModal(false);
      setSelectedFile(null);
      setVersionComment('Nouvelle version');
      fetchDeliverables();
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de l'ajout de version: \n${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 bg-white overflow-hidden flex justify-center items-center h-screen">
      <div className="w-full h-full p-8 flex flex-col relative" style={{ zoom: "0.90" }}>
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deliverables</h1>
          <p className="text-gray-500 mt-1">Upload and manage your project documents and versions.</p>
        </div>
        <button 
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          onClick={() => setShowUploadModal(true)}
        >
          <Upload size={20} />
          Upload Document
        </button>
      </header>

      {/* POPUP UPLOAD */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Nouveau document</h2>
            <input
              type="text"
              placeholder="Titre du document..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-center"
              autoFocus
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-center bg-white"
            >
              <option value="Report">Report / Rapport</option>
              <option value="Diagram">Diagram / Schéma</option>
              <option value="PDF">Document PDF</option>
            </select>

            <div className="w-full mb-6 border-2 border-dashed border-gray-200 rounded-xl p-4 relative text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload size={24} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  {selectedFile ? selectedFile.name : "Cliquez pour uploader un fichier"}
                </span>
                {selectedFile && (
                  <span className="text-xs text-gray-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 w-full">
              <button
                className={`flex-1 font-bold py-2 rounded-xl transition-all ${
                  (!newTitle.trim() || !selectedFile || uploading)
                    ? 'bg-indigo-300 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                onClick={handleUpload}
                disabled={!newTitle.trim() || !selectedFile || uploading}
              >
                {uploading ? 'Upload...' : 'Upload'}
              </button>
              <button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl transition-all"
                onClick={() => { setShowUploadModal(false); setNewTitle(''); setSelectedFile(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                    (doc.status?.toUpperCase() === 'VALIDATED' || doc.status?.toUpperCase() === 'VALIDE') 
                      ? 'bg-green-100 text-green-600' :
                    (doc.status?.toUpperCase() === 'REJECTED' || doc.status?.toUpperCase() === 'REJETE')
                      ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
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
                    <button
                      className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all"
                      title="Upload new version"
                      onClick={e => { e.stopPropagation(); setSelectedDoc(doc); setShowAddVersionModal(true); }}
                    >
                      <PlusCircle size={18} />
                    </button>
                    <button 
                      className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all"
                      title="Download latest version"
                      onClick={e => {
                        e.stopPropagation();
                        // Trouve l'URL du fichier le plus récent
                        if(doc.versions && doc.versions.length > 0 && doc.versions[0].url) {
                          let fileUrl = doc.versions[0].url;
                          
                          // Si l'URL stockée est l'URL publique de Supabase (qui échoue car le bucket est privé)
                          // on extrait juste le chemin pour générer un lien signé
                          if (fileUrl.includes('/storage/v1/object/public/documents/')) {
                            fileUrl = fileUrl.split('/storage/v1/object/public/documents/')[1];
                          }

                          if (fileUrl.startsWith('http')) {
                            // C'est un vrai lien externe (ex: un Google Drive, ou un site web)
                            window.open(fileUrl, '_blank');
                          } else {
                            // C'est un bucket privé, on doit demander un lien signé temporaire avec le chemin
                            supabase.storage.from('documents').createSignedUrl(fileUrl, 3600, { download: true }).then(({ data, error }) => {
                              if (error) {
                                console.error("Erreur createSignedUrl:", error);
                                alert("Erreur d'accès au fichier sécurisé dans le Storage: " + error.message);
                                return;
                              }
                              if (data?.signedUrl) {
                                const link = document.createElement('a');
                                link.href = data.signedUrl;
                                link.setAttribute('download', '');
                                link.target = '_blank';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              } else {
                                alert("Erreur d'accès au fichier sécurisé dans le Storage.");
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
                      className="p-2 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-red-600 transition-all"
                      title="Delete deliverable"
                      onClick={async e => {
                         e.stopPropagation();
                         if(window.confirm('Voulez-vous vraiment supprimer ce livrable et effacer définitivement ses fichiers du Storage ?')) {
                           try {
                             // 1. Récupérer les chemins des fichiers associés depuis la BDD
                             const { data: versions } = await supabase
                               .from('livrable_versions')
                               .select('chemin_fichier')
                               .eq('livrable_id', doc.id);
                             
                             // 2. Supprimer physiquement les fichiers du Storage (bucket "documents")
                             if (versions && versions.length > 0) {
                               const filesToRemove = versions.map(v => v.chemin_fichier).filter(Boolean);
                               if (filesToRemove.length > 0) {
                                 const { error: storageError } = await supabase.storage.from('documents').remove(filesToRemove);
                                 if (storageError) console.error("Erreur suppression Storage:", storageError);
                               }
                             }
                             
                             // 3. Supprimer les lignes dans la base de données
                             await supabase.from('livrable_versions').delete().eq('livrable_id', doc.id);
                             await supabase.from('livrables').delete().eq('id', doc.id);
                             
                             // Mettre à jour l'affichage
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

      {/* Modal pour afficher les versions */}
      {showModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 flex flex-col w-full max-w-lg relative">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Version History</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold" aria-label="Close">&times;</button>
            </div>
            {selectedDoc.versions.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Aucune version disponible.</p>
            ) : (
              <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                {selectedDoc.versions.map((v, i) => (
                  <div key={i} className="relative pl-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200 last:before:hidden">
                    <div className="absolute left-[-4px] top-2 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white"></div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-indigo-600">{v.version}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{v.date}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{v.comment}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={`https://picsum.photos/seed/${v.author.replace(/ /g, '')}/50/50`} className="w-5 h-5 rounded-full" alt={v.author} />
                          <span className="text-xs font-medium text-gray-500">{v.author}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal pour ajouter une nouvelle version */}
      {showAddVersionModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2 text-gray-900">Nouvelle version</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">{selectedDoc.title}</p>
            
            <div className="w-full mb-6 border-2 border-dashed border-gray-200 rounded-xl p-4 relative text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload size={24} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  {selectedFile ? selectedFile.name : "Cliquez pour uploader un fichier"}
                </span>
                {selectedFile && (
                  <span className="text-xs text-gray-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 w-full">
              <button
                className={`flex-1 font-bold py-2 rounded-xl transition-all ${
                  (!selectedFile || uploading)
                    ? 'bg-indigo-300 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                onClick={handleAddNewVersion}
                disabled={!selectedFile || uploading}
              >
                {uploading ? 'Upload...' : 'Update'}
              </button>
              <button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl transition-all"
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
