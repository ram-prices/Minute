import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { decodeHtml } from '../lib/decode';

// Resolve a src/href that might be a media_metadata key or a known GIF URL
function resolveMediaSrc(src: string | undefined, metadata: any): { url: string; isVideo: boolean } | null {
  if (!src) return null;

  // Direct media_metadata lookup (Reddit native GIFs: ![gif](mediaId))
  if (metadata?.[src]) {
    const m = metadata[src];
    // AnimatedImage type: has s.gif or s.mp4 or s.u
    // Prioritize GIF so it renders in an <img> tag which supports referrerPolicy="no-referrer"
    if (m.s?.gif) return { url: m.s.gif.replace(/&amp;/g, '&'), isVideo: false };
    if (m.s?.mp4) return { url: m.s.mp4.replace(/&amp;/g, '&'), isVideo: true };
    if (m.s?.u)   return { url: m.s.u.replace(/&amp;/g, '&'), isVideo: false };
  }

  // giphy| and tenor| shorthand
  if (src.startsWith('giphy|')) {
    const id = src.split('|')[1];
    return { url: `https://media.giphy.com/media/${id}/giphy.gif`, isVideo: false };
  }
  if (src.startsWith('tenor|')) {
    const id = src.split('|')[1];
    // tenor IDs are numeric; best effort URL
    return { url: `https://c.tenor.com/${id}/tenor.gif`, isVideo: false };
  }

  // Full giphy/tenor URLs
  if (src.includes('giphy.com/gifs/')) {
    const match = src.split('?')[0].match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
    if (match?.[1]) return { url: `https://media.giphy.com/media/${match[1]}/giphy.gif`, isVideo: false };
  }
  if (src.includes('tenor.com/view/')) {
    const match = src.split('?')[0].match(/tenor\.com\/view\/(?:.*-)?([0-9]+)$/);
    if (match?.[1]) return { url: `https://c.tenor.com/${match[1]}/tenor.gif`, isVideo: false };
  }

  // preview.redd.it and other direct media
  if (src.includes('preview.redd.it') || src.includes('i.redd.it')) {
    return { url: src.replace(/&amp;/g, '&'), isVideo: false };
  }

  return null;
}

const RedditMarkdown = ({ content, metadata }: { content: string; metadata?: any }) => {
  if (!content) return null;

  const decodedContent = decodeHtml(content);

  // Replace :emoji: shortcodes with markdown images
  let processedContent = decodedContent.replace(/:([a-zA-Z0-9_|[\]-]+):/g, (match, name) => {
    if (!metadata) return match;
    const emojiData = metadata[name] || Object.values(metadata).find((v: any) => v.id === name || v.id?.includes(`|${name}`));
    if (emojiData?.s?.u) {
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
          const href = props.href?.replace(/&amp;/g, '&');
          if (!href) return <a {...props} />;

          const resolved = resolveMediaSrc(href, metadata);
          if (resolved) {
            if (resolved.isVideo) {
              return (
                <video
                  src={resolved.url}
                  className="max-w-full rounded-lg"
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              );
            }
            return (
              <img
                src={resolved.url}
                alt={String(props.children || '')}
                referrerPolicy="no-referrer"
                className="max-w-full rounded-lg"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            );
          }

          return (
            <a
              {...props}
              href={href}
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            />
          );
        },

        img: ({ node, ...props }) => {
          const isEmoji = props.alt?.startsWith(':') && props.alt?.endsWith(':');
          const rawSrc = props.src?.replace(/&amp;/g, '&');

          const resolved = rawSrc ? resolveMediaSrc(rawSrc, metadata) : null;
          const finalSrc = resolved?.url ?? rawSrc;
          const isVideo = resolved?.isVideo ?? false;

          if (isVideo && finalSrc) {
            return (
              <video
                src={finalSrc}
                className={`${props.className || ''} max-w-full rounded-lg`}
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            );
          }

          return (
            <img
              {...props}
              src={finalSrc}
              className={isEmoji ? 'reddit-emoji' : `${props.className || ''} max-w-full rounded-lg`}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          );
        },

        h1: ({ node, ...props }) => <h1 {...props} className="text-base font-bold my-2" />,
        h2: ({ node, ...props }) => <h2 {...props} className="text-sm font-bold my-1.5" />,
        h3: ({ node, ...props }) => <h3 {...props} className="text-xs font-bold my-1" />,
        h4: ({ node, ...props }) => <h4 {...props} className="text-xs font-bold my-1" />,
        h5: ({ node, ...props }) => <h5 {...props} className="text-xs font-bold my-1" />,
        h6: ({ node, ...props }) => <h6 {...props} className="text-xs font-bold my-1" />,
      }}
    >
      {processedContent}
    </Markdown>
  );
};

export default RedditMarkdown;
