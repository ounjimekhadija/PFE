import React, { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, FileArchive, Link as LinkIcon, File, Download, ExternalLink, Send, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { notifyProjectStudents } from '../../../lib/notifications';

interface Comment {
  id: string;
  author: string;
  content: string;
  time: string;
}

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
  projectId: string;
}

interface DeliverableGroup {
  groupName: string;
  deliverables: DeliverableItem[];
}

const STATUS_OPTIONS = [
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'REJECTED',  label: 'Rejected'  },
  { value: 'LATE',      label: 'Late'      },
];

const STATUS_SELECT_CLASS: Record<string, string> = {
  VALIDATED: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  REJECTED:  'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]',
  LATE:      'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]',
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const Deliverables: React.FC = () => {
  const [groups, setGroups]   = useState<DeliverableGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [comments,       setComments]       = useState<Record<string, Comment[]>>({});
  const [commentInputs,  setCommentInputs]  = useState<Record<string, string>>({});
  const [loadingCmts,    setLoadingCmts]    = useState<Record<string, boolean>>({});
  const [sendingComment, setSendingComment] = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [showComments,   setShowComments]   = useState<Record<string, boolean>>({});
  const [openStatusId,   setOpenStatusId]   = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF':  return <FileText    className="text-red-500"    size={22} />;
      case 'ZIP':  return <FileArchive className="text-amber-500"  size={22} />;
      case 'LINK': return <LinkIcon    className="text-[#765b00]"  size={22} />;
      default:     return <File        className="text-[#7f7664]"  size={22} />;
    }
  };

  const fetchProfessorProjectIds = async (authUserId: string): Promise<string[]> => {
    const ids = new Set<string>();
    const { data } = await supabase.from('projets').select('id').eq('encadrant_id', authUserId);
    (data || []).forEach((r: any) => { if (r?.id) ids.add(String(r.id)); });
    return Array.from(ids);
  };

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setGroups([]); return; }

        const projectIds = await fetchProfessorProjectIds(user.id);
        if (projectIds.length === 0) { setGroups([]); return; }

        const { data: rows, error: rowsError } = await supabase
          .from('livrables')
          .select(`
            id, titre, type_document, statut, created_at, projet_id,
            projets(titre),
            livrable_versions(id, created_at, est_lien_externe, url_externe, chemin_fichier, taille_fichier)
          `)
          .in('projet_id', projectIds)
          .order('created_at', { ascending: false });

        if (rowsError) throw rowsError;

        const grouped: Record<string, DeliverableItem[]> = {};
        (rows || []).forEach((row: any) => {
          const projectObj = Array.isArray(row.projets) ? row.projets[0] : row.projets;
          const groupName  = projectObj?.titre || `Projet ${row.projet_id}`;

          const versions = Array.isArray(row.livrable_versions) ? [...row.livrable_versions] : [];
          versions.sort((a: any, b: any) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
          const v = versions[0] || null;

          const item: DeliverableItem = {
            id: String(row.id),
            title: row.titre || 'Untitled',
            type: row.type_document || 'DOC',
            date: formatDate(v?.created_at || row.created_at),
            status: row.statut || 'PENDING',
            size: v?.taille_fichier || undefined,
            isExternal: Boolean(v?.est_lien_externe),
            externalUrl: v?.url_externe || undefined,
            filePath: v?.chemin_fichier || undefined,
            projectId: String(row.projet_id),
          };

          if (!grouped[groupName]) grouped[groupName] = [];
          grouped[groupName].push(item);
        });

        const result = Object.entries(grouped).map(([groupName, deliverables]) => ({ groupName, deliverables }));
        setGroups(result);

        const allIds = (rows || []).map((r: any) => String(r.id));
        if (allIds.length > 0) {
          const { data: cmtRows, error: cmtErr } = await supabase
            .from('livrable_commentaires')
            .select('id, livrable_id, contenu, created_at, auteur_id')
            .in('livrable_id', allIds)
            .order('created_at', { ascending: true });

          console.log('[load comments]', cmtRows, cmtErr);

          if (cmtRows && cmtRows.length > 0) {
            const authorIds = [...new Set(cmtRows.map((c: any) => c.auteur_id))];
            const { data: users } = await supabase
              .from('utilisateurs')
              .select('id, nom, prenom')
              .in('id', authorIds);

            const userMap: Record<string, string> = {};
            (users || []).forEach((u: any) => {
              userMap[u.id] = `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur';
            });

            const byId: Record<string, Comment[]> = {};
            cmtRows.forEach((c: any) => {
              const lid = String(c.livrable_id);
              if (!byId[lid]) byId[lid] = [];
              byId[lid].push({
                id:      String(c.id),
                author:  userMap[c.auteur_id] || 'Utilisateur',
                content: c.contenu,
                time:    fmt(c.created_at),
              });
            });
            setComments(byId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load.');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalCount = useMemo(() => groups.reduce((acc, g) => acc + g.deliverables.length, 0), [groups]);

  const handleStatusChange = async (deliverableId: string, newStatus: string) => {
    setUpdatingStatus(prev => ({ ...prev, [deliverableId]: true }));
    const { data, error } = await supabase
      .from('livrables')
      .update({ statut: newStatus })
      .eq('id', deliverableId)
      .select('id, statut')
      .single();

    console.log('[status update] id:', deliverableId, 'new:', newStatus, '| data:', data, '| error:', error);

    if (error) {
      setError(`Erreur mise à jour statut: ${error.message}`);
    } else {
      setGroups(prev => prev.map(g => ({
        ...g,
        deliverables: g.deliverables.map(d => d.id === deliverableId ? { ...d, status: newStatus } : d),
      })));

      const { data: { user } } = await supabase.auth.getUser();
      const deliverable = groups.flatMap(g => g.deliverables).find(d => d.id === deliverableId);
      if (user && deliverable) {
        await notifyProjectStudents({
          projectId: deliverable.projectId,
          senderId: user.id,
          title: 'Deliverable Validated',
          message: `Your deliverable "${deliverable.title}" has been ${newStatus.toLowerCase()}.`,
          type: 'VALIDATION_LIVRABLE'
        });
      }
    }
    setUpdatingStatus(prev => ({ ...prev, [deliverableId]: false }));
  };

  const sendComment = async (deliverableId: string) => {
    const text = (commentInputs[deliverableId] || '').trim();
    if (!text) return;
    setSendingComment(prev => ({ ...prev, [deliverableId]: true }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSendingComment(prev => ({ ...prev, [deliverableId]: false })); return; }

    const { data: inserted, error: insertError } = await supabase
      .from('livrable_commentaires')
      .insert({ livrable_id: deliverableId, auteur_id: user.id, contenu: text })
      .select('id, created_at')
      .single();

    console.log('[sendComment] insert result:', inserted, insertError);

    if (insertError) {
      setError(`Erreur commentaire: ${insertError.message}`);
      setSendingComment(prev => ({ ...prev, [deliverableId]: false }));
      return;
    }

    const { data: utilData } = await supabase
      .from('utilisateurs')
      .select('nom, prenom')
      .eq('id', user.id)
      .single();

    const authorName = utilData
      ? `${utilData.prenom || ''} ${utilData.nom || ''}`.trim() || 'Moi'
      : 'Moi';

    const newComment: Comment = {
      id:      String(inserted.id),
      author:  authorName,
      content: text,
      time:    fmt(inserted.created_at),
    };

    setComments(prev => ({ ...prev, [deliverableId]: [...(prev[deliverableId] || []), newComment] }));
    setCommentInputs(prev => ({ ...prev, [deliverableId]: '' }));
    setSendingComment(prev => ({ ...prev, [deliverableId]: false }));

    const deliverable = groups.flatMap(g => g.deliverables).find(d => d.id === deliverableId);
    if (deliverable) {
      await notifyProjectStudents({
        projectId: deliverable.projectId,
        senderId: user.id,
        title: 'New Comment',
        message: `Professor added a comment on "${deliverable.title}".`,
        type: 'COMMENT_LIVRABLE'
      });
    }
  };

  const triggerBrowserDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const openDeliverable = async (deliverable: DeliverableItem) => {
    try {
      setError(null);
      if (deliverable.isExternal && deliverable.externalUrl) {
        const url = deliverable.externalUrl.startsWith('http') ? deliverable.externalUrl : `https://${deliverable.externalUrl}`;
        window.open(url, '_blank', 'noopener,noreferrer'); return;
      }
      if (!deliverable.filePath) { setError('Aucun fichier associé à ce livrable.'); return; }

      const raw = deliverable.filePath.trim()
        .replace(/^https?:\/\/[^/]+\//, '')
        .replace(/^storage\/v1\/object\/(public|sign)\//, '')
        .replace(/^\/+/, '');

      const candidates: [string, string][] = [];
      const uploadsMatch = raw.match(/^uploads\/(.+)$/);
      if (uploadsMatch) {
        candidates.push(['uploads', uploadsMatch[1]]);
        candidates.push(['documents', raw]);
        candidates.push(['livrables', raw]);
      } else {
        candidates.push(['documents', raw]);
        candidates.push(['livrables', raw]);
        candidates.push(['uploads',   raw]);
      }

      const fileName = raw.split('/').pop() || `${deliverable.title}.bin`;

      for (const [bucket, path] of candidates) {
        const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
        if (!dlErr && blob) { triggerBrowserDownload(blob, fileName); return; }
      }
      for (const [bucket, path] of candidates) {
        const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
        if (!signErr && data?.signedUrl) { window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); return; }
      }
      throw new Error('Fichier introuvable.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'ouvrir ce livrable.');
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setOpenStatusId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-[#faf9f6] p-6 md:p-8 text-[#1a1c1a]"
      style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
    >
      {/* Header — fixe, ne scroll pas */}
      <header className="mb-6 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Group Deliverables</h1>
          <p className="mt-1.5 text-sm text-[#7f7664]">View and manage all project deliverables by group</p>
          <p className="mt-1 text-xs text-[#7f7664]">{totalCount} livrable(s)</p>
        </div>
      </header>

      {loading && <p className="mb-4 text-sm text-[#7f7664] flex-shrink-0">Chargement des livrables...</p>}
      {!loading && error && <p className="mb-4 text-sm text-[#ba1a1a] flex-shrink-0">Erreur: {error}</p>}
      {!loading && !error && groups.length === 0 && (
        <p className="mb-4 text-sm text-[#7f7664] flex-shrink-0">Aucun livrable trouvé pour les projets assignés à cet encadrant.</p>
      )}

      {/* Liste scrollable */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1c5b0 transparent' }}
      >
        <div className="space-y-7 pb-6">
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#d1c5b0]" />
                <h2 className="rounded-full border border-[#ebc254] bg-[#ffd464] px-3 py-1.5 text-lg font-bold text-[#594400]">
                  {group.groupName}
                </h2>
                <div className="h-px flex-1 bg-[#d1c5b0]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {group.deliverables.map((deliverable) => {
                  const delivComments = comments[deliverable.id] ?? [];
                  const statusClass   = STATUS_SELECT_CLASS[deliverable.status] ?? STATUS_SELECT_CLASS.PENDING;
                  const isOpen        = showComments[deliverable.id] ?? false;

                  return (
                    <motion.div
                      key={deliverable.id}
                      whileHover={{ scale: 1.01 }}
                      className="group relative flex flex-col rounded-2xl border border-transparent bg-white shadow-[0_4px_16px_rgba(118,91,0,0.06)] transition-all hover:border-[#ebc254] overflow-hidden"
                    >
                      <div className="p-4 flex-1 flex flex-col">

                        {/* Top row: icon + status select */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="rounded-2xl bg-[#f4f3f1] p-2.5">
                            {getIcon(deliverable.type)}
                          </div>

                          {/* Status dropdown */}
                          <div className="relative" ref={openStatusId === deliverable.id ? statusDropdownRef : null}>
                            <button
                              type="button"
                              onClick={() => setOpenStatusId(openStatusId === deliverable.id ? null : deliverable.id)}
                              disabled={updatingStatus[deliverable.id]}
                              className={`flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1.5 py-1 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50 ${statusClass}`}
                            >
                              {STATUS_OPTIONS.find(o => o.value === deliverable.status)?.label || deliverable.status}
                              <ChevronDown size={11} className={`transition-transform duration-200 ${openStatusId === deliverable.id ? 'rotate-180' : ''}`} />
                            </button>

                            {openStatusId === deliverable.id && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-32 origin-top-right rounded-xl border border-transparent bg-white p-1 shadow-[0_8px_32px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-200">
                                {STATUS_OPTIONS.map(o => {
                                  const isSel = deliverable.status === o.value;
                                  const optColors: Record<string, string> = {
                                    VALIDATED: isSel ? 'bg-[#dcfce7] text-[#166534]' : 'hover:bg-[#dcfce7]/40 text-[#166534]',
                                    REJECTED:  isSel ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'hover:bg-[#ffdad6]/40 text-[#ba1a1a]',
                                    LATE:      isSel ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'hover:bg-[#ffdad6]/40 text-[#ba1a1a]',
                                  };
                                  return (
                                    <button
                                      key={o.value}
                                      type="button"
                                      onClick={() => { handleStatusChange(deliverable.id, o.value); setOpenStatusId(null); }}
                                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-bold transition-colors ${optColors[o.value] || 'hover:bg-[#f4f3f1]'}`}
                                    >
                                      {o.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <h3 className="mb-1.5 text-base font-bold text-[#1a1c1a] transition-colors group-hover:text-[#765b00]">
                          {deliverable.title}
                        </h3>

                        <div className="mb-4 flex items-center gap-3 text-xs text-[#7f7664]">
                          <span>{deliverable.date}</span>
                          {deliverable.size && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-[#d1c5b0]" />
                              <span>{deliverable.size}</span>
                            </>
                          )}
                        </div>

                        {/* Download */}
                        <button
                          onClick={() => openDeliverable(deliverable)}
                          disabled={!deliverable.externalUrl && !deliverable.filePath}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all mb-4 ${
                            deliverable.isExternal
                              ? 'bg-[#765b00] text-white shadow-md hover:bg-[#594400] disabled:bg-[#ebc254]'
                              : 'border border-[#d1c5b0] bg-[#f4f3f1] text-[#4d4636] hover:bg-white disabled:opacity-50'
                          }`}
                        >
                          {deliverable.isExternal ? <ExternalLink size={15} /> : <Download size={15} />}
                          {deliverable.isExternal ? 'Open Link' : 'Download'}
                        </button>

                        {/* Comments toggle button */}
                        <button
                          onClick={() => setShowComments(prev => {
                            const alreadyOpen = prev[deliverable.id];
                            const reset: Record<string, boolean> = {};
                            return alreadyOpen ? reset : { ...reset, [deliverable.id]: true };
                          })}
                          className="mt-2 w-full flex items-center justify-between border-t border-[#f4f3f1] pt-3 text-[10px] font-bold uppercase tracking-widest text-[#7f7664] hover:text-[#4d4636] transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <MessageSquare size={12} />
                            Commentaires {delivComments.length > 0 ? `(${delivComments.length})` : ''}
                          </span>
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {/* Collapsible panel */}
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key="comments"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2 max-h-40 overflow-y-auto pt-2">
                                {loadingCmts[deliverable.id] && (
                                  <p className="text-[11px] text-[#7f7664]">Chargement...</p>
                                )}
                                {!loadingCmts[deliverable.id] && delivComments.length === 0 && (
                                  <p className="text-[11px] text-[#d1c5b0] text-center py-1">Aucun commentaire.</p>
                                )}
                                {delivComments.map(c => (
                                  <div key={c.id} className="flex gap-2">
                                    <img
                                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&size=22&background=random`}
                                      className="h-5 w-5 shrink-0 rounded-full mt-0.5"
                                      alt=""
                                    />
                                    <div className="flex-1 rounded-xl bg-[#faf9f6] px-2.5 py-1.5">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[11px] font-bold text-[#1a1c1a]">{c.author}</span>
                                        <span className="text-[10px] text-[#7f7664]">{c.time}</span>
                                      </div>
                                      <p className="text-[11px] text-[#4d4636]">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 rounded-xl border border-[#d1c5b0] bg-[#faf9f6] px-3 py-2 focus-within:border-[#765b00] transition mt-2">
                                <input
                                  type="text"
                                  placeholder="Laisser un commentaire..."
                                  value={commentInputs[deliverable.id] || ''}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [deliverable.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendComment(deliverable.id); } }}
                                  className="flex-1 bg-transparent text-xs text-[#4d4636] outline-none placeholder:text-[#d1c5b0]"
                                />
                                <button
                                  type="button"
                                  onClick={() => sendComment(deliverable.id)}
                                  disabled={!commentInputs[deliverable.id]?.trim() || sendingComment[deliverable.id]}
                                  className="text-[#765b00] hover:text-[#594400] disabled:opacity-30 transition"
                                >
                                  <Send size={13} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Deliverables;