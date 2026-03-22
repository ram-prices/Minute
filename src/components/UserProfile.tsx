/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { RedditPost, fetchUserPosts, fetchUserProfile } from '../services/reddit';
import PostCard from './PostCard';
import { ArrowLeft, Loader2, User, Calendar, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  username: string;
  onClose: () => void;
  onPostClick: (post: RedditPost) => void;
  onVote: (id: string, dir: number) => Promise<boolean>;
  onSubredditClick: (subreddit: string) => void;
  onMediaClick: (post: RedditPost) => void;
}

export default function UserProfile({ 
  username, 
  onClose, 
  onPostClick, 
  onVote, 
  onSubredditClick,
  onMediaClick
}: UserProfileProps) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      <div className="h-full flex flex-col items-center justify-center bg-[#030303] text-gray-400">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-sm font-medium uppercase tracking-wider">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#030303] overflow-hidden">
      <header className="sticky top-0 bg-[#030303]/90 backdrop-blur-md p-4 md:px-6 flex items-center gap-4 z-10">
        <button 
          onClick={onClose}
          className="p-1 -ml-1 text-[#818384] hover:text-[#D7DADC] transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h2 className="font-bold text-[#D7DADC]">u/{username}</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="p-6 md:p-8 flex flex-col gap-6 border-b border-white/5">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#1A1A1B] overflow-hidden shrink-0">
              {profile?.icon_img ? (
                <img 
                  src={profile.icon_img.split('?')[0]} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-[#D7DADC]">u/{username}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-[#818384]">
                <div className="flex items-center gap-1.5">
                  <Award size={16} />
                  <span>{profile?.link_karma + profile?.comment_karma || 0} karma</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} />
                  <span>Joined {new Date(profile?.created_utc * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {profile?.public_description && (
            <p className="text-sm text-[#D7DADC] leading-relaxed max-w-2xl">
              {profile.public_description}
            </p>
          )}
        </div>

        {/* User Posts */}
        <div className="p-0 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-0 md:gap-6">
          <h3 className="px-4 md:px-0 text-lg font-semibold text-[#D7DADC] mb-2 md:mb-0">Posts</h3>
          {posts.length === 0 ? (
            <div className="p-12 text-center text-[#818384]">
              <p>No posts yet.</p>
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
                />
              ))}
              
              {after && (
                <button 
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mx-4 md:mx-0 py-4 bg-[#1A1A1B] text-[#D7DADC] rounded-xl text-sm font-medium hover:bg-[#272729] transition-all mb-8 flex items-center justify-center gap-2"
                >
                  {loadingMore ? <Loader2 size={18} className="animate-spin" /> : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
