import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const RedditMarkdown = ({ content, metadata }: { content: string; metadata?: any }) => {
  if (!content) return null;

  const processedContent = content.replace(/:([a-zA-Z0-9_|[\]-]+):/g, (match, name) => {
    if (!metadata) return match;
    const emojiData = metadata[name] || Object.values(metadata).find((v: any) => v.id === name || v.id?.includes(`|${name}`));
    if (emojiData && emojiData.s && emojiData.s.u) {
      const url = emojiData.s.u.replace(/&amp;/g, '&');
      return `![:${name}:](${url})`;
    }
    return match;
  });

  return (
    <Markdown 
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => {
          if (props.href?.includes('preview.redd.it')) {
            const decodedUrl = props.href.replace(/&amp;/g, '&');
            return <img src={decodedUrl} alt={props.children as string} referrerPolicy="no-referrer" className="max-w-full rounded-lg" />;
          }
          return <a {...props} className="text-[#FF4500] hover:underline" target="_blank" rel="noopener noreferrer" />;
        },
        img: ({ node, ...props }) => {
          const isEmoji = props.alt?.startsWith(':') && props.alt?.endsWith(':');
          return (
            <img 
              {...props} 
              className={isEmoji ? 'reddit-emoji' : `${props.className || ''} max-w-full rounded-lg`} 
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          );
        }
      }}
    >
      {processedContent}
    </Markdown>
  );
};

export default RedditMarkdown;
