import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { getUserProfilePic } from '../services/reddit';

// Simple in-memory cache to avoid redundant fetches
const avatarCache = new Map<string, string | null>();
const pendingFetches = new Map<string, Promise<string | null>>();

// Rate-limit avatar fetches: max 3 concurrent, queued thereafter
let activeFetches = 0;
const MAX_CONCURRENT = 3;
const fetchQueue: Array<() => void> = [];

function scheduleAvatarFetch(fn: () => void) {
  if (activeFetches < MAX_CONCURRENT) {
    activeFetches++;
    fn();
  } else {
    fetchQueue.push(fn);
  }
}

function onFetchDone() {
  activeFetches--;
  if (fetchQueue.length > 0) {
    const next = fetchQueue.shift()!;
    activeFetches++;
    next();
  }
}

// System accounts and bots that never have avatars – skip fetching them
const NO_AVATAR_ACCOUNTS = new Set([
  'AutoModerator', '[deleted]', 'reddit', 'redditads', 'anti-gif-bot',
]);

interface UserAvatarProps {
  username: string;
  size?: number;
  className?: string;
  iconClassName?: string;
}

export const UserAvatar = React.memo(function UserAvatar({
  username,
  size = 14,
  className = '',
  iconClassName = '',
}: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    avatarCache.has(username) ? avatarCache.get(username)! : null
  );

  useEffect(() => {
    if (avatarCache.has(username)) {
      setAvatarUrl(avatarCache.get(username) ?? null);
      return;
    }

    if (NO_AVATAR_ACCOUNTS.has(username)) {
      avatarCache.set(username, null);
      return;
    }

    let cancelled = false;

    scheduleAvatarFetch(async () => {
      try {
        let fetchPromise = pendingFetches.get(username);
        if (!fetchPromise) {
          fetchPromise = getUserProfilePic(username);
          pendingFetches.set(username, fetchPromise);
        }

        const url = await fetchPromise;
        avatarCache.set(username, url ?? null);
        pendingFetches.delete(username);

        if (!cancelled) setAvatarUrl(url ?? null);
      } catch {
        avatarCache.set(username, null);
        pendingFetches.delete(username);
      } finally {
        onFetchDone();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${username}`}
        className={`w-full h-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return <User size={size} className={iconClassName} />;
});
