import React from 'react';

const IMAGE_TAG = '[image]';

interface MessageContentProps {
  text: string;
}

const MessageContent: React.FC<MessageContentProps> = ({ text }) => {
  if (text.startsWith(IMAGE_TAG)) {
    const imageUrl = text.substring(IMAGE_TAG.length);
    return (
      <a href={imageUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={imageUrl}
          alt="Attachment"
          className="max-w-xs rounded-lg cursor-pointer"
        />
      </a>
    );
  }

  return <>{text}</>;
};

export default MessageContent;
