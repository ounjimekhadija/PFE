import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Mail, Send, X } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { nom: string; prenom: string; email: string };
  fromUser: { nom: string; prenom: string; email: string };
}

const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, user, fromUser }) => {
  const [subject, setSubject] = useState('Objet de votre email');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'sending' | 'sent' | 'failed' | null>(null);

  const handleSendEmail = async () => {
    if (!body.trim()) {
      alert("Veuillez saisir un message.");
      return;
    }
    setStatus('sending');

    try {
      const response = await fetch('/api/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          fromName: `${fromUser.nom} ${fromUser.prenom}`,
          subject: subject,
          text: body,
        }),
      });

      if (!response.ok) {
        throw new Error("L'envoi de l'email a échoué.");
      }

      setStatus('sent');
      setTimeout(() => {
        onClose();
        setStatus(null);
        setBody('');
      }, 2000);
    } catch (error: any) {
      setStatus('failed');
      console.error('Full error object:', error);
      setTimeout(() => {
        onClose();
        setStatus(null);
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F172A]/35 p-4 backdrop-blur-md transition-all animate-in fade-in duration-300 sm:items-center" onClick={onClose}>
      <div
        className="my-4 max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF3F8] px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#DCEBFA] text-[#1E3A5F]">
              <Mail size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[#1a1c1a]">Envoyer un email</h2>
              <p className="mt-1 truncate text-sm text-[#64748B]">
                À {user.prenom} {user.nom} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#64748B] transition-colors hover:text-[#1a1c1a]"
            aria-label="Fermer la fenêtre d'email"
          >
            <X size={20} />
          </button>
        </div>

        {status === 'sending' || status === 'sent' || status === 'failed' ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            {status === 'sending' && (
              <>
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#DCEBFA] border-t-[#1E3A5F]" />
                <p className="text-sm font-semibold text-[#334155]">Envoi de l'email...</p>
              </>
            )}
            {status === 'sent' && (
              <>
                <CheckCircle2 size={42} className="mb-4 text-[#16A34A]" />
                <p className="text-sm font-semibold text-[#166534]">Email envoyé avec succès.</p>
              </>
            )}
            {status === 'failed' && (
              <>
                <AlertCircle size={42} className="mb-4 text-[#ba1a1a]" />
                <p className="text-sm font-semibold text-[#ba1a1a]">Impossible d'envoyer l'email. Veuillez réessayer plus tard.</p>
              </>
            )}
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="mb-5">
              <label htmlFor="subject" className="mb-2 block text-sm font-bold text-[#334155]">Objet</label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-[#D8E2EC] bg-[#F8FAFC] px-4 py-3 text-sm text-[#1a1c1a] outline-none transition focus:border-[#1E3A5F] focus:bg-white focus:ring-4 focus:ring-[#DCEBFA]"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="body" className="mb-2 block text-sm font-bold text-[#334155]">Message</label>
              <textarea
                id="body"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[180px] w-full resize-y rounded-xl border border-[#D8E2EC] bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-[#1a1c1a] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:bg-white focus:ring-4 focus:ring-[#DCEBFA]"
                placeholder={`Bonjour ${user.prenom},`}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#EEF3F8] px-5 py-3 text-sm font-bold text-[#334155] transition-colors hover:bg-[#E2E8F0]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={status === 'sending'}
                className="flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#172D49] disabled:bg-[#BFD7EF]"
              >
                <Send size={16} />
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default EmailModal;
