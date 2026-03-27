/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  thumbnail: string;
  url: string;
  permalink: string;
  created_utc: number;
  selftext?: string;
  selftext_html?: string;
  link_flair_text?: string;
  link_flair_background_color?: string;
  link_flair_text_color?: string;
  link_flair_richtext?: Array<{ e: 'text'; t?: string } | { e: 'emoji'; u: string; a: string }>;
  author_flair_text?: string;
  author_flair_background_color?: string;
  author_flair_text_color?: string;
  author_flair_richtext?: Array<{ e: 'text'; t?: string } | { e: 'emoji'; u: string; a: string }>;
  author_fullname?: string;
  is_video: boolean;
  is_gallery?: boolean;
  gallery_data?: {
    items: Array<{
      media_id: string;
      id: number;
    }>;
  };
  post_hint?: string;
  domain?: string;
  sr_detail?: {
    community_icon?: string;
    icon_img?: string;
    primary_color?: string;
  };
  media?: {
    reddit_video?: {
      fallback_url: string;
      hls_url: string;
      dash_url: string;
    };
  };
  likes: boolean | null;
  name: string;
  preview?: {
    images: Array<{
      source: { url: string };
      resolutions: Array<{ url: string; width: number; height: number }>;
    }>;
  };
  media_metadata?: {
    [key: string]: {
      s: { u: string; x: number; y: number };
      t: string;
      id: string;
    };
  };
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  body_html?: string;
  score: number;
  created_utc: number;
  permalink: string;
  author_flair_text?: string;
  author_flair_richtext?: Array<{ e: 'text'; t?: string } | { e: 'emoji'; u: string; a: string }>;
  author_fullname?: string;
  replies?: {
    data: {
      children: Array<{ data: RedditComment }>;
    };
  };
  likes: boolean | null;
  name: string;
  media_metadata?: {
    [key: string]: {
      s: { u: string; x: number; y: number };
      t: string;
      id: string;
    };
  };
}

export interface RedditAccount {
  username: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: number;
  clientId: string;
}

let accessToken: string | null = localStorage.getItem('reddit_access_token');
let refreshToken: string | null = localStorage.getItem('reddit_refresh_token');
let tokenExpiresAt: number = Number(localStorage.getItem('reddit_token_expires_at')) || 0;
let clientId: string | null = localStorage.getItem('reddit_client_id');
let currentUsername: string | null = localStorage.getItem('reddit_current_username');

export function getAccounts(): RedditAccount[] {
  try {
    const accountsStr = localStorage.getItem('reddit_accounts');
    if (!accountsStr) return [];
    const accounts = JSON.parse(accountsStr);
    return Array.isArray(accounts) ? accounts : [];
  } catch (error) {
    console.error('Failed to parse reddit_accounts from localStorage', error);
    return [];
  }
}

export function setRedditAuth(token: string | null, id: string | null, refresh: string | null = null, expires_in: number | null = null, username: string | null = null) {
  accessToken = token;
  clientId = id;
  refreshToken = refresh;
  currentUsername = username;
  
  try {
    if (token) {
      localStorage.setItem('reddit_access_token', token);
    } else {
      localStorage.removeItem('reddit_access_token');
    }

    if (id) {
      localStorage.setItem('reddit_client_id', id);
    } else {
      localStorage.removeItem('reddit_client_id');
    }

    if (refresh) {
      localStorage.setItem('reddit_refresh_token', refresh);
    } else {
      localStorage.removeItem('reddit_refresh_token');
    }

    if (username) {
      localStorage.setItem('reddit_current_username', username);
    } else {
      localStorage.removeItem('reddit_current_username');
    }

    if (expires_in) {
      const expiresAt = Date.now() + (expires_in * 1000);
      tokenExpiresAt = expiresAt;
      localStorage.setItem('reddit_token_expires_at', expiresAt.toString());
    } else if (!token) {
      tokenExpiresAt = 0;
      localStorage.removeItem('reddit_token_expires_at');
    }

    // Update account list if we have a username
    if (token && id && username) {
      const accounts = getAccounts();
      const existingIdx = accounts.findIndex(a => a.username === username);
      const newAccount: RedditAccount = {
        username,
        accessToken: token,
        refreshToken: refresh,
        tokenExpiresAt: tokenExpiresAt,
        clientId: id
      };

      if (existingIdx >= 0) {
        accounts[existingIdx] = newAccount;
      } else {
        accounts.push(newAccount);
      }
      localStorage.setItem('reddit_accounts', JSON.stringify(accounts));
    }
  } catch (error) {
    console.error('Failed to save auth to localStorage', error);
  }
}

export function switchAccount(username: string) {
  const accounts = getAccounts();
  const account = accounts.find(a => a.username === username);
  if (account) {
    setRedditAuth(
      account.accessToken,
      account.clientId,
      account.refreshToken,
      Math.floor((account.tokenExpiresAt - Date.now()) / 1000),
      account.username
    );
    return true;
  }
  return false;
}

export function removeAccount(username: string) {
  const accounts = getAccounts().filter(a => a.username !== username);
  localStorage.setItem('reddit_accounts', JSON.stringify(accounts));
  if (currentUsername === username) {
    setRedditAuth(null, null);
  }
}

export async function ensureValidToken(): Promise<string | null> {
  if (!accessToken) return null;
  
  // Refresh if expiring in less than 5 minutes
  if (refreshToken && Date.now() > tokenExpiresAt - 300000) {
    try {
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRedditAuth(data.access_token, clientId, data.refresh_token || refreshToken, data.expires_in);
        return data.access_token;
      }
    } catch (error) {
      console.error('Failed to refresh token', error);
    }
  }
  
  return accessToken;
}

async function redditFetch(url: string, options: RequestInit = {}) {
  const token = await ensureValidToken();
  const headers = new Headers(options.headers || {});
  
  const isOAuth = url.includes('oauth.reddit.com');

  if (token && isOAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = { 
    ...options,
    // Only send headers if we are using OAuth to avoid CORS preflight on www.reddit.com
    headers: isOAuth ? headers : undefined 
  };

  try {
    const response = await fetch(url, fetchOptions);
    
    if (response.status === 401 && accessToken) {
      console.warn('Reddit API 401 Unauthorized - Token may be expired');
    }

    if (response.status === 429) {
      console.error('Reddit API 429 Too Many Requests - Rate limited');
    }

    return response;
  } catch (error) {
    console.error('Network error fetching from Reddit:', error);
    throw error;
  }
}

export async function fetchMySubreddits(): Promise<string[]> {
  if (!accessToken) return [];
  const url = 'https://oauth.reddit.com/subreddits/mine/subscriber.json?limit=100';
  
  try {
    const response = await redditFetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data?.data?.children) return [];
    return data.data.children.map((child: any) => child.data.display_name);
  } catch (error) {
    console.error('Failed to fetch subreddits', error);
    return [];
  }
}

export async function fetchMe(): Promise<any> {
  if (!accessToken) return null;
  const url = 'https://oauth.reddit.com/api/v1/me';
  const response = await redditFetch(url);
  if (!response.ok) return null;
  return await response.json();
}

export async function fetchSubreddit(subreddit: string = 'all', after?: string): Promise<{ posts: RedditPost[], after: string }> {
  const useOAuth = !!accessToken;
  const baseUrl = useOAuth ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  
  // If logged in and subreddit is 'home' or 'all', we might want the frontpage
  let path = `/r/${subreddit}`;
  if (subreddit === 'home' || subreddit === 'all') {
    if (subreddit === 'home') {
      path = useOAuth ? '/' : '/r/popular';
    } else {
      path = `/r/${subreddit}`;
    }
  }
  
  // Ensure path doesn't end with slash before adding .json
  const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  const url = `${baseUrl}${cleanPath}${cleanPath === '/' ? '' : '.json'}?limit=25&sr_detail=1${after ? `&after=${after}` : ''}`;
  // Special case for frontpage with oauth
  const finalUrl = useOAuth && cleanPath === '/' ? `${baseUrl}/.json?limit=25&sr_detail=1${after ? `&after=${after}` : ''}` : url;
  
  const response = await redditFetch(finalUrl);
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch subreddit: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  
  if (!data?.data?.children) {
    throw new Error('Invalid response format from Reddit');
  }

  return {
    posts: data.data.children.map((child: any) => child.data),
    after: data.data.after
  };
}

type CacheEntry = {
  data?: { post: RedditPost, comments: RedditComment[] };
  promise?: Promise<{ post: RedditPost, comments: RedditComment[] }>;
  timestamp: number;
};
const postDetailsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchPostDetails(permalink: string): Promise<{ post: RedditPost, comments: RedditComment[] }> {
  const now = Date.now();
  const cached = postDetailsCache.get(permalink);
  
  if (cached && now - cached.timestamp < CACHE_TTL) {
    if (cached.data) return cached.data;
    if (cached.promise) return cached.promise;
  }

  const baseUrl = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${baseUrl}${permalink}.json`;
  
  const fetchPromise = (async () => {
    try {
      const response = await redditFetch(url);
      if (!response.ok) throw new Error('Failed to fetch post details');
      const data = await response.json();
      
      const result = {
        post: data[0].data.children[0].data,
        comments: data[1].data.children.map((child: any) => child.data)
      };

      postDetailsCache.set(permalink, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      postDetailsCache.delete(permalink);
      throw error;
    }
  })();

  postDetailsCache.set(permalink, { promise: fetchPromise, timestamp: now });
  
  return fetchPromise;
}

export async function preloadPostDetails(permalink: string) {
  const now = Date.now();
  const cached = postDetailsCache.get(permalink);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return;
  }
  // Return the promise so we can await it, catch errors silently
  return fetchPostDetails(permalink).catch(() => {});
}

export async function searchSubreddits(query: string): Promise<string[]> {
  const baseUrl = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${baseUrl}/subreddits/search.json?q=${query}&limit=5`;
  
  const response = await redditFetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.data.children.map((child: any) => child.data.display_name);
}

export async function vote(id: string, dir: number): Promise<boolean> {
  if (!accessToken) return false;
  const url = 'https://oauth.reddit.com/api/vote';
  const response = await redditFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id, dir: dir.toString() })
  });
  return response.ok;
}

export async function submitComment(parentId: string, text: string): Promise<RedditComment | null> {
  if (!accessToken) return null;
  const url = 'https://oauth.reddit.com/api/comment';
  const response = await redditFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ thing_id: parentId, text })
  });
  
  if (!response.ok) return null;
  const data = await response.json();
  return data.json?.data?.things?.[0]?.data || null;
}

export async function fetchUserProfile(username: string): Promise<any> {
  const baseUrl = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${baseUrl}/user/${username}/about.json`;
  
  const response = await redditFetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

export async function fetchUserPosts(username: string, after?: string): Promise<{ posts: RedditPost[], after: string }> {
  const baseUrl = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${baseUrl}/user/${username}/submitted.json?limit=25${after ? `&after=${after}` : ''}`;
  
  const response = await redditFetch(url);
  if (!response.ok) throw new Error('Failed to fetch user posts');
  const data = await response.json();
  
  return {
    posts: data.data.children.map((child: any) => child.data),
    after: data.data.after
  };
}

export function getUserProfilePic(username: string): Promise<string | null> {
  try {
    return fetchUserProfile(username).then(profile => profile?.icon_img?.split('?')[0] || null);
  } catch {
    return Promise.resolve(null);
  }
}

export function getStreamableId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/streamable\.com\/([a-z0-9]+)/i);
  return match ? match[1] : null;
}

export function getTwitterId(url: string): { username: string; id: string } | null {
  if (!url) return null;
  const match = url.match(/(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i);
  return match ? { username: match[2], id: match[3] } : null;
}

export function getBlueskyId(url: string): { handle: string; id: string } | null {
  if (!url) return null;
  const match = url.match(/bsky\.app\/profile\/([a-zA-Z0-9.-]+)\/post\/([a-zA-Z0-9]+)/i);
  return match ? { handle: match[1], id: match[2] } : null;
}

export function getAuthUrl(clientId: string, redirectUri: string) {
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem('reddit_auth_state', state);
  
  const scope = 'read identity mysubreddits vote submit';
  // Use response_type=code and duration=permanent for long-lived sessions
  const url = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=${encodeURIComponent(scope)}`;
  
  return url;
}

export async function exchangeCodeForTokens(code: string, clientId: string, redirectUri: string) {
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}
