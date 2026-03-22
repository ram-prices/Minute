/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { RedditPost, getStreamableId, getTwitterId, getBlueskyId } from '../services/reddit';
import { MessageSquare, ArrowUp, ArrowDown, MoreVertical, Play, Maximize2, User, Trash2, Twitter, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import VideoPlayer from './VideoPlayer';
import Flair from './Flair';
import SocialEmbed from './SocialEmbed';
import RedditMarkdown from './RedditMarkdown';

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

const RedditTitle = ({ title, metadata }: { title: string; metadata?: any }) => {
  if (!title) return null;
  if (!metadata) return <>{title}</>;

  const parts = title.split(/:([a-zA-Z0-9_|[\]-]+):/g);
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
              />
            );
          }
          return <span key={i}>:{name}:</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

interface PostCardProps {
  post: RedditPost;
  onClick: (post: RedditPost) => void;
  onVote?: (id: string, dir: number) => Promise<boolean>;
  onSubredditClick?: (subreddit: string) => void;
  onUserClick?: (username: string) => void;
  onMediaClick?: (post: RedditPost, index?: number) => void;
  onFilterSubreddit?: (subreddit: string) => void;
  onFilterUser?: (username: string) => void;
}

export default function PostCard({ 
  post, 
  onClick, 
  onVote, 
  onSubredditClick, 
  onUserClick, 
  onMediaClick,
  onFilterSubreddit,
  onFilterUser
}: PostCardProps) {
  const [voteDir, setVoteDir] = useState(post.likes === true ? 1 : post.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(post.score);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekGalleryIndex, setPeekGalleryIndex] = useState(0);
  const touchStartRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (isPeeking) {
      setPeekGalleryIndex(0);
    }
  }, [isPeeking]);
  const [hasPeeked, setHasPeeked] = useState(false);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [peekPos, setPeekPos] = useState({ x: 0, y: 0 });
  const [authorIcon, setAuthorIcon] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch author icon if not already present
    // Reddit API sometimes provides it in sr_detail but for users it's usually separate
    // For now, we'll use a placeholder or check if sr_detail has it (unlikely for author)
    // Actually, we can fetch it if needed, but to avoid too many requests, we'll use a generic icon
    // or fetch it only when the component mounts if it's a priority.
    // Let's try to fetch it for a few posts to see the effect.
  }, [post.author]);

  const handleVote = async (e: React.MouseEvent, dir: number) => {
    e.stopPropagation();
    if (!onVote) return;
    
    const newDir = voteDir === dir ? 0 : dir;
    const success = await onVote(post.name, newDir);
    
    if (success) {
      setLocalScore(prev => prev - voteDir + newDir);
      setVoteDir(newDir);
    }
  };

  const timeAgo = (utc: number) => {
    const seconds = Math.floor((Date.now() / 1000) - utc);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}h`;
  };

  const getThumbnail = () => {
    if (post.thumbnail && post.thumbnail.startsWith('http')) return post.thumbnail.replaceAll('&amp;', '&');
    
    // Check for gallery images
    if (post.is_gallery && post.gallery_data?.items?.[0]?.media_id && post.media_metadata) {
      const firstMediaId = post.gallery_data.items[0].media_id;
      const media = post.media_metadata[firstMediaId];
      if (media?.s?.u) return media.s.u.replace(/&amp;/g, '&');
    }

    // Check for preview images
    if (post.preview?.images?.[0]) {
      const img = post.preview.images[0];
      // Prefer a medium resolution if available
      if (img.resolutions && img.resolutions.length > 0) {
        const res = img.resolutions[Math.min(img.resolutions.length - 1, 2)];
        return res.url.replaceAll('&amp;', '&');
      }
      return img.source.url.replaceAll('&amp;', '&');
    }
    
    // If it's an image post hint, use the URL itself as a last resort
    if (post.post_hint === 'image' && post.url && post.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return post.url;
    }
    
    return null;
  };

  const thumbnail = getThumbnail();
  const hasMedia = !!thumbnail;
  const isTextPost = post.selftext && post.selftext.length > 0;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isGlobalScrolling) return; // Prevent peeking if already scrolling
    setHasPeeked(false);
    const touch = 'touches' in e ? e.touches[0] : e;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    peekTimerRef.current = setTimeout(() => {
      setIsPeeking(true);
      setHasPeeked(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 400); // Slightly faster trigger
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e;
    const startX = touchStartRef.current?.x || 0;
    const startY = touchStartRef.current?.y || 0;

    if (!isPeeking) {
      // If user moves finger significantly before peek triggers, they are scrolling
      if (peekTimerRef.current && (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10)) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
      return;
    }

    if (!post.is_gallery || !post.gallery_data?.items) return;
    
    const diff = touch.clientX - startX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) { // Right swipe - previous
        setPeekGalleryIndex(prev => prev === 0 ? post.gallery_data!.items.length - 1 : prev - 1);
      } else { // Left swipe - next
        setPeekGalleryIndex(prev => prev === post.gallery_data!.items.length - 1 ? 0 : prev + 1);
      }
      // Reset startX to avoid rapid switching
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = () => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setIsPeeking(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasPeeked) {
      e.preventDefault();
      e.stopPropagation();
      setHasPeeked(false);
      return;
    }
    onClick(post);
  };

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

  return (
    <div
      onClick={handleClick}
      className="bg-bg-primary border-b border-border-color md:rounded-lg p-3 md:p-4 cursor-pointer transition-colors group relative hover:bg-bg-secondary/50"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSubredditClick?.(post.subreddit);
          }}
          className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden no-callout"
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
        </button>
        <div className="flex items-center gap-1.5 text-[12px] text-text-primary">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSubredditClick?.(post.subreddit);
            }}
            className="font-bold hover:underline"
          >
            r/{post.subreddit}
          </button>
          <span className="text-text-secondary flex items-center gap-1.5">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUserClick?.(post.author);
              }}
              className="hover:underline flex items-center gap-1.5 max-w-[120px]"
            >
              <div className="w-4 h-4 rounded-full bg-bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                <User size={10} className="text-text-secondary" />
              </div>
              <span className="truncate">u/{post.author}</span>
            </button>
            <Flair 
              text={post.author_flair_text} 
              richtext={post.author_flair_richtext}
              className={post.author.length >= 15 ? 'hidden' : ''}
            />
            {' '}• {timeAgo(post.created_utc)}
          </span>
        </div>
      </div>

      {/* Title and Thumbnail Row */}
      <div className="flex gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-medium text-text-primary leading-snug break-anywhere mb-1">
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

        {/* Thumbnail for Media Posts */}
        {thumbnail && (
          <div 
            className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-lg overflow-hidden bg-bg-secondary relative touch-pan-y select-none no-callout"
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onMouseMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPeeked) {
                setHasPeeked(false);
                return;
              }
              onMediaClick?.(post, 0);
            }}
          >
            <img 
              src={thumbnail} 
              alt="" 
              className="w-full h-full object-cover no-callout pointer-events-none"
              referrerPolicy="no-referrer"
              onContextMenu={(e) => e.preventDefault()}
              draggable="false"
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

      {/* Text Preview for Text Posts */}
      {isTextPost && !thumbnail && (
        <div className="bg-bg-secondary rounded-lg p-3 mb-3">
          <div className="text-[13px] text-text-primary opacity-80 leading-relaxed line-clamp-5">
            <RedditMarkdown content={post.selftext} />
          </div>
        </div>
      )}

      {/* Footer - Now below content */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Vote Pill */}
          <div className="flex items-center bg-bg-secondary rounded-md p-0.5 h-[36px]">
            <button 
              onClick={(e) => handleVote(e, 1)}
              className={`p-1.5 rounded-md transition-colors h-full flex items-center ${voteDir === 1 ? 'text-[#FF4500] bg-[#FF4500]/10' : 'text-text-secondary hover:bg-hover-bg'}`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
            <span className={`text-[13px] font-bold px-1 min-w-[24px] text-center ${voteDir === 1 ? 'text-[#FF4500]' : voteDir === -1 ? 'text-[#7193FF]' : 'text-text-primary'}`}>
              {localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore}
            </span>
            <button 
              onClick={(e) => handleVote(e, -1)}
              className={`p-1.5 rounded-md transition-colors rotate-180 h-full flex items-center ${voteDir === -1 ? 'text-[#7193FF] bg-[#7193FF]/10' : 'text-text-secondary hover:bg-hover-bg'}`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Comment Pill */}
          <div className="flex items-center gap-2 bg-bg-secondary rounded-md px-3 h-[36px] text-text-primary hover:bg-hover-bg transition-colors">
            <MessageSquare size={16} />
            <span className="text-[13px] font-bold">{post.num_comments}</span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-md transition-colors"
          >
            <MoreVertical size={18} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 bottom-full mb-2 w-48 bg-bg-secondary border border-border-color rounded-xl shadow-2xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => {
                    onFilterSubreddit?.(post.subreddit);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2"
                >
                  <Trash2 size={16} className="text-red-500" />
                  Filter r/{post.subreddit}
                </button>
                <button 
                  onClick={() => {
                    onFilterUser?.(post.author);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2"
                >
                  <User size={16} className="text-red-500" />
                  Filter u/{post.author}
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
            className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <div className="relative w-full h-full flex items-center justify-center">
              {post.is_video && post.media?.reddit_video ? (
                <VideoPlayer 
                  src={post.media.reddit_video.fallback_url} 
                  hlsUrl={post.media.reddit_video.hls_url}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted={true}
                  controls={false}
                />
              ) : getTwitterId(post.url) ? (
                <div className="w-full max-w-lg p-4 pointer-events-auto">
                  <SocialEmbed url={post.url} type="twitter" />
                </div>
              ) : getBlueskyId(post.url) ? (
                <div className="w-full max-w-lg p-4 pointer-events-auto">
                  <SocialEmbed url={post.url} type="bluesky" />
                </div>
              ) : getStreamableId(post.url) ? (
                <div className="w-full h-full bg-black flex flex-col pointer-events-auto relative">
                  <ReactPlayer
                    url={post.url}
                    playing={true}
                    muted={true}
                    controls={true}
                    width="100%"
                    height="100%"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                </div>
              ) : post.is_gallery && post.gallery_data?.items && post.media_metadata ? (
                <div 
                  className="w-full h-full flex items-center justify-center relative touch-none"
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    (e.currentTarget as any).startX = touch.clientX;
                    (e.currentTarget as any).startTime = Date.now();
                  }}
                  onTouchEnd={(e) => {
                    const touch = e.changedTouches[0];
                    const startX = (e.currentTarget as any).startX;
                    const startTime = (e.currentTarget as any).startTime;
                    const diff = touch.clientX - startX;
                    const timeDiff = Date.now() - startTime;
                    
                    if (Math.abs(diff) > 50 && timeDiff < 300) {
                      if (diff > 0) { // Right swipe - previous
                        setPeekGalleryIndex(prev => Math.max(0, prev - 1));
                      } else { // Left swipe - next
                        setPeekGalleryIndex(prev => Math.min(post.gallery_data!.items.length - 1, prev + 1));
                      }
                    }
                  }}
                >
                  <img 
                    src={post.media_metadata[post.gallery_data.items[peekGalleryIndex].media_id].s.u.replace(/&amp;/g, '&')} 
                    alt="" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1.5 rounded-full text-white text-xs font-medium">
                    {peekGalleryIndex + 1} / {post.gallery_data.items.length}
                  </div>
                </div>
              ) : post.post_hint === 'image' || post.url?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img 
                  src={post.url} 
                  alt="" 
                  className="w-full h-full object-contain no-callout pointer-events-none"
                  referrerPolicy="no-referrer"
                  onContextMenu={(e) => e.preventDefault()}
                  draggable="false"
                />
              ) : !post.is_gallery ? (
                <div className="w-full h-full flex flex-col pointer-events-auto no-callout">
                  <div className="flex-1 relative bg-bg-primary flex items-center justify-center overflow-hidden no-callout">
                    {thumbnail ? (
                      <img 
                        src={thumbnail}
                        alt="Preview"
                        className="w-full h-full object-contain no-callout pointer-events-none"
                        referrerPolicy="no-referrer"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-4 text-text-secondary">
                        <div className="w-16 h-16 rounded-full bg-hover-bg flex items-center justify-center">
                          <Maximize2 size={32} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">No Preview Available</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 bg-bg-primary border-t border-border-color flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#FF4500] uppercase font-black tracking-tighter">Link Preview</span>
                      <span className="text-[10px] text-text-secondary">•</span>
                      <span className="text-[10px] text-text-secondary font-mono truncate">
                        {(() => {
                          try {
                            return new URL(post.url).hostname;
                          } catch {
                            return 'External Link';
                          }
                        })()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-text-primary line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-text-secondary truncate">{post.url}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
