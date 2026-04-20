import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FileArchive, Link as LinkIcon, File, Download, ExternalLink, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';

interface DeliverableItem {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  size?: string;
  isExternal: boolean;
  externalUrl?: string;
  filePath?: string;
}

interface DeliverableGroup {
  groupName: string;
  deliverables: DeliverableItem[];
}

const Deliverables: React.FC = () => {
  const [groups, setGroups] = useState<DeliverableGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF': return <FileText className="text-red-500" size={24} />;
      case 'ZIP': return <FileArchive className="text-amber-500" size={24} />;
      case 'LINK': return <LinkIcon className="text-blue-500" size={24} />;
      case 'DOC': return <File className="text-indigo-500" size={24} />;
      default: return <File className="text-gray-400" size={24} />;
    }
  };

  const getStatusClass = (status: string) => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'SUBMITTED' || normalized === 'SOUMIS' || normalized === 'TERMINE') {
      return 'bg-green-100 text-green-600';
    }
    if (normalized === 'LATE' || normalized === 'EN_RETARD') {
      return 'bg-red-100 text-red-600';
    }
    return 'bg-yellow-100 text-yellow-600';
  };

  const fetchProfessorProjectIds = async (authUserId: string): Promise<string[]> => {
    const projectIdSet = new Set<string>();

    const { data: directRows, error: directError } = await supabase
      .from('projets')
      .select('id')
      .eq('encadrant_id', authUserId);

    if (directError) throw directError;
    (directRows || []).forEach((row: any) => {
      if (row?.id) projectIdSet.add(String(row.id));
    });

    if (projectIdSet.size > 0) {
      return Array.from(projectIdSet);
    }

    const encadrantIdCandidates = new Set<string>();
    const { data: encById } = await supabase
      .from('encadrants')
      .select('id')
      .eq('id', authUserId)
      .limit(1);

    (encById || []).forEach((row: any) => {
      if (row?.id) encadrantIdCandidates.add(String(row.id));
    });

    const mappingColumns = ['utilisateur_id', 'user_id', 'auth_user_id'];
    for (const column of mappingColumns) {
      const { data } = await supabase
        .from('encadrants')
        .select('id')
        .eq(column, authUserId)
        .limit(1);

      (data || []).forEach((row: any) => {
        if (row?.id) encadrantIdCandidates.add(String(row.id));
      });
    }

    if (encadrantIdCandidates.size === 0) {
      return [];
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('projets')
      .select('id')
      .in('encadrant_id', Array.from(encadrantIdCandidates));

    if (fallbackError) throw fallbackError;
    (fallbackRows || []).forEach((row: any) => {
      if (row?.id) projectIdSet.add(String(row.id));
    });

    return Array.from(projectIdSet);
  };

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  useEffect(() => {
    const loadDeliverables = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setGroups([]);
          return;
        }

        const projectIds = await fetchProfessorProjectIds(user.id);
        if (projectIds.length === 0) {
          setGroups([]);
          return;
        }

        const { data: rows, error: rowsError } = await supabase
          .from('livrables')
          .select(`
            id,
            titre,
            type_document,
            statut,
            created_at,
            projet_id,
            projets(titre),
            livrable_versions(
              id,
              created_at,
              est_lien_externe,
              url_externe,
              chemin_fichier,
              taille_fichier
            )
          `)
          .in('projet_id', projectIds)
          .order('created_at', { ascending: false });

        if (rowsError) throw rowsError;

        const grouped: Record<string, DeliverableItem[]> = {};

        (rows || []).forEach((row: any) => {
          const projectObj = Array.isArray(row.projets) ? row.projets[0] : row.projets;
          const groupName = projectObj?.titre || `Projet ${row.projet_id}`;

          const versions = Array.isArray(row.livrable_versions) ? [...row.livrable_versions] : [];
          versions.sort((a: any, b: any) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
          const latestVersion = versions[0] || null;

          const item: DeliverableItem = {
            id: String(row.id),
            title: row.titre || 'Untitled deliverable',
            type: row.type_document || 'DOC',
            date: formatDate(latestVersion?.created_at || row.created_at),
            status: row.statut || 'PENDING',
            size: latestVersion?.taille_fichier || undefined,
            isExternal: Boolean(latestVersion?.est_lien_externe),
            externalUrl: latestVersion?.url_externe || undefined,
            filePath: latestVersion?.chemin_fichier || undefined,
          };

          if (!grouped[groupName]) grouped[groupName] = [];
          grouped[groupName].push(item);
        });

        const dataGroups: DeliverableGroup[] = Object.entries(grouped).map(([groupName, deliverables]) => ({
          groupName,
          deliverables,
        }));

        setGroups(dataGroups);
      } catch (err) {
        console.error('Erreur chargement livrables encadrant:', err);
        setError(err instanceof Error ? err.message : 'Failed to load deliverables.');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    loadDeliverables();
  }, []);

  const totalCount = useMemo(() => groups.reduce((acc, g) => acc + g.deliverables.length, 0), [groups]);

  const normalizeStoragePath = (rawPath: string): string => {
    return rawPath
      .trim()
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(/^storage\/v1\/object\/public\//, '')
      .replace(/^storage\/v1\/object\/sign\//, '')
      .replace(/^\/+/g, '')
      .replace(/^documents\//, '')
      .replace(/^livrables\//, '');
  };

  const triggerBrowserDownload = (blob: Blob, suggestedName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = suggestedName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  };

  const openDeliverable = async (deliverable: DeliverableItem) => {
    try {
      setError(null);

      if (deliverable.isExternal && deliverable.externalUrl) {
        const url = deliverable.externalUrl.startsWith('http://') || deliverable.externalUrl.startsWith('https://')
          ? deliverable.externalUrl
          : `https://${deliverable.externalUrl}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (!deliverable.filePath) {
        setError('Aucun fichier associe a ce livrable.');
        return;
      }

      const cleanPath = normalizeStoragePath(deliverable.filePath);
      const fallbackFileName = cleanPath.split('/').pop() || `${deliverable.title}.bin`;

      const bucketCandidates = ['documents', 'livrables'];
      for (const bucket of bucketCandidates) {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(cleanPath);

        if (!downloadError && fileBlob) {
          triggerBrowserDownload(fileBlob, fallbackFileName);
          return;
        }
      }

      // Fallback: open temporary signed URL if direct blob download fails.
      for (const bucket of bucketCandidates) {
        const { data, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 120);

        if (!signedError && data?.signedUrl) {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }

      throw new Error('Fichier introuvable dans les buckets documents/livrables ou acces refuse.');
    } catch (err) {
      console.error('Erreur ouverture livrable:', err);
      setError(err instanceof Error ? err.message : 'Impossible d ouvrir ce livrable.');
    }
  };

  return (
    <div className="flex-1 bg-white text-gray-900 p-4 md:p-6 overflow-hidden">
      <div className="origin-top-left scale-[0.82] w-[121.9512%]">
        <header className="flex justify-between items-center mb-7">
          <div>
            <h1 className="text-2xl font-bold">Group Deliverables</h1>
            <p className="text-gray-400 mt-1.5">View and manage all project deliverables by group</p>
            <p className="text-xs text-gray-400 mt-1">{totalCount} livrable(s)</p>
          </div>
        </header>

        {loading && <p className="text-sm text-gray-500 mb-4">Chargement des livrables...</p>}
        {!loading && error && <p className="text-sm text-red-500 mb-4">Erreur: {error}</p>}
        {!loading && !error && groups.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">Aucun livrable trouve pour les projets assignes a cet encadrant.</p>
        )}

        <div className="space-y-7">
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100"></div>
                <h2 className="text-lg font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                  {group.groupName}
                </h2>
                <div className="h-px flex-1 bg-gray-100"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.deliverables.map((deliverable) => (
                  <motion.div
                    key={deliverable.id}
                    whileHover={{ scale: 1.01 }}
                    className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm hover:border-indigo-100 transition-all group relative"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-gray-50 rounded-2xl">
                        {getIcon(deliverable.type)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getStatusClass(deliverable.status)}`}>
                          {deliverable.status}
                        </span>
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold mb-1.5 text-gray-800 group-hover:text-indigo-600 transition-colors">
                      {deliverable.title}
                    </h3>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                      <span>{deliverable.date}</span>
                      {deliverable.size && (
                        <>
                          <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                          <span>{deliverable.size}</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => openDeliverable(deliverable)}
                        disabled={!deliverable.externalUrl && !deliverable.filePath}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                          deliverable.isExternal
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:bg-indigo-300'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400'
                        }`}
                      >
                        {deliverable.isExternal ? <ExternalLink size={16} /> : <Download size={16} />}
                        {deliverable.isExternal ? 'Open Link' : 'Download'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Deliverables;
