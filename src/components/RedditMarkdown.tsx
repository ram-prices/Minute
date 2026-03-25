import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { decodeHtml } from '../lib/decode';

const RedditMarkdown = ({ content, metadata }: { content: string; metadata?: any }) => {
  if (!content) return null;

  const decodedContent = decodeHtml(content);

  const processedContent = decodedContent.replace(/:([a-zA-Z0-9_|[\]-]+):/g, (match, name) => {
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
          return <a {...props} className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer" />;
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
        },
        h1: ({ node, ...props }) => <h1 {...props} className="text-base font-bold my-2" />,
        h2: ({ node, ...props }) => <h2 {...props} className="text-sm font-bold my-1.5" />,
        h3: ({ node, ...props }) => <h3 {...props} className="text-xs font-bold my-1" />,
        h4: ({ node, ...props }) => <h4 {...props} className="text-xs font-bold my-1" />,
        h5: ({ node, ...props }) => <h5 {...props} className="text-xs font-bold my-1" />,
        h6: ({ node, ...props }) => <h6 {...props} className="text-xs font-bold my-1" />
      }}
    >
      {processedContent}
    </Markdown>
  );
};

export default RedditMarkdown;
