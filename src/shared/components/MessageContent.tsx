import React from 'react';

const IMAGE_TAG = '[image]';
const FILE_TAG = '[file]';

interface MessageContentProps {
  text: string;
}

const isPdf = (nameOrUrl: string) => {
  return nameOrUrl.toLowerCase().endsWith('.pdf');
};

const MessageContent: React.FC<MessageContentProps> = ({ text }) => {
  if (!text) return null;

  if (text.startsWith(IMAGE_TAG)) {
    const imageUrl = text.substring(IMAGE_TAG.length);
    return (
      <a href={imageUrl} target="_blank" rel="noopener noreferrer">
        <img src={imageUrl} alt="Attachment" className="max-w-xs rounded-lg cursor-pointer" />
      </a>
    );
  }

  if (text.startsWith(FILE_TAG)) {
    const raw = text.substring(FILE_TAG.length);
    const parts = raw.split('||');
    const name = parts[0] || 'file';
    const url = parts[1] || parts[0] || '';

    if (!url) return <>{name}</>;

    // Show filename and download button for all file types (no preview/scroll)
    const nameParts = name.split('.');
    const ext = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : 'FILE';
    
    return (
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-between bg-[#DCEBFA] text-[#1E3A5F] rounded-xl shadow-sm px-4 py-3 border border-[#8FB4D9]/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center bg-[#1E3A5F] text-white rounded-md shrink-0">
              <span className="text-sm font-bold">{ext}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{name}</div>
              <div className="text-xs text-[#64748B]">{ext}</div>
            </div>
          </div>
          <a href={url} target="_blank" rel="noreferrer" download={name} className="ml-3 inline-flex items-center gap-2 rounded bg-[#1E3A5F] px-3 py-1 text-sm font-medium text-white hover:bg-[#172D49]">
            Download
          </a>
        </div>
      </div>
    );
  }

  return <>{text}</>;
};

export default MessageContent;
