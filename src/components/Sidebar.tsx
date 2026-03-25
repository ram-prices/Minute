/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, TrendingUp, Hash, Settings, LogIn, LogOut } from 'lucide-react';
import { Ripple } from './Ripple';
import { decodeHtml } from '../lib/decode';

interface SidebarProps {
  currentSubreddit: string;
  onSubredditChange: (subreddit: string) => void;
  onSettingsClick: () => void;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  mySubreddits: string[];
  redditClientId: string;
  currentUsername: string;
}

const DEFAULT_SUBREDDITS = ['all', 'popular', 'gaming', 'technology', 'worldnews', 'science', 'movies'];

export default function Sidebar({ 
  currentSubreddit, 
  onSubredditChange, 
  onSettingsClick,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
  mySubreddits,
  redditClientId,
  currentUsername
}: SidebarProps) {
  const subredditsToDisplay = isLoggedIn && mySubreddits.length > 0 ? mySubreddits : DEFAULT_SUBREDDITS;

  return (
    <div className="w-72 h-screen bg-bg-secondary p-4 flex flex-col gap-4 sticky top-0">
      <div className="flex items-center gap-3 px-4 mt-1 mb-2">
        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
          <div className="w-3 h-3 bg-on-primary rounded-full" />
        </div>
        <h1 className="text-xl font-display font-bold tracking-tight text-text-primary">Minute</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-4 mt-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-text-secondary px-4 mb-1 uppercase tracking-wider">Navigation</span>
          <NavItem 
            icon={<Home size={20} />} 
            label="Home" 
            active={currentSubreddit === 'home'} 
            onClick={() => onSubredditChange('home')} 
          />
          <NavItem 
            icon={<TrendingUp size={20} />} 
            label="Popular" 
            active={currentSubreddit === 'popular'} 
            onClick={() => onSubredditChange('popular')} 
          />
          {!isLoggedIn && (
            <NavItem 
              icon={<Hash size={20} />} 
              label="All" 
              active={currentSubreddit === 'all'} 
              onClick={() => onSubredditChange('all')} 
            />
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-text-secondary px-4 mb-1 uppercase tracking-wider">
            {isLoggedIn ? 'Your Subreddits' : 'Subreddits'}
          </span>
          {subredditsToDisplay.filter(s => s !== 'all' && s !== 'popular' && s !== 'home').map(sub => (
            <NavItem 
              key={sub}
              icon={<Hash size={20} />} 
              label={sub} 
              active={currentSubreddit === sub} 
              onClick={() => onSubredditChange(sub)} 
            />
          ))}
        </div>
      </nav>

      <div className="mt-auto flex flex-col gap-4 pt-4">
        <div className="px-2">
          {!redditClientId ? (
            <button 
              onClick={onSettingsClick}
              className="relative flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-bold text-on-primary bg-primary hover:opacity-90 rounded-full transition-all active:scale-95 overflow-hidden"
            >
              <Settings size={18} />
              <span>Setup Reddit API</span>
              <Ripple />
            </button>
          ) : !isLoggedIn && (
            <button 
              onClick={onLoginClick}
              className="relative flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-bold text-on-primary bg-primary hover:opacity-90 rounded-full transition-all active:scale-95 overflow-hidden"
            >
              <LogIn size={18} />
              <span>Login with Reddit</span>
              <Ripple />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-4 text-text-secondary">
          <button 
            onClick={onSettingsClick}
            className="relative flex items-center gap-2 text-sm font-medium hover:text-text-primary transition-colors p-2 -ml-2 rounded-full hover:bg-hover-bg overflow-hidden"
          >
            <Settings size={20} />
            <span>Settings</span>
            <Ripple />
          </button>
          <div className="flex flex-col items-end gap-0.5">
            {isLoggedIn && currentUsername && (
              <span className="text-[11px] font-bold text-text-primary truncate max-w-[80px]">u/{currentUsername}</span>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 py-2.5 rounded-full transition-colors text-sm font-medium my-0.25 overflow-hidden ${
        active 
          ? 'bg-secondary-container text-on-secondary-container font-bold' 
          : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary'
      }`}
    >
      <div className={`${active ? 'text-on-secondary-container' : 'text-text-secondary'}`}>
        {icon}
      </div>
      <span className="capitalize">{decodeHtml(label)}</span>
      <Ripple />
    </button>
  );
}
