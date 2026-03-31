/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { RedditPost, getStreamableId, getTwitterId, getBlueskyId } from '../services/reddit';
import { MessageSquare, ArrowUp, ArrowDown, MoreVertical, Play, Maximize2, User, Trash2, Twitter, MessageCircle, Link } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import VideoPlayer from './VideoPlayer';
import Flair from './Flair';
import SocialEmbed from './SocialEmbed';
import RedditMarkdown from './RedditMarkdown';
import { Ripple } from './Ripple';
import { decodeHtml } from '../lib/decode';
import { formatTimestamp } from '../lib/time';
import { getGifUrl, getProxiedMediaUrl } from '../lib/media';

let isGlobalScrolling = false;
let globalScrollTimer: NodeJS.Timeout | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    isGlobalScrolling = true;
    if (globalScrollTimer) clearTimeout(globalScrollTimer);
    globalScrollTimer = setTimeout(() => {
      isGlobalScrolling = false;
    }, 150);
  }, { passive: true, capture: true });
}

// Memoized title renderer
const RedditTitle = memo(({ title, metadata }: { title: string; metadata?: any }) => {
  if (!title) return null;
  const decodedTitle = decodeHtml(title);
  if (!metadata) return <>{decodedTitle}</>;

  const parts = decodedTitle.split(/:([a-zA-Z0-9_|[\]-]+):/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const name = part;
          const emojiData = metadata[name] || Object.values(metadata).find((v: any) => v.id === name || v.id?.includes(`|${name}`));
          if (emojiData && emojiData.s && emojiData.s.u) {
            const url = emojiData.s.u.replace(/&amp;/g, '&');
            return (
              <img
                key={i}
                src={url}
                alt={`:${name}:`}
                className="reddit-emoji"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            );
          }
          return <span key={i}>:{name}:</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
});

interface PostCardProps {
  post: RedditPost;
  onClick: (post: RedditPost) => void;
  onVote?: (id: string, dir: number) => Promise<boolean>;
  onSubredditClick?: (subreddit: string) => void;
  onUserClick?: (username: string) => void;
  onMediaClick?: (post: RedditPost, index?: number) => void;
  onFilterSubreddit?: (subreddit: string) => void;
  onFilterUser?: (username: string) => void;
  hideSubredditInfo?: boolean;
  onRedditLinkClick?: (url: string) => void;
}

// Thumbnail is computed once per render with useMemo equivalent via a function called at render
function getThumbnail(post: RedditPost): string | null {
  if (post.thumbnail && post.thumbnail.startsWith('http')) return post.thumbnail.replaceAll('&amp;', '&');

  if (post.is_gallery && post.gallery_data?.items?.[0]?.media_id && post.media_metadata) {
    const firstMediaId = post.gallery_data.items[0].media_id;
    const media = post.media_metadata[firstMediaId];
    if (media?.s?.u) return media.s.u.replace(/&amp;/g, '&');
  }

  if (post.preview?.images?.[0]) {
    const img = post.preview.images[0];
    if (img.resolutions && img.resolutions.length > 0) {
      const res = img.resolutions[Math.min(img.resolutions.length - 1, 2)];
      return res.url.replaceAll('&amp;', '&');
    }
    return img.source.url.replaceAll('&amp;', '&');
  }

  if (post.post_hint === 'image' && post.url && post.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return post.url;
  }

  return null;
}

const PostCard = memo(function PostCard({
  post,
  onClick,
  onVote,
  onSubredditClick,
  onUserClick,
  onMediaClick,
  onFilterSubreddit,
  onFilterUser,
  hideSubredditInfo,
  onRedditLinkClick,
}: PostCardProps) {
  const [voteDir, setVoteDir] = useState(post.likes === true ? 1 : post.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(post.score);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekGalleryIndex, setPeekGalleryIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [hasPeeked, setHasPeeked] = useState(false);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Compute once per render
  const thumbnail = getThumbnail(post);
  const isTextPost = !!(post.selftext && post.selftext.length > 0);

  useEffect(() => {
    if (isPeeking) setPeekGalleryIndex(0);
  }, [isPeeking]);

  const handleVote = useCallback(async (e: React.MouseEvent, dir: number) => {
    e.stopPropagation();
    if (!onVote) return;
    const newDir = voteDir === dir ? 0 : dir;
    const success = await onVote(post.name, newDir);
    if (success) {
      setLocalScore(prev => prev - voteDir + newDir);
      setVoteDir(newDir);
    }
  }, [onVote, post.name, voteDir]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (isGlobalScrolling) return;

    const isGallery = post.is_gallery && post.gallery_data?.items && post.media_metadata;
    const isVideo = post.is_video && post.media?.reddit_video;
    const isImage = post.post_hint === 'image' || post.url?.match(/\.(jpg|jpeg|png|gif)$/i);
    const streamableId = getStreamableId(post.url);
    const isSocial = getTwitterId(post.url) || getBlueskyId(post.url);
    const isGif = getGifUrl(post) !== null;

    if (!isGallery && !isVideo && !isImage && !streamableId && !isSocial && !isGif) return;

    setHasPeeked(false);
    const touch = 'touches' in e ? e.touches[0] : e;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    peekTimerRef.current = setTimeout(() => {
      setIsPeeking(true);
      setHasPeeked(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 400);
  }, [post]);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e;
    const startX = touchStartRef.current?.x || 0;
    const startY = touchStartRef.current?.y || 0;

    if (!isPeeking) {
      if (peekTimerRef.current && (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10)) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
      return;
    }

    if (!post.is_gallery || !post.gallery_data?.items) return;
    const diff = touch.clientX - startX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setPeekGalleryIndex(prev => prev === 0 ? post.gallery_data!.items.length - 1 : prev - 1);
      } else {
        setPeekGalleryIndex(prev => prev === post.gallery_data!.items.length - 1 ? 0 : prev + 1);
      }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [isPeeking, post]);

  const handleTouchEnd = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setIsPeeking(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hasPeeked) {
      e.preventDefault();
      e.stopPropagation();
      setHasPeeked(false);
      return;
    }
    onClick(post);
  }, [hasPeeked, onClick, post]);

  const handleSubredditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSubredditClick?.(post.subreddit);
  }, [onSubredditClick, post.subreddit]);

  const handleUserClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUserClick?.(post.author);
  }, [onUserClick, post.author]);

  const handleMediaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPeeked) { setHasPeeked(false); return; }
    onMediaClick?.(post, 0);
  }, [hasPeeked, onMediaClick, post]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);

  const formattedScore = localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore;
  const formattedTimestamp = formatTimestamp(post.created_utc);

  return (
    <div
      onClick={handleClick}
      className="bg-bg-secondary rounded-2xl p-3 md:p-4 cursor-pointer transition-all duration-300 group relative hover:bg-bg-tertiary overflow-hidden"
    >
      <Ripple />
      {/* Header */}
      <div className="flex items-center gap-2 mb-1 transition-opacity">
        {!hideSubredditInfo && (
          <button
            onClick={handleSubredditClick}
            className="relative w-6 h-6 rounded-full bg-bg-highest flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0 overflow-hidden no-callout transition-transform active:scale-95"
          >
            {post.sr_detail?.community_icon || post.sr_detail?.icon_img ? (
              <img
                src={(post.sr_detail.community_icon || post.sr_detail.icon_img).split('?')[0]}
                alt=""
                className="w-full h-full object-cover no-callout pointer-events-none"
                referrerPolicy="no-referrer"
                onContextMenu={(e) => e.preventDefault()}
                draggable="false"
              />
            ) : (
              post.subreddit.charAt(0).toUpperCase()
            )}
            <Ripple />
          </button>
        )}
        <div className="flex items-center gap-x-1.5 text-xs text-text-secondary opacity-70 group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap">
          {!hideSubredditInfo && (
            <>
              <button
                onClick={handleSubredditClick}
                className="relative font-medium hover:underline px-1 -mx-1 rounded-md overflow-hidden shrink-0"
              >
                r/{post.subreddit}
                <Ripple />
              </button>
              <span className="opacity-50 shrink-0">•</span>
            </>
          )}
          <button
            onClick={handleUserClick}
            className="relative hover:underline opacity-75 flex items-center gap-1.5 px-1 -mx-1 rounded-md overflow-hidden shrink-0"
          >
            <div className="w-4 h-4 rounded-full bg-bg-tertiary flex items-center justify-center overflow-hidden shrink-0">
              <UserAvatar username={post.author} size={10} iconClassName="text-text-secondary" />
            </div>
            <span className="shrink-0">{post.author}</span>
            <Ripple />
          </button>
          <Flair
            text={post.author_flair_text}
            richtext={post.author_flair_richtext}
            className="origin-left shrink min-w-0"
          />
          <span className="opacity-50 shrink-0">•</span>
          <span className="opacity-75 shrink-0">{formattedTimestamp}</span>
        </div>
      </div>

      {/* Title and Thumbnail Row */}
      <div className="flex gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm md:text-base font-medium text-text-primary leading-tight break-anywhere mb-1 tracking-tight">
            <RedditTitle title={post.title} metadata={post.media_metadata} />
          </h2>
          {post.link_flair_text && (
            <div className="mb-2">
              <Flair
                text={post.link_flair_text}
                richtext={post.link_flair_richtext}
                backgroundColor={post.link_flair_background_color}
                textColor={post.link_flair_text_color}
              />
            </div>
          )}
        </div>

        {thumbnail && (
          <div
            className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-2xl overflow-hidden bg-bg-highest relative touch-pan-y select-none no-callout transition-transform"
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onMouseMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => e.preventDefault()}
            onClick={handleMediaClick}
          >
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover no-callout pointer-events-none"
              referrerPolicy="no-referrer"
              onContextMenu={(e) => e.preventDefault()}
              draggable="false"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {post.is_video && (
              <div className="absolute bottom-1 right-1 p-1 bg-black/60 rounded-md text-white">
                <Play size={10} fill="currentColor" />
              </div>
            )}
            {post.is_gallery && (
              <div className="absolute bottom-1 right-1 p-1 bg-black/60 rounded-md text-white text-[10px] font-bold">
                {post.gallery_data?.items?.length || 0}
              </div>
            )}
            {getTwitterId(post.url) && (
              <div className="absolute bottom-1 right-1 p-1 bg-[#1DA1F2] rounded-md text-white">
                <Twitter size={10} fill="currentColor" />
              </div>
            )}
            {getBlueskyId(post.url) && (
              <div className="absolute bottom-1 right-1 p-1 bg-blue-500 rounded-md text-white">
                <MessageCircle size={10} fill="currentColor" />
              </div>
            )}
          </div>
        )}
      </div>

      {isTextPost && !thumbnail && (
        <div className="bg-bg-tertiary rounded-2xl p-3 mb-2">
          <div className="text-[13px] text-text-primary opacity-80 leading-snug line-clamp-5">
            <RedditMarkdown content={post.selftext} metadata={post.media_metadata} onRedditLinkClick={onRedditLinkClick} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          {/* Vote Pill */}
          <div className="flex items-center h-8">
            <motion.button
              initial={false}
              onClick={(e) => handleVote(e, 1)}
              animate={{
                width: 32,
                borderRadius: voteDir === 1 ? "16px 0px 0px 16px" : voteDir === -1 ? "16px 16px 16px 16px" : "16px 0px 0px 16px",
                marginRight: voteDir === -1 ? 6 : 0,
                backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)",
                color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-on-surface-variant)",
              }}
              transition={{ duration: 0.3 }}
              className="relative flex items-center justify-center h-full z-10 overflow-hidden"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
              <Ripple />
            </motion.button>
            <motion.div
              initial={false}
              animate={{
                borderRadius: voteDir === 1 ? "0px 16px 16px 0px" : voteDir === -1 ? "16px 0px 0px 16px" : "0px 0px 0px 0px",
                marginLeft: voteDir === 1 ? -1 : 0,
                marginRight: voteDir === -1 ? -1 : 0,
                paddingLeft: voteDir === 1 ? 4 : voteDir === -1 ? 12 : 6,
                paddingRight: voteDir === 1 ? 12 : voteDir === -1 ? 4 : 6,
                backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : voteDir === -1 ? "var(--md-sys-color-secondary-container)" : "var(--md-sys-color-surface-container-highest)",
                color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface)",
              }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center font-bold text-xs h-full"
            >
              {formattedScore}
            </motion.div>
            <motion.button
              initial={false}
              onClick={(e) => handleVote(e, -1)}
              animate={{
                width: 32,
                borderRadius: voteDir === -1 ? "0px 16px 16px 0px" : voteDir === 1 ? "16px 16px 16px 16px" : "0px 16px 16px 0px",
                marginLeft: voteDir === 1 ? 6 : 0,
                backgroundColor: voteDir === -1 ? "var(--md-sys-color-secondary-container)" : "var(--md-sys-color-surface-container-highest)",
                color: voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface-variant)",
              }}
              transition={{ duration: 0.3 }}
              className="relative flex items-center justify-center h-full z-10 overflow-hidden"
            >
              <ArrowUp size={16} strokeWidth={2.5} className="rotate-180" />
              <Ripple />
            </motion.button>
          </div>

          <div className="relative flex items-center gap-2 bg-bg-highest rounded-full px-3 h-8 text-text-primary hover:bg-hover-bg transition-all active:scale-95 overflow-hidden">
            <MessageSquare size={16} />
            <span className="text-xs font-bold">{post.num_comments}</span>
            <Ripple />
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="relative w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-full transition-all active:scale-90 overflow-hidden"
          >
            <MoreVertical size={18} />
            <Ripple />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 bottom-full mb-2 w-48 bg-bg-tertiary rounded-2xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { navigator.clipboard.writeText(`https://reddit.com${post.permalink}`); setShowMenu(false); }}
                  className="relative w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2 overflow-hidden"
                >
                  <Link size={16} className="text-text-secondary" />
                  Copy Permalink
                  <Ripple />
                </button>
                <button
                  onClick={() => { onFilterSubreddit?.(post.subreddit); setShowMenu(false); }}
                  className="relative w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2 overflow-hidden"
                >
                  <Trash2 size={16} className="text-red-500" />
                  Filter r/{post.subreddit}
                  <Ripple />
                </button>
                <button
                  onClick={() => { onFilterUser?.(post.author); setShowMenu(false); }}
                  className="relative w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2 overflow-hidden"
                >
                  <User size={16} className="text-red-500" />
                  Filter {post.author}
                  <Ripple />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Fullscreen Peek Overlay */}
      <AnimatePresence>
        {isPeeking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "linear" }}
            className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none no-callout"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl no-callout" />
            <div
              className="relative w-full h-full flex items-center justify-center pointer-events-auto no-callout"
              onTouchEnd={handleTouchEnd}
              onMouseUp={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              {(() => {
                const gif = getGifUrl(post);
                if (gif) {
                  if (gif.type === 'hls' || gif.type === 'mp4') {
                    return (
                      <VideoPlayer
                        src={getProxiedMediaUrl(gif.url)}
                        hlsUrl={gif.type === 'hls' ? getProxiedMediaUrl(gif.url) : undefined}
                        className="w-full h-full object-contain"
                        autoPlay
                        muted={true}
                        controls={false}
                      />
                    );
                  } else {
                    return (
                      <img
                        src={getProxiedMediaUrl(gif.url)}
                        alt={post.title}
                        className="w-full h-full object-contain pointer-events-none"
                        referrerPolicy="no-referrer"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                      />
                    );
                  }
                }

                if (getTwitterId(post.url)) {
                  return <div className="w-full max-w-lg p-4 pointer-events-auto"><SocialEmbed url={post.url} type="twitter" /></div>;
                }
                if (getBlueskyId(post.url)) {
                  return <div className="w-full max-w-lg p-4 pointer-events-auto"><SocialEmbed url={post.url} type="bluesky" /></div>;
                }
                if (getStreamableId(post.url)) {
                  return (
                    <div className="w-full h-full bg-black flex flex-col pointer-events-auto relative">
                      <ReactPlayer url={post.url} playing={true} muted={true} controls={true} width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} />
                    </div>
                  );
                }
                if (post.is_gallery && post.gallery_data?.items && post.media_metadata) {
                  const item = post.gallery_data.items[peekGalleryIndex];
                  if (item && item.media_id) {
                    const media = post.media_metadata[item.media_id];
                    if (media?.s?.u) {
                      const url = media.s.u.replace(/&amp;/g, '&');
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center pointer-events-auto relative">
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-contain no-callout pointer-events-none"
                            referrerPolicy="no-referrer"
                            onContextMenu={(e) => e.preventDefault()}
                            draggable="false"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
                            {peekGalleryIndex + 1} / {post.gallery_data.items.length}
                          </div>
                        </div>
                      );
                    }
                  }
                }
                if (post.post_hint === 'image' || post.url?.match(/\.(jpg|jpeg|png)$/i)) {
                  return (
                    <img
                      src={post.url}
                      alt=""
                      className="w-full h-full object-contain no-callout pointer-events-none"
                      referrerPolicy="no-referrer"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable="false"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  );
                }
                return null;
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default PostCard;
