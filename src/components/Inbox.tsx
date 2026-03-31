import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, RefreshCw, Mail, MessageSquare, AtSign, Check, CheckCircle2 } from 'lucide-react';
import { fetchInbox, markMessageAsRead, RedditMessage } from '../services/reddit';
import { Ripple } from './Ripple';
import { SquigglyLoader } from './SquigglyLoader';
import { formatTimestamp } from '../lib/time';
import { decodeHtml } from '../lib/decode';
import RedditMarkdown from './RedditMarkdown';

interface InboxProps {
  onClose: () => void;
  onUserClick: (username: string) => void;
  onRedditLinkClick: (url: string) => void;
}

export default function Inbox({ onClose, onUserClick, onRedditLinkClick }: InboxProps) {
  const [messages, setMessages] = useState<RedditMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'inbox' | 'unread' | 'messages' | 'comments' | 'selfreply' | 'mentions'>('inbox');
  const [error, setError] = useState<string | null>(null);
  const afterRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadMessages = async (append = false) => {
    try {
      setError(null);
      if (!append) {
        setLoading(true);
        afterRef.current = null;
      } else {
        setLoadingMore(true);
      }
      
      const { messages: newMessages, after } = await fetchInbox(filter, append ? afterRef.current || undefined : undefined);
      
      if (append) {
        setMessages(prev => [...prev, ...newMessages]);
      } else {
        setMessages(newMessages);
      }
      afterRef.current = after;
    } catch (err: any) {
      console.error('Failed to load inbox', err);
      setError(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadMessages();
  };

  const handleScroll = () => {
    if (!containerRef.current || loading || loadingMore || !afterRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 400) {
      loadMessages(true);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      await markMessageAsRead(name);
      setMessages(prev => prev.map(m => m.name === name ? { ...m, new: false } : m));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const getIcon = (type?: string) => {
    if (!type) return <Mail size={16} />;
    if (type.includes('reply')) return <MessageSquare size={16} />;
    if (type === 'username_mention') return <AtSign size={16} />;
    return <Mail size={16} />;
  };

  return (
    <motion.main 
      key="inbox"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.2, 0, 0, 1],
        opacity: { duration: 0.3, ease: "linear" }
      }}
      className="absolute inset-0 flex flex-col w-full h-full bg-bg-primary overflow-hidden z-40"
    >
      <header className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-md px-4 pt-4 pb-2 safe-top shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-colors active:scale-95 overflow-hidden"
            >
              <ArrowLeft size={24} />
              <Ripple />
            </button>
            <h1 className="text-2xl font-display font-medium text-text-primary">Inbox</h1>
          </div>
          <button 
            onClick={handleRefresh}
            className={`relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden ${isRefreshing ? 'animate-spin text-primary' : ''}`}
          >
            <RefreshCw size={24} />
            <Ripple />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mt-4 pb-2">
          {(['inbox', 'unread', 'messages', 'comments', 'selfreply', 'mentions'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              {f === 'selfreply' ? 'Post Replies' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-y-none p-4 md:p-8"
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-12">
              <SquigglyLoader size={48} className="text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <Mail size={48} className="mb-4 opacity-50 text-red-500" />
              <p className="text-lg font-medium text-red-500">Error loading inbox</p>
              <p className="text-sm opacity-75 text-center mt-2 max-w-md">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <Mail size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages</p>
              <p className="text-sm opacity-75">You're all caught up!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.name}
                onClick={() => {
                  if (msg.context) {
                    onRedditLinkClick(msg.context.split('?')[0]);
                  }
                }}
                className={`flex flex-col gap-2 p-4 rounded-2xl transition-colors cursor-pointer ${
                  msg.new ? 'bg-primary/10 border border-primary/20' : 'bg-bg-secondary hover:bg-bg-tertiary'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-text-secondary font-medium">
                    <span className="flex items-center gap-1.5 text-primary">
                      {getIcon(msg.type)}
                      <span className="capitalize">{msg.type ? msg.type.replace('_', ' ') : 'Message'}</span>
                    </span>
                    <span>•</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUserClick(msg.author); }}
                      className="font-bold text-text-primary hover:underline"
                    >
                      {msg.author}
                    </button>
                    <span>•</span>
                    <span>{formatTimestamp(msg.created_utc)}</span>
                  </div>
                  {msg.new && (
                    <button
                      onClick={(e) => handleMarkAsRead(e, msg.id, msg.name)}
                      className="p-1.5 text-primary hover:bg-primary/20 rounded-full transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                </div>

                {msg.subject && msg.subject !== 'comment reply' && msg.subject !== 'post reply' && msg.subject !== 'username mention' && (
                  <h3 className="font-bold text-text-primary text-sm">{decodeHtml(msg.subject)}</h3>
                )}

                <div className="text-sm text-text-primary leading-relaxed prose dark:prose-invert prose-sm max-w-none break-anywhere">
                  <RedditMarkdown content={msg.body} />
                </div>

                {msg.link_title && (
                  <div className="mt-2 p-3 bg-bg-tertiary rounded-xl text-xs text-text-secondary line-clamp-2">
                    <span className="font-bold">Re: </span>{decodeHtml(msg.link_title)}
                  </div>
                )}
              </div>
            ))
          )}
          
          {loadingMore && (
            <div className="flex justify-center py-4">
              <SquigglyLoader size={32} className="text-primary" />
            </div>
          )}
        </div>
      </div>
    </motion.main>
  );
}
