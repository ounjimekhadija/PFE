import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { nom: string; prenom: string; email: string };
  fromUser: { nom: string; prenom: string; email: string };
}

const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, user, fromUser }) => {
  const [subject, setSubject] = useState('Objectif de votre email');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'sending' | 'sent' | 'failed' | null>(null);

  const handleSendEmail = async () => {
    if (!body.trim()) {
      // Or some other validation
      alert("Please enter a message.");
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
        throw new Error('Failed to send email.');
      }

      setStatus('sent');
      setTimeout(() => {
        onClose();
        setStatus(null);
        setBody(''); // Reset body
      }, 2000);
    } catch (error: any) {
      setStatus('failed');
      console.error('Full error object:', error); // Log the full error
      setTimeout(() => {
        onClose();
        setStatus(null);
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-warm-surface rounded-2xl shadow-xl p-8 w-full max-w-lg flex flex-col border border-warm-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-warm-text">Send Email to {user.prenom} {user.nom}</h2>
          <button onClick={onClose} className="text-warm-text-muted hover:text-warm-text">
            <X size={24} />
          </button>
        </div>

        {status === 'sending' || status === 'sent' || status === 'failed' ? (
          <div className="text-center py-4">
            {status === 'sending' && <p className="text-blue-500">Sending email...</p>}
            {status === 'sent' && <p className="text-green-500">Email sent successfully!</p>}
            {status === 'failed' && <p className="text-red-500">Failed to send email. Please try again later.</p>}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="subject" className="block text-warm-text-muted mb-2">Subject</label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2 rounded-md bg-warm-field border border-warm-border focus:outline-none focus:ring-2 focus:ring-warm-accent"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="body" className="block text-warm-text-muted mb-2">Message</label>
              <textarea
                id="body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-2 rounded-md bg-warm-field border border-warm-border focus:outline-none focus:ring-2 focus:ring-warm-accent"
                placeholder={`Hi ${user.prenom},`}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSendEmail}
                disabled={status === 'sending'}
                className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
              >
                {status === 'sending' ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailModal;
