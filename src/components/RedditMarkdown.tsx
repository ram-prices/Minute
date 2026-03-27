import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { decodeHtml } from '../lib/decode';
import { getProxiedMediaUrl } from '../lib/media';

const RedditMarkdown = ({ content, metadata }: { content: string; metadata?: any }) => {
  if (!content) return null;

  const decodedContent = decodeHtml(content);

  let processedContent = decodedContent.replace(/:([a-zA-Z0-9_|[\]-]+):/g, (match, name) => {
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
      rehypePlugins={[rehypeRaw]}
      urlTransform={(value) => value}
      components={{
        a: ({ node, ...props }) => {
          let href = props.href;
          let isVideo = false;
          if (href && metadata && metadata[href] && metadata[href].s) {
            if (metadata[href].s.mp4) {
              href = metadata[href].s.mp4.replace(/&amp;/g, '&');
              isVideo = true;
            } else {
              const mediaUrl = metadata[href].s.gif || metadata[href].s.u;
              if (mediaUrl) {
                href = mediaUrl.replace(/&amp;/g, '&');
              }
            }
          } else if (href?.startsWith('giphy|')) {
            const giphyId = href.split('|')[1];
            href = `https://media.giphy.com/media/${giphyId}/giphy.gif`;
          } else if (href?.startsWith('tenor|')) {
            const tenorId = href.split('|')[1];
            href = `https://tenor.com/view/${tenorId}.gif`;
          } else if (href) {
            href = href.replace(/&amp;/g, '&');
          }

          if (isVideo) {
            return (
              <video 
                src={href} 
                className="max-w-full rounded-lg" 
                autoPlay 
                loop 
                muted 
                playsInline 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            );
          }

          if (href?.includes('preview.redd.it') || href?.includes('giphy.com') || href?.includes('tenor.com')) {
            if (href.includes('tenor.com/view/')) {
              const match = href.split('?')[0].match(/tenor\.com\/view\/(?:.*-)?([0-9]+)$/);
              if (match && match[1]) {
                const id = match[1];
                return <img src={`https://tenor.com/view/${id}.gif`} alt={props.children as string} referrerPolicy="no-referrer" className="max-w-full rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
              }
            } else if (href.includes('giphy.com/gifs/')) {
              const match = href.split('?')[0].match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
              if (match && match[1]) {
                const id = match[1];
                return <img src={`https://media.giphy.com/media/${id}/giphy.gif`} alt={props.children as string} referrerPolicy="no-referrer" className="max-w-full rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
              }
            }
            return <img src={href} alt={props.children as string} referrerPolicy="no-referrer" className="max-w-full rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
          }
          return <a {...props} href={href} className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer" />;
        },
        img: ({ node, ...props }) => {
          const isEmoji = props.alt?.startsWith(':') && props.alt?.endsWith(':');
          let src = props.src;
          let isVideo = false;
          
          // Check if src is an ID in media_metadata
          if (src && metadata && metadata[src] && metadata[src].s) {
            if (metadata[src].s.mp4) {
              src = metadata[src].s.mp4.replace(/&amp;/g, '&');
              isVideo = true;
            } else {
              const mediaUrl = metadata[src].s.gif || metadata[src].s.u;
              if (mediaUrl) {
                src = mediaUrl.replace(/&amp;/g, '&');
              }
            }
          } else if (src?.startsWith('giphy|')) {
            const giphyId = src.split('|')[1];
            src = `https://media.giphy.com/media/${giphyId}/giphy.gif`;
          } else if (src?.startsWith('tenor|')) {
            const tenorId = src.split('|')[1];
            src = `https://tenor.com/view/${tenorId}.gif`;
          } else if (src?.includes('tenor.com/view/')) {
            const match = src.split('?')[0].match(/tenor\.com\/view\/(?:.*-)?([0-9]+)$/);
            if (match && match[1]) {
              src = `https://tenor.com/view/${match[1]}.gif`;
            }
          } else if (src?.includes('giphy.com/gifs/')) {
            const match = src.split('?')[0].match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
            if (match && match[1]) {
              src = `https://media.giphy.com/media/${match[1]}/giphy.gif`;
            }
          } else if (src) {
            src = src.replace(/&amp;/g, '&');
          }

          if (isVideo) {
            return (
              <video 
                src={src ? getProxiedMediaUrl(src) : undefined} 
                className={`${props.className || ''} max-w-full rounded-lg`} 
                autoPlay 
                loop 
                muted 
                playsInline 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            );
          }

          return (
            <img 
              {...props} 
              src={src ? getProxiedMediaUrl(src) : undefined}
              className={isEmoji ? 'reddit-emoji' : `${props.className || ''} max-w-full rounded-lg`} 
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
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
