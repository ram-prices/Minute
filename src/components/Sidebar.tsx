/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, TrendingUp, Hash, Settings, LogIn, LogOut } from 'lucide-react';

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
    <div className="w-64 h-screen bg-bg-primary p-4 flex flex-col gap-6 sticky top-0">
      <div className="flex items-center gap-3 px-2 mt-2">
        <div className="w-8 h-8 bg-[#FF4500] rounded-md flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">Minute</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-6 mt-4 overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 px-2 mb-1 uppercase tracking-wider">Navigation</span>
          <NavItem 
            icon={<Home size={18} />} 
            label="Home" 
            active={currentSubreddit === 'home'} 
            onClick={() => onSubredditChange('home')} 
          />
          <NavItem 
            icon={<TrendingUp size={18} />} 
            label="Popular" 
            active={currentSubreddit === 'popular'} 
            onClick={() => onSubredditChange('popular')} 
          />
          {!isLoggedIn && (
            <NavItem 
              icon={<Hash size={18} />} 
              label="All" 
              active={currentSubreddit === 'all'} 
              onClick={() => onSubredditChange('all')} 
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 px-2 mb-1 uppercase tracking-wider">
            {isLoggedIn ? 'Your Subreddits' : 'Subreddits'}
          </span>
          {subredditsToDisplay.filter(s => s !== 'all' && s !== 'popular' && s !== 'home').map(sub => (
            <NavItem 
              key={sub}
              icon={<Hash size={18} />} 
              label={sub} 
              active={currentSubreddit === sub} 
              onClick={() => onSubredditChange(sub)} 
            />
          ))}
        </div>
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="px-2">
          {!redditClientId ? (
            <button 
              onClick={onSettingsClick}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
            >
              <Settings size={18} />
              <span>Setup Reddit API</span>
            </button>
          ) : !isLoggedIn && (
            <button 
              onClick={onLoginClick}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
            >
              <LogIn size={18} />
              <span>Login with Reddit</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-2 text-text-secondary pt-4">
          <button 
            onClick={onSettingsClick}
            className="flex items-center gap-2 text-sm font-medium hover:text-text-primary transition-colors"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="flex flex-col items-end gap-0.5">
            {isLoggedIn && currentUsername && (
              <span className="text-[10px] font-bold text-text-primary truncate max-w-[80px]">u/{currentUsername}</span>
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
      className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors text-sm font-medium ${
        active 
          ? 'bg-bg-tertiary text-text-primary' 
          : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
      }`}
    >
      <div className={`${active ? 'text-text-primary' : 'text-text-secondary'}`}>
        {icon}
      </div>
      <span className="capitalize">{label}</span>
    </button>
  );
}
