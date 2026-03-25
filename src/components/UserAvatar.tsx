import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { getUserProfilePic } from '../services/reddit';

// Simple in-memory cache to avoid redundant fetches
const avatarCache = new Map<string, string | null>();
const pendingFetches = new Map<string, Promise<string | null>>();

interface UserAvatarProps {
  username: string;
  size?: number;
  className?: string;
  iconClassName?: string;
}

export function UserAvatar({ username, size = 14, className = '', iconClassName = '' }: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatarCache.get(username) || null);

  useEffect(() => {
    if (avatarCache.has(username)) {
      setAvatarUrl(avatarCache.get(username) || null);
      return;
    }

    let isMounted = true;

    const fetchAvatar = async () => {
      try {
        let fetchPromise = pendingFetches.get(username);
        if (!fetchPromise) {
          fetchPromise = getUserProfilePic(username);
          pendingFetches.set(username, fetchPromise);
        }

        const url = await fetchPromise;
        
        if (isMounted) {
          if (url) {
            avatarCache.set(username, url);
          } else {
            avatarCache.set(username, null);
          }
          setAvatarUrl(url);
        }
      } catch (error) {
        console.error('Failed to fetch avatar for', username, error);
      }
    };

    fetchAvatar();

    return () => {
      isMounted = false;
    };
  }, [username]);

  if (avatarUrl) {
    return (
      <img 
        src={avatarUrl} 
        alt={`u/${username}`} 
        className={`w-full h-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return <User size={size} className={iconClassName} />;
}
