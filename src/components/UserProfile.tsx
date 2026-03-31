/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RedditPost, fetchUserPosts, fetchUserProfile } from '../services/reddit';
import PostCard from './PostCard';
import { Ripple } from './Ripple';
import { ArrowLeft, User, Calendar, Award, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { SquigglyLoader } from './SquigglyLoader';
import { decodeHtml } from '../lib/decode';

interface UserProfileProps {
  username: string;
  onClose: () => void;
  onPostClick: (post: RedditPost) => void;
  onVote: (id: string, dir: number) => Promise<boolean>;
  onSubredditClick: (subreddit: string) => void;
  onMediaClick: (post: RedditPost) => void;
  onRedditLinkClick?: (url: string) => void;
}

export default function UserProfile({ 
  username, 
  onClose, 
  onPostClick, 
  onVote, 
  onSubredditClick,
  onMediaClick,
  onRedditLinkClick
}: UserProfileProps) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, { posts: userPosts, after: nextAfter }] = await Promise.all([
        fetchUserProfile(username),
        fetchUserPosts(username)
      ]);
      setProfile(profileData);
      setPosts(userPosts);
      setAfter(nextAfter);
    } catch (error) {
      console.error('Failed to load user profile', error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [profileData, { posts: userPosts, after: nextAfter }] = await Promise.all([
        fetchUserProfile(username),
        fetchUserPosts(username)
      ]);
      setProfile(profileData);
      setPosts(userPosts);
      setAfter(nextAfter);
    } catch (error) {
      console.error('Failed to refresh user profile', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Scroll listener for hiding/showing header
  useEffect(() => {
    loadData();
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollDirection = 0;
    let scrollStart = container.scrollTop;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      
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

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const loadMore = async () => {
    if (!after || loadingMore) return;
    setLoadingMore(true);
    try {
      const { posts: nextPosts, after: nextAfter } = await fetchUserPosts(username, after);
      setPosts(prev => [...prev, ...nextPosts]);
      setAfter(nextAfter);
    } catch (error) {
      console.error('Failed to load more user posts', error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bg-primary text-text-secondary">
        <SquigglyLoader size={32} className="mb-4 text-primary" />
        <p className="text-sm font-bold uppercase tracking-wider">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden relative">
      <motion.header 
        initial={false}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        className="absolute top-0 left-0 right-0 bg-bg-primary/90 backdrop-blur-md p-4 md:px-6 flex items-center justify-between z-20"
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
          >
            <ArrowLeft size={24} />
            <Ripple />
          </button>
          <h2 className="font-display font-medium text-xl text-text-primary">{username}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className={`relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all touch-manipulation active:scale-90 overflow-hidden ${isRefreshing ? 'animate-spin text-primary' : ''}`}
          >
            <RefreshCw size={24} />
            <Ripple />
          </button>
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto pt-[72px]" ref={scrollContainerRef}>
        {/* Profile Header */}
        <div className="p-6 md:p-8 flex flex-col gap-6 bg-bg-secondary">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg-tertiary overflow-hidden shrink-0">
              {profile?.icon_img ? (
                <img 
                  src={profile.icon_img.split('?')[0]} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-display font-bold text-text-secondary">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text-primary tracking-tight">{username}</h1>
              <div className="flex flex-wrap gap-4 text-sm font-medium mt-1">
                <div className="flex items-center gap-1.5 bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full">
                  <Award size={16} className="text-primary" />
                  <span>{profile?.link_karma + profile?.comment_karma || 0} karma</span>
                </div>
                <div className="flex items-center gap-1.5 bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full">
                  <Calendar size={16} className="text-primary" />
                  <span>Joined {new Date(profile?.created_utc * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {profile?.public_description && (
            <p className="text-base text-text-primary leading-relaxed max-w-2xl bg-bg-tertiary p-4 rounded-2xl">
              {decodeHtml(profile.public_description)}
            </p>
          )}
        </div>

        {/* User Posts */}
        <div className="p-2 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-3 md:gap-6 mt-4">
          <h3 className="px-4 md:px-0 text-xl font-display font-bold text-text-primary mb-2 md:mb-0">Posts</h3>
          {posts.length === 0 ? (
            <div className="p-12 text-center text-text-secondary bg-bg-tertiary rounded-3xl mx-4 md:mx-0">
              <p className="font-medium">No posts yet.</p>
            </div>
          ) : (
            <>
              {posts.map((post, idx) => (
                <PostCard 
                  key={`${post.id}-${idx}`} 
                  post={post} 
                  onClick={onPostClick} 
                  onVote={onVote}
                  onSubredditClick={onSubredditClick}
                  onMediaClick={onMediaClick}
                  onRedditLinkClick={onRedditLinkClick}
                />
              ))}
              
              {after && (
                <button 
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="relative mx-4 md:mx-0 py-4 bg-bg-secondary text-text-primary rounded-full text-sm font-bold hover:bg-bg-tertiary transition-all mb-8 flex items-center justify-center gap-2 active:scale-95 overflow-hidden"
                >
                  {loadingMore ? <SquigglyLoader size={18} /> : 'Load More'}
                  <Ripple />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
