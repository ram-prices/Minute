/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { RedditPost, getStreamableId } from '../services/reddit';
import { MessageSquare, ArrowUp, ArrowDown, MoreVertical, Play, Maximize2, User, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VideoPlayer from './VideoPlayer';

interface PostCardProps {
  post: RedditPost;
  onClick: (post: RedditPost) => void;
  onVote?: (id: string, dir: number) => Promise<boolean>;
  onSubredditClick?: (subreddit: string) => void;
  onUserClick?: (username: string) => void;
  onMediaClick?: (post: RedditPost) => void;
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
    setHasPeeked(false);
    peekTimerRef.current = setTimeout(() => {
      setIsPeeking(true);
      setHasPeeked(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 400); // Slightly faster trigger
  };

  const handleTouchEnd = () => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
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
      className="bg-[#030303] border-b border-white/5 md:rounded-lg p-3 md:p-4 cursor-pointer transition-colors group relative hover:bg-[#1A1A1B]/50"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSubredditClick?.(post.subreddit);
          }}
          className="w-6 h-6 rounded-full bg-[#1A1A1B] flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden no-callout"
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
        <div className="flex items-center gap-1.5 text-[12px] text-[#D7DADC]">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSubredditClick?.(post.subreddit);
            }}
            className="font-bold hover:underline"
          >
            r/{post.subreddit}
          </button>
          <span className="text-[#818384] flex items-center gap-1.5">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUserClick?.(post.author);
              }}
              className="hover:underline flex items-center gap-1.5 max-w-[120px]"
            >
              <div className="w-4 h-4 rounded-full bg-[#1A1A1B] flex items-center justify-center overflow-hidden shrink-0">
                <User size={10} className="text-[#818384]" />
              </div>
              <span className="truncate">u/{post.author}</span>
            </button>
            {post.author_flair_text && post.author.length < 15 && (
              <span className="px-1.5 py-0.5 bg-[#1A1A1B] text-[#D7DADC] text-[10px] rounded font-medium border border-white/10 shadow-sm">
                {post.author_flair_text}
              </span>
            )}
            {' '}• {timeAgo(post.created_utc)}
          </span>
        </div>
      </div>

      {/* Title and Thumbnail Row */}
      <div className="flex gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-medium text-[#D7DADC] leading-snug break-anywhere mb-1">
            {post.title}
          </h2>
          {post.link_flair_text && (
            <div className="mb-2">
              <span 
                className="px-2 py-0.5 text-[10px] font-bold rounded border border-white/10 shadow-sm"
                style={{ 
                  backgroundColor: post.link_flair_background_color || '#1A1A1B',
                  color: post.link_flair_text_color === 'dark' ? '#000' : '#fff'
                }}
              >
                {post.link_flair_text}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail for Media Posts */}
        {thumbnail && (
          <div 
            className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-lg overflow-hidden bg-[#1A1A1B] relative touch-pan-y select-none no-callout"
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPeeked) {
                setHasPeeked(false);
                return;
              }
              onMediaClick?.(post);
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
          </div>
        )}
      </div>

      {/* Text Preview for Text Posts */}
      {isTextPost && !thumbnail && (
        <div className="bg-[#1A1A1B] rounded-lg p-3 mb-3">
          <p className="text-[13px] text-[#D7DADC] line-clamp-3 opacity-80 leading-relaxed">
            {post.selftext}
          </p>
        </div>
      )}

      {/* Footer - Now below content */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Vote Pill */}
          <div className="flex items-center bg-[#1A1A1B] rounded-md p-0.5 h-[36px]">
            <button 
              onClick={(e) => handleVote(e, 1)}
              className={`p-1.5 rounded-md transition-colors h-full flex items-center ${voteDir === 1 ? 'text-[#FF4500] bg-[#FF4500]/10' : 'text-[#818384] hover:bg-white/5'}`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
            <span className={`text-[13px] font-bold px-1 min-w-[24px] text-center ${voteDir === 1 ? 'text-[#FF4500]' : voteDir === -1 ? 'text-[#7193FF]' : 'text-[#D7DADC]'}`}>
              {localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore}
            </span>
            <button 
              onClick={(e) => handleVote(e, -1)}
              className={`p-1.5 rounded-md transition-colors rotate-180 h-full flex items-center ${voteDir === -1 ? 'text-[#7193FF] bg-[#7193FF]/10' : 'text-[#818384] hover:bg-white/5'}`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Comment Pill */}
          <div className="flex items-center gap-2 bg-[#1A1A1B] rounded-md px-3 h-[36px] text-[#D7DADC] hover:bg-white/5 transition-colors">
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
            className="p-2 text-[#818384] hover:text-[#D7DADC] hover:bg-white/5 rounded-md transition-colors"
          >
            <MoreVertical size={18} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 bottom-full mb-2 w-48 bg-[#1A1A1B] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => {
                    onFilterSubreddit?.(post.subreddit);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#D7DADC] hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 size={16} className="text-red-500" />
                  Filter r/{post.subreddit}
                </button>
                <button 
                  onClick={() => {
                    onFilterUser?.(post.author);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#D7DADC] hover:bg-white/5 flex items-center gap-2"
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
                  muted={false}
                  controls={false}
                />
              ) : getStreamableId(post.url) ? (
                <div className="w-full h-full bg-black flex flex-col pointer-events-auto">
                  <iframe 
                    src={`https://streamable.com/e/${getStreamableId(post.url)}?autoplay=1`} 
                    className="w-full h-full border-none"
                    title="Streamable Preview"
                    allow="autoplay; fullscreen"
                  />
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
              ) : (
                <div className="w-full h-full flex flex-col pointer-events-auto no-callout">
                  <div className="flex-1 relative bg-[#030303] flex items-center justify-center overflow-hidden no-callout">
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
                      <div className="flex flex-col items-center gap-4 text-[#818384]">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                          <Maximize2 size={32} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">No Preview Available</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 bg-[#030303] border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#FF4500] uppercase font-black tracking-tighter">Link Preview</span>
                      <span className="text-[10px] text-[#818384]">•</span>
                      <span className="text-[10px] text-[#818384] font-mono truncate">
                        {(() => {
                          try {
                            return new URL(post.url).hostname;
                          } catch {
                            return 'External Link';
                          }
                        })()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#D7DADC] line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-[#818384] truncate">{post.url}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
