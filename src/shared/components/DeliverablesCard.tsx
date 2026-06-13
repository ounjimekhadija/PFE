import React from 'react';
import { Paperclip, FileText } from 'lucide-react';

interface Deliverable {
  id: string;
  title: string;
  description: string;
  file_url: string | null;
  link_url: string | null;
  created_at: string;
}

interface DeliverablesCardProps {
  iterationNumber: number;
  deliverables: Deliverable[];
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

const DeliverablesCard: React.FC<DeliverablesCardProps> = ({ iterationNumber, deliverables }) => {
  if (deliverables.length === 0) {
    return null;
  }

  return (
    <div className="flex w-80 shrink-0 flex-col rounded-2xl border border-transparent bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-[#EEF3F8] px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#1E3A5F]" />
          <span className="text-sm font-bold text-[#1a1c1a]">Deliverables (Iteration {iterationNumber})</span>
        </div>
        <span className="rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[11px] font-bold text-[#64748B]">{deliverables.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 max-h-[400px]">
        {deliverables.map(livrable => (
          <a
            key={livrable.id}
            href={livrable.file_url || livrable.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl border border-[#EEF3F8] bg-[#F8FAFC] p-3 text-left transition hover:border-[#C8D6E5] hover:shadow-sm"
          >
            <p className="mb-1 text-sm font-semibold text-[#1a1c1a] leading-snug">{livrable.title}</p>
            {livrable.description && <p className="mb-2 text-xs text-[#64748B] line-clamp-2">{livrable.description}</p>}
            <div className="flex items-center justify-between text-[10px] text-[#64748B]">
              <div className="flex items-center gap-1">
                <Paperclip size={11} />
                <span>{livrable.file_url ? 'File' : 'Link'}</span>
              </div>
              <span className="text-[9px] text-[#C8D6E5]">{fmt(livrable.created_at)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default DeliverablesCard;
