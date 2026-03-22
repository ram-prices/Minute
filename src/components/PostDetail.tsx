/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { RedditPost, RedditComment, fetchPostDetails, getStreamableId } from '../services/reddit';
import { X, ArrowLeft, MessageSquare, ArrowUp, Clock, User, MoreVertical, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import VideoPlayer from './VideoPlayer';

interface PostDetailProps {
  post: RedditPost;
  onClose: () => void;
  onVote?: (id: string, dir: number) => Promise<boolean>;
  onComment?: (parentId: string, text: string) => Promise<RedditComment | null>;
  onSubredditClick?: (subreddit: string) => void;
  onUserClick?: (username: string) => void;
  onFilterSubreddit?: (subreddit: string) => void;
  onFilterUser?: (username: string) => void;
}

export default function PostDetail({ 
  post, 
  onClose, 
  onVote, 
  onComment, 
  onSubredditClick, 
  onUserClick,
  onFilterSubreddit,
  onFilterUser
}: PostDetailProps) {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteDir, setVoteDir] = useState(post.likes === true ? 1 : post.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(post.score);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className="h-full flex flex-col bg-[#030303]">
      <header className="sticky top-0 bg-[#030303]/90 backdrop-blur-md p-4 md:px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-1 -ml-1 text-[#818384] hover:text-[#D7DADC] transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <button 
            onClick={() => onSubredditClick?.(post.subreddit)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-6 h-6 rounded-full bg-[#1A1A1B] flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden">
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
            <span className="text-[14px] font-bold text-[#D7DADC]">r/{post.subreddit}</span>
          </button>
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-[#818384] hover:text-[#D7DADC] hover:bg-white/5 rounded-md transition-colors"
          >
            <MoreVertical size={20} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#1A1A1B] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <button 
                  onClick={() => {
                    onFilterSubreddit?.(post.subreddit);
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#D7DADC] hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 size={16} className="text-red-500" />
                  Filter r/{post.subreddit}
                </button>
                <button 
                  onClick={() => {
                    onFilterUser?.(post.author);
                    onClose();
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
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="p-4 md:p-8 flex flex-col gap-6">
          <div className="flex items-center gap-2 text-xs text-[#818384]">
            <button 
              onClick={() => onUserClick?.(post.author)}
              className="flex items-center gap-1.5 hover:underline"
            >
              <div className="w-5 h-5 rounded-full bg-[#1A1A1B] flex items-center justify-center overflow-hidden shrink-0">
                <User size={12} className="text-[#818384]" />
              </div>
              <span className="font-medium text-[#D7DADC]">u/{post.author}</span>
            </button>
            {post.author_flair_text && (
              <span className="px-1.5 py-0.5 bg-[#1A1A1B] text-[#D7DADC] text-[10px] rounded font-medium border border-white/10 shadow-sm">
                {post.author_flair_text}
              </span>
            )}
            <span>•</span>
            <span>{new Date(post.created_utc * 1000).toLocaleDateString()}</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <h1 className="text-[18px] font-bold text-[#D7DADC] leading-snug break-anywhere">
              {post.title}
            </h1>
            {post.link_flair_text && (
              <div className="mt-1">
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
        </div>

        {/* Media Section - Edge to Edge */}
        <div className="w-full bg-black">
          {post.is_video && post.media?.reddit_video && (
            <div className="w-full aspect-video">
              <VideoPlayer 
                src={post.media.reddit_video.fallback_url} 
                hlsUrl={post.media.reddit_video.hls_url}
                autoPlay
                muted={false}
                className="w-full h-full"
              />
            </div>
          )}

          {getStreamableId(post.url) && (
            <div className="w-full aspect-video">
              <iframe 
                src={`https://streamable.com/e/${getStreamableId(post.url)}`} 
                className="w-full h-full border-none"
                title="Streamable Video"
                allow="autoplay; fullscreen"
              />
            </div>
          )}

          {!post.is_video && post.url && post.url.match(/\.(jpg|jpeg|png|gif)$/) && (
            <div className="w-full no-callout">
              <img 
                src={post.url} 
                alt={post.title} 
                className="w-full h-auto no-callout pointer-events-none"
                referrerPolicy="no-referrer"
                onContextMenu={(e) => e.preventDefault()}
                draggable="false"
              />
            </div>
          )}

          {/* Website Link Preview Embed */}
          {((post.post_hint === 'link') || (post.url && !post.url.includes('reddit.com/r/') && post.domain && !post.domain.startsWith('self.'))) && 
           !post.is_video && !post.url.match(/\.(jpg|jpeg|png|gif|mp4|webm)$/) && !getStreamableId(post.url) && (
            <div className="p-4 md:p-8 bg-[#030303] no-callout" onContextMenu={(e) => e.preventDefault()}>
              <a 
                href={post.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onContextMenu={(e) => e.preventDefault()}
                className="block max-w-[520px] bg-[#1A1A1B] border border-white/10 rounded-xl overflow-hidden hover:bg-white/[0.02] transition-all group shadow-2xl no-callout"
              >
                <div className="p-4 md:p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    {post.domain && (
                      <span className="text-[10px] text-[#818384] font-bold uppercase tracking-[0.1em]">
                        {post.domain}
                      </span>
                    )}
                    <div className="w-2 h-2 rounded-full bg-[#FF4500] shadow-[0_0_8px_rgba(255,69,0,0.5)]" />
                  </div>
                  
                  <h3 className="text-[16px] font-semibold text-[#D7DADC] group-hover:text-white leading-tight transition-colors">
                    {post.title}
                  </h3>
                  
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <p className="text-[13px] text-[#818384] line-clamp-2 leading-relaxed">
                        Read the full article on {post.domain}. Click to open in a new tab.
                      </p>
                    </div>
                    {post.thumbnail && post.thumbnail.startsWith('http') && (
                      <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-lg overflow-hidden bg-[#030303] border border-white/5 no-callout">
                        <img 
                          src={post.thumbnail} 
                          alt="" 
                          className="w-full h-full object-cover no-callout pointer-events-none"
                          referrerPolicy="no-referrer"
                          onContextMenu={(e) => e.preventDefault()}
                          draggable="false"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {post.preview?.images[0]?.source?.url && (
                  <div className="w-full border-t border-white/5 aspect-[1.91/1] overflow-hidden bg-[#030303] no-callout">
                    <img 
                      src={post.preview.images[0].source.url.replace(/&amp;/g, '&')} 
                      alt="" 
                      className="w-full h-full object-cover no-callout pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                      referrerPolicy="no-referrer"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable="false"
                    />
                  </div>
                )}
                
                <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-[#818384] font-medium">External Link</span>
                  <div className="text-[#FF4500] group-hover:translate-x-1 transition-transform">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                </div>
              </a>
            </div>
          )}
        </div>

        <div className="p-4 md:p-8 flex flex-col gap-8">
          {post.selftext && (
            <div className="text-sm text-[#D7DADC] leading-relaxed bg-[#1A1A1B] p-4 md:p-6 rounded-lg prose prose-invert prose-sm max-w-none break-anywhere">
              <Markdown>{post.selftext}</Markdown>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#1A1A1B] rounded-md p-0.5 h-[36px]">
              <button 
                onClick={() => handleVote(1)}
                className={`p-1.5 rounded-md transition-colors h-full flex items-center ${voteDir === 1 ? 'text-[#FF4500] bg-[#FF4500]/10' : 'text-[#818384] hover:bg-white/5'}`}
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
              <span className={`text-[13px] font-bold px-1 min-w-[24px] text-center ${voteDir === 1 ? 'text-[#FF4500]' : voteDir === -1 ? 'text-[#7193FF]' : 'text-[#D7DADC]'}`}>
                {localScore > 1000 ? `${(localScore / 1000).toFixed(1)}k` : localScore}
              </span>
              <button 
                onClick={() => handleVote(-1)}
                className={`p-1.5 rounded-md transition-colors rotate-180 h-full flex items-center ${voteDir === -1 ? 'text-[#7193FF] bg-[#7193FF]/10' : 'text-[#818384] hover:bg-white/5'}`}
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1A1B] rounded-md px-3 h-[36px] text-[#D7DADC] hover:bg-white/5 transition-colors">
              <MessageSquare size={16} />
              <span className="text-[13px] font-bold">{post.num_comments}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[#1A1A1B] animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-12">
              {comments.map(comment => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  onVote={onVote}
                  onComment={onComment}
                  onUserClick={onUserClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for Commenting */}
      <button 
        onClick={() => setShowReplyModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#FF4500] text-white rounded-xl shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[80]"
      >
        <MessageSquare size={24} fill="currentColor" />
      </button>

      {/* Comment Modal */}
      {showReplyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReplyModal(false)}
          />
          <div className="relative w-full max-w-lg bg-[#1A1A1B] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <header className="p-4 flex items-center justify-between border-b border-white/5">
              <h3 className="font-semibold text-[#D7DADC]">Post Comment</h3>
              <button 
                onClick={() => setShowReplyModal(false)}
                className="p-1 text-[#818384] hover:text-[#D7DADC]"
              >
                <X size={20} />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-4">
              <textarea 
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="What are your thoughts?"
                className="w-full p-3 bg-[#030303] text-[#D7DADC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500] transition-all min-h-[150px]"
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowReplyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-[#818384] hover:text-[#D7DADC]"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await handleMainReply();
                    setShowReplyModal(false);
                  }}
                  disabled={isSubmitting || !replyText.trim()}
                  className="px-6 py-2 bg-[#D7DADC] text-[#030303] rounded-lg text-sm font-semibold hover:bg-[#D7DADC]/90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
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
  onUserClick
}: { 
  comment: RedditComment, 
  depth?: number, 
  onVote?: any, 
  onComment?: any,
  onUserClick?: (username: string) => void
}) {
  const [voteDir, setVoteDir] = useState(comment.likes === true ? 1 : comment.likes === false ? -1 : 0);
  const [localScore, setLocalScore] = useState(comment.score);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localReplies, setLocalReplies] = useState<RedditComment[]>([]);

  if (!comment.author || !comment.body) return null;

  const handleVote = async (dir: number) => {
    if (!onVote) return;
    const newDir = voteDir === dir ? 0 : dir;
    const success = await onVote(comment.name, newDir);
    if (success) {
      setLocalScore(prev => prev - voteDir + newDir);
      setVoteDir(newDir);
    }
  };

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

  return (
    <div className={`flex flex-col gap-2 ${depth > 0 ? 'ml-4 md:ml-6 border-l-2 border-[#1A1A1B] pl-4' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-[#818384]">
        <button 
          onClick={() => onUserClick?.(comment.author)}
          className="flex items-center gap-1.5 hover:underline"
        >
          <div className="w-4 h-4 rounded-full bg-[#1A1A1B] flex items-center justify-center overflow-hidden shrink-0">
            <User size={10} className="text-[#818384]" />
          </div>
          <span className="font-medium text-[#D7DADC]">u/{comment.author}</span>
        </button>
        {comment.author_flair_text && (
          <span className="px-1.5 py-0.5 bg-[#1A1A1B] text-[#D7DADC] text-[10px] rounded font-medium border border-white/10 shadow-sm">
            {comment.author_flair_text}
          </span>
        )}
        <span>•</span>
        <span className={`font-bold ${voteDir === 1 ? 'text-[#FF4500]' : voteDir === -1 ? 'text-[#7193FF]' : ''}`}>
          {localScore} pts
        </span>
      </div>
      <div className="text-sm text-[#D7DADC] leading-relaxed prose prose-invert prose-sm max-w-none break-anywhere">
        <Markdown>{comment.body}</Markdown>
      </div>
      <div className="flex items-center gap-4 text-xs font-medium text-[#818384] mt-1">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => handleVote(1)}
            className={`p-1 rounded hover:bg-[#272729] transition-colors ${voteDir === 1 ? 'text-[#FF4500]' : ''}`}
          >
            <ArrowUp size={14} />
          </button>
          <button 
            onClick={() => handleVote(-1)}
            className={`p-1 rounded hover:bg-[#272729] transition-colors rotate-180 ${voteDir === -1 ? 'text-[#7193FF]' : ''}`}
          >
            <ArrowUp size={14} />
          </button>
        </div>
        <button 
          onClick={() => setShowReply(!showReply)}
          className="hover:text-[#D7DADC] transition-colors"
        >
          Reply
        </button>
        <button className="hover:text-[#D7DADC] transition-colors">Share</button>
      </div>

      {showReply && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea 
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply to this comment..."
            className="w-full p-2 bg-[#1A1A1B] text-[#D7DADC] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500] transition-all min-h-[80px]"
          />
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowReply(false)}
              className="px-3 py-1 text-xs font-medium text-[#818384] hover:text-[#D7DADC]"
            >
              Cancel
            </button>
            <button 
              onClick={handleReply}
              disabled={isSubmitting || !replyText.trim()}
              className="px-4 py-1.5 bg-[#D7DADC] text-[#030303] rounded-md text-xs font-semibold hover:bg-[#D7DADC]/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {localReplies.map(reply => (
        <CommentItem 
          key={reply.id} 
          comment={reply} 
          depth={depth + 1} 
          onVote={onVote} 
          onComment={onComment}
          onUserClick={onUserClick}
        />
      ))}
      
      {comment.replies?.data?.children?.map((reply: any) => (
        <CommentItem 
          key={reply.data.id} 
          comment={reply.data} 
          depth={depth + 1} 
          onVote={onVote} 
          onComment={onComment}
          onUserClick={onUserClick}
        />
      ))}
    </div>
  );
}
