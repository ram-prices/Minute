import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { decodeHtml } from '../lib/decode';

// Resolve a src/href that might be a media_metadata key or a known GIF URL
function resolveMediaSrc(src: string | undefined, metadata: any): { url: string; isVideo: boolean } | null {
  if (!src) return null;

  const cleanSrc = src.split('?')[0].replace(/\/$/, '');

  // Direct media_metadata lookup (Reddit native GIFs: ![gif](mediaId))
  if (metadata?.[src]) {
    const m = metadata[src];
    // AnimatedImage type: has s.gif or s.mp4 or s.u
    // Prioritize MP4 for performance
    if (m.s?.mp4) return { url: m.s.mp4.replace(/&amp;/g, '&'), isVideo: true };
    if (m.s?.gif) return { url: m.s.gif.replace(/&amp;/g, '&'), isVideo: false };
    if (m.s?.u)   return { url: m.s.u.replace(/&amp;/g, '&'), isVideo: false };
  }

  // giphy| and tenor| shorthand
  if (cleanSrc.startsWith('giphy|')) {
    const id = cleanSrc.split('|')[1];
    return { url: `https://i.giphy.com/${id}.mp4`, isVideo: true };
  }
  if (cleanSrc.startsWith('tenor|')) {
    const id = cleanSrc.split('|')[1];
    return { url: `https://c.tenor.com/${id}/tenor.mp4`, isVideo: true };
  }

  // Full giphy URLs
  if (cleanSrc.includes('giphy.com/gifs/')) {
    const match = cleanSrc.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
    if (match?.[1]) return { url: `https://i.giphy.com/${match[1]}.mp4`, isVideo: true };
  }
  if (cleanSrc.includes('media.giphy.com/media/')) {
    const match = cleanSrc.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)/);
    if (match?.[1]) return { url: `https://i.giphy.com/${match[1]}.mp4`, isVideo: true };
  }

  // Full tenor URLs
  if (cleanSrc.includes('tenor.com/view/')) {
    const match = cleanSrc.match(/tenor\.com\/view\/(?:.*-)?([0-9]+)$/);
    if (match?.[1]) return { url: `https://c.tenor.com/${match[1]}/tenor.mp4`, isVideo: true };
  }
  if (cleanSrc.includes('c.tenor.com/') && cleanSrc.endsWith('.gif')) {
    return { url: cleanSrc.replace('.gif', '.mp4'), isVideo: true };
  }

  // Imgur gifv
  if (cleanSrc.includes('imgur.com/') && cleanSrc.endsWith('.gifv')) {
    return { url: cleanSrc.replace('.gifv', '.mp4'), isVideo: true };
  }

  // Direct mp4
  if (cleanSrc.endsWith('.mp4')) {
    return { url: src, isVideo: true };
  }

  // Direct gif/jpg/png
  if (cleanSrc.match(/\.(gif|jpe?g|png)$/i)) {
    return { url: src, isVideo: false };
  }

  // preview.redd.it and other direct media
  if (src.includes('preview.redd.it') || src.includes('i.redd.it')) {
    return { url: src.replace(/&amp;/g, '&'), isVideo: false };
  }

  return null;
}

const LinkEmbed = ({ href, resolved, props }: { href: string, resolved: { url: string, isVideo: boolean }, props: any }) => {
  const [error, setError] = useState(false);
  const hasCustomText = props.children && String(props.children) !== href;

  if (error) {
    return (
      <a
        {...props}
        href={href}
        className="text-primary hover:underline font-medium break-words"
        target="_blank"
        rel="noopener noreferrer"
      >
        {props.children || href}
      </a>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1 my-2 w-full">
      {hasCustomText && (
        <a
          {...props}
          href={href}
          className="text-primary hover:underline font-medium break-words"
          target="_blank"
          rel="noopener noreferrer"
        >
          {props.children}
        </a>
      )}
      <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full relative group">
        {resolved.isVideo ? (
          <video
            src={resolved.url}
            className="max-w-full rounded-lg bg-black/5"
            autoPlay
            loop
            muted
            playsInline
            controls
            onError={() => setError(true)}
          />
        ) : (
          <img
            src={resolved.url}
            alt={String(props.children || '')}
            referrerPolicy="no-referrer"
            className="max-w-full rounded-lg bg-black/5"
            onError={() => setError(true)}
          />
        )}
      </a>
    </span>
  );
};

const ImageEmbed = ({ rawSrc, resolved, props, isEmoji }: { rawSrc: string, resolved: { url: string, isVideo: boolean } | null, props: any, isEmoji: boolean }) => {
  const [error, setError] = useState(false);
  const finalSrc = resolved?.url ?? rawSrc;
  const isVideo = resolved?.isVideo ?? false;

  if (error || !finalSrc) {
    return <span className="italic text-text-secondary">[{props.alt || 'image'}]</span>;
  }

  if (isVideo) {
    return (
      <video
        src={finalSrc}
        className={`${props.className || ''} max-w-full rounded-lg my-2 bg-black/5`}
        autoPlay
        loop
        muted
        playsInline
        controls
        onError={() => setError(true)}
      />
    );
  }

  return (
    <img
      {...props}
      src={finalSrc}
      className={isEmoji ? 'reddit-emoji inline-block w-5 h-5 align-middle' : `${props.className || ''} max-w-full rounded-lg my-2 bg-black/5`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
};

const RedditMarkdown = ({ content, metadata, onRedditLinkClick }: { content: string; metadata?: any; onRedditLinkClick?: (url: string) => void }) => {
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
            return <LinkEmbed href={href} resolved={resolved} props={props} />;
          }

          if (onRedditLinkClick && (
            href.includes('reddit.com/r/') || 
            href.startsWith('/r/') || 
            href.includes('reddit.com/u/') || 
            href.startsWith('/u/') || 
            href.includes('redd.it/') ||
            href.match(/reddit\.com\/[a-zA-Z0-9]+\/?$/)
          )) {
            return (
              <a
                {...props}
                href={href}
                className="text-primary hover:underline font-medium break-words"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRedditLinkClick(href);
                }}
              />
            );
          }

          return (
            <a
              {...props}
              href={href}
              className="text-primary hover:underline font-medium break-words"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            />
          );
        },

        img: ({ node, ...props }) => {
          const isEmoji = props.alt?.startsWith(':') && props.alt?.endsWith(':');
          const rawSrc = props.src?.replace(/&amp;/g, '&');
          const resolved = rawSrc ? resolveMediaSrc(rawSrc, metadata) : null;

          return <ImageEmbed rawSrc={rawSrc || ''} resolved={resolved} props={props} isEmoji={isEmoji || false} />;
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
