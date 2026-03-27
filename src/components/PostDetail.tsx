/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { RedditPost, RedditComment, fetchPostDetails, getStreamableId, getTwitterId, getBlueskyId } from '../services/reddit';
import { X, ArrowLeft, MessageSquare, ArrowUp, Clock, User, MoreVertical, Trash2, Twitter, MessageCircle, Globe, Link, Camera } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import { toBlob } from 'html-to-image';

import VideoPlayer from './VideoPlayer';
import Flair from './Flair';
import SocialEmbed from './SocialEmbed';
import { Ripple } from './Ripple';
import { decodeHtml } from '../lib/decode';
import { formatTimestamp } from '../lib/time';
import { getGifUrl, getProxiedMediaUrl } from '../lib/media';

const RedditTitle = ({ title, metadata }: { title: string; metadata?: any }) => {
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
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
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

import RedditMarkdown from './RedditMarkdown';

interface PostDetailProps {
  post: RedditPost;
  onClose: () => void;
  onVote?: (id: string, dir: number) => Promise<boolean>;
  onComment?: (parentId: string, text: string) => Promise<RedditComment | null>;
  onSubredditClick?: (subreddit: string) => void;
  onUserClick?: (username: string) => void;
  onFilterSubreddit?: (subreddit: string) => void;
  onFilterUser?: (username: string) => void;
  onMediaClick?: (post: RedditPost, index?: number) => void;
}

export default function PostDetail({ 
  post, 
  onClose, 
  onVote, 
  onComment, 
  onSubredditClick, 
  onUserClick,
  onFilterSubreddit,
  onFilterUser,
  onMediaClick
}: PostDetailProps) {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteDir, setVoteDir] = useState(post.likes === true ? 1 : post.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(post.score);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const scrollPositions = React.useRef<Record<string, number>>({});
  const currentScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [commentStack, setCommentStack] = useState<RedditComment[]>([]);

  const handleScrollRef = React.useCallback((node: HTMLDivElement | null) => {
    currentScrollRef.current = node;
    if (node) {
      const key = commentStack.length === 0 ? 'main-post' : `stack-${commentStack.length}`;
      const savedPos = scrollPositions.current[key];
      if (savedPos !== undefined) {
        requestAnimationFrame(() => {
          node.scrollTop = savedPos;
        });
      }

      // Add scroll listener for header visibility
      let scrollDirection = 0;
      let scrollStart = node.scrollTop;
      
      const handleScroll = () => {
        const currentScrollY = node.scrollTop;
        
        if (currentScrollY <= 100) {
          setShowHeader(true);
          lastScrollY.current = currentScrollY;
          return;
        }

        const diff = currentScrollY - lastScrollY.current;
        if (diff === 0) return;

        const currentDirection = diff > 0 ? 1 : -1;

        if (currentDirection !== scrollDirection) {
          scrollDirection = currentDirection;
          scrollStart = currentScrollY;
        }

        if (scrollDirection === 1 && currentScrollY - scrollStart > 20) {
          setShowHeader(false);
        } else if (scrollDirection === -1 && scrollStart - currentScrollY > 20) {
          setShowHeader(true);
        }
        
        lastScrollY.current = currentScrollY;
      };

      node.addEventListener('scroll', handleScroll, { passive: true });
      return () => node.removeEventListener('scroll', handleScroll);
    }
  }, [commentStack.length]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      const newLength = state?.commentStackLength || 0;
      if (newLength < commentStack.length) {
        if (currentScrollRef.current) {
          const key = `stack-${commentStack.length}`;
          scrollPositions.current[key] = currentScrollRef.current.scrollTop;
        }
        setCommentStack(prev => prev.slice(0, newLength));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [commentStack.length]);

  const handleIsolate = (c: RedditComment) => {
    if (currentScrollRef.current) {
      const key = commentStack.length === 0 ? 'main-post' : `stack-${commentStack.length}`;
      scrollPositions.current[key] = currentScrollRef.current.scrollTop;
    }
    const newStack = [...commentStack, c];
    setCommentStack(newStack);
    window.history.pushState({ ...window.history.state, commentStackLength: newStack.length }, '');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadComments() {
      try {
        const { comments } = await fetchPostDetails(post.permalink);
        setComments(comments);
      } catch (error) {
        console.error('Failed to load comments', error);
      } finally {
        setLoading(false);
      }
    }
    loadComments();
  }, [post.permalink]);

  const handleVote = async (dir: number) => {
    if (!onVote) return;
    const newDir = voteDir === dir ? 0 : dir;
    const success = await onVote(post.name, newDir);
    if (success) {
      setLocalScore(prev => prev - voteDir + newDir);
      setVoteDir(newDir);
    }
  };

  const postHasMedia = 
    post.is_video || 
    post.is_gallery || 
    !!(post.url && post.url.match(/\.(jpg|jpeg|png|gif|mp4|webm)$/)) || 
    !!(post.thumbnail && post.thumbnail.startsWith('http')) || 
    !!post.media || 
    !!post.preview || 
    (!!post.media_metadata && Object.values(post.media_metadata).some((m: any) => m.e !== 'emoji')) ||
    !!(post.selftext_html && post.selftext_html.includes('<iframe')) ||
    !!(post.selftext && post.selftext.includes('preview.redd.it'));

  const handleMainReply = async () => {
    if (!onComment || !replyText.trim()) return;
    setIsSubmitting(true);
    const newComment = await onComment(post.name, replyText);
    if (newComment) {
      setComments(prev => [newComment, ...prev]);
      setReplyText('');
    }
    setIsSubmitting(false);
  };

  const handleScreenshot = async (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      // Small delay to ensure menu is closed and animations finish
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const blob = await toBlob(element, { 
        backgroundColor: null,
        pixelRatio: 2,
        filter: (node) => {
          // @ts-ignore
          if (node.classList && node.classList.contains('screenshot-exclude')) {
            return false;
          }
          // Ignore cross-origin media entirely to prevent timeouts
          // @ts-ignore
          if (node.tagName === 'IMG' || node.tagName === 'IFRAME' || node.tagName === 'VIDEO') {
            return false;
          }
          return true;
        }
      });
      
      if (!blob) return;
        
      // 1. Try Web Share API (Mobile native sharing)
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Screenshot',
          });
          return;
        } catch (shareErr) {
          console.error('Share failed', shareErr);
        }
      }

      // 2. Try Clipboard API (Desktop/Supported browsers)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return;
      } catch (clipErr) {
        console.error('Clipboard failed, cancelling operation', clipErr);
      }
    } catch (err) {
      console.error('Failed to capture screenshot', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary relative">
      <motion.header 
        initial={false}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        className="absolute top-0 left-0 right-0 bg-bg-secondary/90 backdrop-blur-md p-4 md:px-6 flex items-center justify-between z-20"
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (commentStack.length > 0) {
                window.history.back();
              } else {
                onClose();
              }
            }}
            className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
          >
            <ArrowLeft size={24} />
            <Ripple />
          </button>
          {commentStack.length > 0 ? (
            <div className="flex flex-col items-start pr-2">
              <span className="text-[14px] font-medium text-text-primary">Thread</span>
            </div>
          ) : (
            <button 
              onClick={() => onSubredditClick?.(post.subreddit)}
              className="relative flex items-center gap-3 hover:bg-hover-bg p-1 -m-1 rounded-full transition-all overflow-hidden"
            >
              <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-primary shrink-0 overflow-hidden">
                {post.sr_detail?.community_icon || post.sr_detail?.icon_img ? (
                  <img 
                    src={(post.sr_detail.community_icon || post.sr_detail.icon_img).split('?')[0]} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  post.subreddit.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex flex-col items-start pr-2">
                <span className="text-[14px] font-medium text-text-primary">r/{post.subreddit}</span>
              </div>
              <Ripple />
            </button>
          )}
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto flex flex-col pb-20 md:pb-0 relative">
        <AnimatePresence mode="wait" initial={false}>
          {commentStack.length > 0 ? (
            <motion.div 
              ref={handleScrollRef}
              key={`stack-${commentStack.length}`}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -20 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 30,
                mass: 1
              }}
              className="flex flex-col gap-6 pb-12 px-4 md:px-8 pt-[96px] absolute inset-0 overflow-y-auto"
            >
              <CommentItem
                comment={commentStack[commentStack.length - 1]}
                depth={6}
                isIsolatedRoot={true}
                onVote={onVote}
                onComment={onComment}
                onUserClick={onUserClick}
                onIsolate={handleIsolate}
                isFirst={true}
                isLast={true}
                useMasterColor={true}
              />
            </motion.div>
          ) : (
            <motion.div 
              ref={handleScrollRef}
              key="main-post"
              initial={{ opacity: 0, scale: 1.05, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 30,
                mass: 1
              }}
              className="absolute inset-0 overflow-y-auto flex flex-col"
            >
              <div id={`post-${post.id}`} className="bg-bg-secondary rounded-b-3xl p-4 md:p-8 pt-[88px] md:pt-[104px] flex flex-col gap-4 shrink-0">
            
            {/* Header (like feed) */}
          <div className="flex items-center gap-2 mb-1.5 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUserClick?.(post.author);
              }}
              className="relative w-6 h-6 rounded-full bg-bg-highest flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0 overflow-hidden no-callout transition-transform active:scale-95"
            >
              <UserAvatar username={post.author} size={14} iconClassName="text-text-secondary" />
              <Ripple />
            </button>
            <div className="flex items-center gap-x-1.5 text-xs text-text-secondary opacity-70 hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onUserClick?.(post.author);
                }}
                className="relative font-bold text-text-primary hover:underline px-1 -mx-1 rounded-md overflow-hidden shrink-0"
              >
                <span className="block">u/{post.author}</span>
                <Ripple />
              </button>
              <Flair 
                text={post.author_flair_text} 
                richtext={post.author_flair_richtext}
                className="origin-left shrink min-w-0"
              />
              <span className="opacity-50 shrink-0">•</span>
              <span className="opacity-75 shrink-0">{formatTimestamp(post.created_utc)}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <h1 className="text-base md:text-lg font-medium text-text-primary leading-tight break-anywhere tracking-tight">
              <RedditTitle title={post.title} metadata={post.media_metadata} />
            </h1>
            {post.link_flair_text && (
              <div className="mt-1">
                <Flair 
                  text={post.link_flair_text} 
                  richtext={post.link_flair_richtext}
                  backgroundColor={post.link_flair_background_color}
                  textColor={post.link_flair_text_color}
                />
              </div>
            )}
          </div>

          {/* Media Section - Below title, rounded corners */}
          <div className="w-full rounded-2xl overflow-hidden bg-bg-highest">
            {post.is_video && post.media?.reddit_video && (
              <div className="w-full flex justify-center bg-black">
                <VideoPlayer 
                  src={post.media.reddit_video.fallback_url} 
                  hlsUrl={post.media.reddit_video.hls_url}
                  autoPlay={false}
                  muted={false}
                  className="w-full max-h-[80vh]"
                />
              </div>
            )}

            {getTwitterId(post.url) && (
              <div className="w-full p-4 md:p-8 bg-black">
                <SocialEmbed url={post.url} type="twitter" />
              </div>
            )}

            {getBlueskyId(post.url) && (
              <div className="w-full p-4 md:p-8 bg-black">
                <SocialEmbed url={post.url} type="bluesky" />
              </div>
            )}

            {getStreamableId(post.url) && (
              <div className="w-full aspect-video relative bg-black">
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
            )}

            {post.is_gallery && post.gallery_data?.items && post.media_metadata && (
              <div className="w-full overflow-x-auto flex snap-x snap-mandatory bg-black">
                {post.gallery_data.items.map((item, index) => {
                  const media = post.media_metadata?.[item.media_id];
                  if (!media?.s?.u) return null;
                  const imageUrl = media.s.u.replace(/&amp;/g, '&');
                  return (
                    <img 
                      key={item.media_id}
                      src={imageUrl} 
                      alt={post.title} 
                      className="w-full h-auto max-h-[70vh] object-contain shrink-0 snap-center cursor-pointer"
                      referrerPolicy="no-referrer"
                      onClick={() => onMediaClick?.(post, index)}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  );
                })}
              </div>
            )}

            {(() => {
              const gif = getGifUrl(post);
              if (gif && !post.is_video) { // if is_video is true, it's handled above
                return (
                  <div className="w-full no-callout bg-black">
                    {gif.type === 'mp4' ? (
                      <video 
                        src={getProxiedMediaUrl(gif.url)} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline 
                        className="w-full h-auto max-h-[80vh] object-contain no-callout pointer-events-none"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    ) : (
                      <img 
                        src={getProxiedMediaUrl(gif.url)} 
                        alt={post.title} 
                        className="w-full h-auto no-callout pointer-events-none"
                        referrerPolicy="no-referrer"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                );
              }
              
              if (!post.is_video && !post.is_gallery && post.url && (post.post_hint === 'image' || post.url.match(/\.(jpg|jpeg|png)$/i))) {
                return (
                  <div className="w-full no-callout bg-black">
                    <img 
                      src={post.url} 
                      alt={post.title} 
                      className="w-full h-auto no-callout pointer-events-none"
                      referrerPolicy="no-referrer"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable="false"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              }
              return null;
            })()}

            {/* Link Post Button */}
            {((post.post_hint === 'link') || (post.url && !post.url.includes('reddit.com/r/') && post.domain && !post.domain.startsWith('self.'))) && 
             !post.is_video && !post.is_gallery && !post.url.match(/\.(jpg|jpeg|png|gif|mp4|webm)$/) && !getStreamableId(post.url) && !getGifUrl(post) && (
              <div className="p-4 bg-bg-secondary">
                <a 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-bg-tertiary rounded-2xl hover:bg-hover-bg transition-all group border border-white/5"
                >
                  {post.thumbnail && post.thumbnail.startsWith('http') && (
                    <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-bg-secondary">
                      <img 
                        src={post.thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{post.domain}</p>
                    <p className="text-xs text-text-secondary truncate">{post.url}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
                    <Globe size={20} />
                  </div>
                </a>
              </div>
            )}
          </div>

          {post.selftext && (
            <div className="text-sm text-text-primary leading-relaxed bg-bg-tertiary p-4 md:p-6 rounded-2xl prose dark:prose-invert prose-sm max-w-none break-anywhere mt-2">
              <RedditMarkdown content={post.selftext} metadata={post.media_metadata} />
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center h-8">
              <motion.button 
                initial={false}
                onClick={() => handleVote(1)}
                animate={{
                  width: 32,
                  borderRadius: voteDir === 1 ? "16px 0px 0px 16px" : 
                               voteDir === -1 ? "16px 16px 16px 16px" : "16px 0px 0px 16px",
                  marginRight: voteDir === -1 ? 6 : 0,
                  backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)",
                  color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-on-surface-variant)"
                }}
                whileHover={voteDir === 0 ? { backgroundColor: "var(--md-sys-color-surface-container-high)" } : {}}
                transition={{ 
                  duration: 0.3
                }}
                className="relative flex items-center justify-center h-full z-10 overflow-hidden"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
                <Ripple />
              </motion.button>
              <motion.div 
                initial={false}
                animate={{
                  borderRadius: voteDir === 1 ? "0px 16px 16px 0px" : 
                               voteDir === -1 ? "16px 0px 0px 16px" : "0px 0px 0px 0px",
                  marginLeft: voteDir === 1 ? -1 : 0,
                  marginRight: voteDir === -1 ? -1 : 0,
                  paddingLeft: voteDir === 1 ? 4 : voteDir === -1 ? 12 : 6,
                  paddingRight: voteDir === 1 ? 12 : voteDir === -1 ? 4 : 6,
                  backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : 
                                   voteDir === -1 ? "var(--md-sys-color-secondary-container)" : 
                                   "var(--md-sys-color-surface-container-highest)",
                  color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : 
                         voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : 
                         "var(--md-sys-color-on-surface)"
                }}
                transition={{ 
                  duration: 0.3
                }}
                className="flex items-center justify-center font-bold text-xs h-full"
              >
                {localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore}
              </motion.div>
              <motion.button 
                initial={false}
                onClick={() => handleVote(-1)}
                animate={{
                  width: 32,
                  borderRadius: voteDir === -1 ? "0px 16px 16px 0px" : 
                               voteDir === 1 ? "16px 16px 16px 16px" : "0px 16px 16px 0px",
                  marginLeft: voteDir === 1 ? 6 : 0,
                  backgroundColor: voteDir === -1 ? "var(--md-sys-color-secondary-container)" : "var(--md-sys-color-surface-container-highest)",
                  color: voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface-variant)"
                }}
                whileHover={voteDir === 0 ? { backgroundColor: "var(--md-sys-color-surface-container-high)" } : {}}
                transition={{ 
                  duration: 0.3
                }}
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
            <div className="relative ml-auto screenshot-exclude">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
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
                    className="absolute right-0 bottom-full mb-2 w-56 bg-bg-tertiary rounded-2xl z-50 overflow-hidden shadow-xl border border-white/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => {
                        const permalink = `https://reddit.com${post.permalink}`;
                        navigator.clipboard.writeText(permalink);
                        setShowMenu(false);
                      }}
                      className="relative w-full px-5 py-3.5 text-left text-sm font-medium text-text-primary hover:bg-hover-bg flex items-center gap-3 transition-colors overflow-hidden"
                    >
                      <Link size={18} className="text-text-secondary" />
                      Copy Permalink
                      <Ripple />
                    </button>
                    <button 
                      disabled={postHasMedia}
                      onClick={() => {
                        handleScreenshot(`post-${post.id}`);
                        setShowMenu(false);
                      }}
                      className={`relative w-full px-5 py-3.5 text-left text-sm font-medium flex items-center gap-3 transition-colors overflow-hidden ${postHasMedia ? 'text-text-secondary opacity-50 cursor-not-allowed' : 'text-text-primary hover:bg-hover-bg'}`}
                    >
                      <Camera size={18} className="text-text-secondary" />
                      Copy Screenshot
                      {!postHasMedia && <Ripple />}
                    </button>
                    <button 
                      onClick={() => {
                        onFilterSubreddit?.(post.subreddit);
                        onClose();
                      }}
                      className="relative w-full px-5 py-3.5 text-left text-sm font-medium text-text-primary hover:bg-hover-bg flex items-center gap-3 transition-colors overflow-hidden"
                    >
                      <Trash2 size={18} className="text-red-500" />
                      Filter r/{post.subreddit}
                      <Ripple />
                    </button>
                    <button 
                      onClick={() => {
                        onFilterUser?.(post.author);
                        onClose();
                      }}
                      className="relative w-full px-5 py-3.5 text-left text-sm font-medium text-text-primary hover:bg-hover-bg flex items-center gap-3 transition-colors overflow-hidden"
                    >
                      <User size={18} className="text-red-500" />
                      Filter u/{post.author}
                      <Ripple />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 mt-6">
          {loading ? (
            <div className="flex flex-col gap-4 px-4 md:px-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-bg-tertiary animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-12 px-4 md:px-8">
              {comments.map((comment, index) => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  onVote={onVote}
                  onComment={onComment}
                  onUserClick={onUserClick}
                  onIsolate={handleIsolate}
                  isFirst={true}
                  isLast={true}
                  useMasterColor={index % 2 === 0}
                />
              ))}
            </div>
          )}
        </div>
        </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button for Commenting */}
      <button 
        onClick={() => setShowReplyModal(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-primary text-on-primary rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[80] overflow-hidden"
      >
        <MessageSquare size={28} fill="currentColor" />
        <Ripple />
      </button>

      {/* Comment Modal */}
      {showReplyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReplyModal(false)}
          />
          <div className="relative w-full max-w-lg bg-bg-tertiary rounded-3xl overflow-hidden flex flex-col">
            <header className="p-5 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-text-primary">Post Comment</h3>
              <button 
                onClick={() => setShowReplyModal(false)}
                className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
              >
                <X size={24} />
                <Ripple />
              </button>
            </header>
            <div className="p-5 flex flex-col gap-4">
              <textarea 
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="What are your thoughts?"
                className="w-full p-4 bg-bg-primary text-text-primary rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary transition-all min-h-[150px]"
              />
              <div className="flex justify-end gap-3 mt-2">
                <button 
                  onClick={() => setShowReplyModal(false)}
                  className="relative px-5 py-2.5 text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all overflow-hidden"
                >
                  Cancel
                  <Ripple />
                </button>
                <button 
                  onClick={async () => {
                    await handleMainReply();
                    setShowReplyModal(false);
                  }}
                  disabled={isSubmitting || !replyText.trim()}
                  className="relative px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 overflow-hidden"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                  <Ripple />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ 
  comment, 
  depth = 0, 
  onVote, 
  onComment,
  onUserClick,
  isFirst = false,
  isLast = false,
  useMasterColor = false,
  onIsolate,
  isIsolatedRoot = false
}: { 
  comment: RedditComment, 
  depth?: number, 
  onVote?: any, 
  onComment?: any,
  onUserClick?: (username: string) => void,
  isFirst?: boolean,
  isLast?: boolean,
  useMasterColor?: boolean,
  onIsolate?: (comment: RedditComment) => void,
  isIsolatedRoot?: boolean
}) {
  const [voteDir, setVoteDir] = useState(comment.likes === true ? 1 : comment.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(comment.score);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localReplies, setLocalReplies] = useState<RedditComment[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const lastTapRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowReply(!showReply);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!comment.author || !comment.body) return null;

  const allReplies = [
    ...localReplies,
    ...(comment.replies?.data?.children?.filter((r: any) => r.kind !== 'more').map((r: any) => r.data) || [])
  ];
  const hasReplies = allReplies.length > 0;
  const rendersReplies = hasReplies && (depth < 6 || isIsolatedRoot);

  const handleVote = async (dir: number) => {
    if (!onVote) return;
    const newDir = voteDir === dir ? 0 : dir;
    const success = await onVote(comment.name, newDir);
    if (success) {
      setLocalScore(prev => prev - voteDir + newDir);
      setVoteDir(newDir);
    }
  };

  const commentHasMedia = 
    (!!comment.media_metadata && Object.values(comment.media_metadata).some((m: any) => m.e !== 'emoji')) ||
    !!(comment.body_html && comment.body_html.includes('<iframe')) ||
    !!(comment.body && comment.body.includes('preview.redd.it'));

  const handleReply = async () => {
    if (!onComment || !replyText.trim()) return;
    setIsSubmitting(true);
    const newComment = await onComment(comment.name, replyText);
    if (newComment) {
      setLocalReplies(prev => [newComment, ...prev]);
      setReplyText('');
      setShowReply(false);
    }
    setIsSubmitting(false);
  };

  const handleScreenshot = async (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      // Small delay to ensure menu is closed and animations finish
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const blob = await toBlob(element, { 
        backgroundColor: null,
        pixelRatio: 2,
        filter: (node) => {
          // @ts-ignore
          if (node.classList && node.classList.contains('screenshot-exclude')) {
            return false;
          }
          // Ignore cross-origin media entirely to prevent timeouts
          // @ts-ignore
          if (node.tagName === 'IMG' || node.tagName === 'IFRAME' || node.tagName === 'VIDEO') {
            return false;
          }
          return true;
        }
      });
      
      if (!blob) return;
        
      // 1. Try Web Share API (Mobile native sharing)
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Screenshot',
          });
          return;
        } catch (shareErr) {
          console.error('Share failed', shareErr);
        }
      }

      // 2. Try Clipboard API (Desktop/Supported browsers)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return;
      } catch (clipErr) {
        console.error('Clipboard failed, cancelling operation', clipErr);
      }
    } catch (err) {
      console.error('Failed to capture screenshot', err);
    }
  };

  const getBgColor = () => {
    const level = Math.min(depth, 6);
    if (useMasterColor || level === 0) {
      switch (level) {
        case 0: return 'bg-level-0-master';
        case 1: return 'bg-level-1-master';
        case 2: return 'bg-level-2-master';
        case 3: return 'bg-level-3-master';
        case 4: return 'bg-level-4-master';
        case 5: return 'bg-level-5-master';
        case 6: return 'bg-level-6-master';
        default: return 'bg-level-0-master';
      }
    } else {
      switch (level) {
        case 0: return 'bg-level-0-master'; // Fallback to master for level 0
        case 1: return 'bg-level-1-alt';
        case 2: return 'bg-level-2-alt';
        case 3: return 'bg-level-3-alt';
        case 4: return 'bg-level-4-alt';
        case 5: return 'bg-level-5-alt';
        case 6: return 'bg-level-6-alt';
        default: return 'bg-level-0-master';
      }
    }
  };

  const getButtonBgColor = () => {
    const level = Math.min(depth, 6);
    if (useMasterColor || level === 0) {
      switch (level) {
        case 0: return 'var(--color-level-0-master-button)';
        case 1: return 'var(--color-level-1-master-button)';
        case 2: return 'var(--color-level-2-master-button)';
        case 3: return 'var(--color-level-3-master-button)';
        case 4: return 'var(--color-level-4-master-button)';
        case 5: return 'var(--color-level-5-master-button)';
        case 6: return 'var(--color-level-6-master-button)';
        default: return 'var(--color-level-0-master-button)';
      }
    } else {
      switch (level) {
        case 0: return 'var(--color-level-0-master-button)';
        case 1: return 'var(--color-level-1-alt-button)';
        case 2: return 'var(--color-level-2-alt-button)';
        case 3: return 'var(--color-level-3-alt-button)';
        case 4: return 'var(--color-level-4-alt-button)';
        case 5: return 'var(--color-level-5-alt-button)';
        case 6: return 'var(--color-level-6-alt-button)';
        default: return 'var(--color-level-0-master-button)';
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        id={`comment-${comment.id}`}
        onClick={handleDoubleTap}
        className={`flex flex-col gap-2 p-4 ${getBgColor()} ${
        ((depth === 0 || isIsolatedRoot) && isFirst) && (isLast && !rendersReplies) ? 'rounded-2xl' :
        ((depth === 0 || isIsolatedRoot) && isFirst) ? 'rounded-l-2xl rounded-tr-2xl rounded-br-none' :
        (isLast && !rendersReplies) ? 'rounded-l-2xl rounded-tr-none rounded-br-2xl' :
        'rounded-l-2xl rounded-r-none'
      }`}>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary overflow-hidden whitespace-nowrap">
          <button 
            onClick={() => onUserClick?.(comment.author)}
            className="relative flex items-center gap-1.5 hover:underline overflow-hidden shrink-0"
          >
            <div className="w-5 h-5 rounded-full bg-bg-tertiary flex items-center justify-center overflow-hidden shrink-0">
              <UserAvatar username={comment.author} size={12} iconClassName="text-text-secondary" />
            </div>
            <span className="font-bold text-text-primary shrink-0">u/{comment.author}</span>
            <Ripple />
          </button>
          <Flair 
            text={comment.author_flair_text} 
            richtext={comment.author_flair_richtext}
            className="shrink min-w-0"
          />
          <span className="opacity-50 shrink-0">•</span>
          <span className="opacity-75 shrink-0">{formatTimestamp(comment.created_utc)}</span>
        </div>
        <div className="text-sm text-text-primary leading-relaxed prose dark:prose-invert prose-sm max-w-none break-anywhere">
          <RedditMarkdown content={comment.body} metadata={comment.media_metadata} />
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-text-secondary mt-1">
          <div className="flex items-center h-8">
            <motion.button 
              initial={false}
              onClick={() => handleVote(1)}
              animate={{
                width: 32,
                borderRadius: voteDir === 1 ? "16px 0px 0px 16px" : 
                             voteDir === -1 ? "16px 16px 16px 16px" : "16px 0px 0px 16px",
                marginRight: voteDir === -1 ? 6 : 0,
                backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : getButtonBgColor(),
                color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-on-surface-variant)"
              }}
              whileHover={voteDir === 0 ? { backgroundColor: "var(--md-sys-color-surface-container-high)" } : {}}
              transition={{ 
                duration: 0.3
              }}
              className="relative flex items-center justify-center h-full z-10 overflow-hidden"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
              <Ripple />
            </motion.button>
            <motion.div 
              initial={false}
              animate={{
                borderRadius: voteDir === 1 ? "0px 16px 16px 0px" : 
                             voteDir === -1 ? "16px 0px 0px 16px" : "0px 0px 0px 0px",
                marginLeft: voteDir === 1 ? -1 : 0,
                marginRight: voteDir === -1 ? -1 : 0,
                paddingLeft: voteDir === 1 ? 4 : voteDir === -1 ? 12 : 6,
                paddingRight: voteDir === 1 ? 12 : voteDir === -1 ? 4 : 6,
                backgroundColor: voteDir === 1 ? "var(--md-sys-color-primary)" : 
                                 voteDir === -1 ? "var(--md-sys-color-secondary-container)" : 
                                 getButtonBgColor(),
                color: voteDir === 1 ? "var(--md-sys-color-on-primary)" : 
                       voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : 
                       "var(--md-sys-color-on-surface)"
              }}
              transition={{ 
                duration: 0.3
              }}
              className="flex items-center justify-center font-bold text-xs h-full"
            >
              {localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore}
            </motion.div>
            <motion.button 
              initial={false}
              onClick={() => handleVote(-1)}
              animate={{
                width: 32,
                borderRadius: voteDir === -1 ? "0px 16px 16px 0px" : 
                             voteDir === 1 ? "16px 16px 16px 16px" : "0px 16px 16px 0px",
                marginLeft: voteDir === 1 ? 6 : 0,
                backgroundColor: voteDir === -1 ? "var(--md-sys-color-secondary-container)" : getButtonBgColor(),
                color: voteDir === -1 ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface-variant)"
              }}
              whileHover={voteDir === 0 ? { backgroundColor: "var(--md-sys-color-surface-container-high)" } : {}}
              transition={{ 
                duration: 0.3
              }}
              className="relative flex items-center justify-center h-full z-10 overflow-hidden"
            >
              <ArrowUp size={14} strokeWidth={2.5} className="rotate-180" />
              <Ripple />
            </motion.button>
          </div>
          
          <div className="relative ml-auto screenshot-exclude" ref={menuRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
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
                  className="absolute right-0 bottom-full mb-2 w-48 bg-bg-tertiary rounded-2xl z-50 overflow-hidden shadow-xl border border-white/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    onClick={() => {
                      const permalink = `https://reddit.com${comment.permalink}`;
                      navigator.clipboard.writeText(permalink);
                      setShowMenu(false);
                    }}
                    className="relative w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2 overflow-hidden"
                  >
                    <Link size={16} className="text-text-secondary" />
                    Copy Permalink
                    <Ripple />
                  </button>
                  <button 
                    disabled={commentHasMedia}
                    onClick={() => {
                      handleScreenshot(`comment-${comment.id}`);
                      setShowMenu(false);
                    }}
                    className={`relative w-full px-4 py-3 text-left text-sm flex items-center gap-2 overflow-hidden ${commentHasMedia ? 'text-text-secondary opacity-50 cursor-not-allowed' : 'text-text-primary hover:bg-hover-bg'}`}
                  >
                    <Camera size={16} className="text-text-secondary" />
                    Copy Screenshot
                    {!commentHasMedia && <Ripple />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {showReply && (
          <div className="mt-2 flex flex-col gap-3">
            <textarea 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Reply to this comment..."
              className="w-full p-3 bg-bg-tertiary text-text-primary rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all min-h-[80px]"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowReply(false)}
                className="relative px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all overflow-hidden"
              >
                Cancel
                <Ripple />
              </button>
              <button 
                onClick={handleReply}
                disabled={isSubmitting || !replyText.trim()}
                className="relative px-5 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 overflow-hidden"
              >
                {isSubmitting ? 'Posting...' : 'Reply'}
                <Ripple />
              </button>
            </div>
          </div>
        )}

        {hasReplies && depth >= 6 && !isIsolatedRoot && (
          <div className="mt-4 pt-4 pb-1 relative flex flex-col items-center">
            <div className="absolute top-0 left-2 right-2 h-[1px] bg-black/10 dark:bg-white/10 rounded-full" />
            <button 
              onClick={() => onIsolate?.(comment)}
              style={{ backgroundColor: getButtonBgColor() }}
              className="relative w-full sm:w-auto min-w-[220px] h-8 px-6 text-xs font-bold text-text-primary hover:brightness-95 dark:hover:brightness-110 transition-all flex items-center justify-center gap-2 overflow-hidden rounded-full active:scale-95"
            >
              <MessageSquare size={16} className="opacity-70" />
              <span>View {allReplies.length} {allReplies.length === 1 ? 'reply' : 'replies'}</span>
              <Ripple />
            </button>
          </div>
        )}
      </div>

      {rendersReplies && (
        <div className="flex flex-col gap-0 ml-3 md:ml-5 pl-3 md:pl-4 border-l-2 border-black/10 dark:border-white/20">
          {allReplies.map((reply, index) => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              depth={isIsolatedRoot ? 1 : depth + 1} 
              onVote={onVote} 
              onComment={onComment}
              onUserClick={onUserClick}
              isFirst={index === 0}
              isLast={isLast && index === allReplies.length - 1}
              useMasterColor={index % 2 === 0}
              onIsolate={onIsolate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
