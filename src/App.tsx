/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import VideoPlayer from './components/VideoPlayer';
import UserProfile from './components/UserProfile';
import Inbox from './components/Inbox';
import { Ripple } from './components/Ripple';
import { RedditPost, fetchSubreddit, fetchSubredditInfo, setRedditAuth, getAuthUrl, fetchMySubreddits, getStreamableId, searchSubreddits, redditFetch } from './services/reddit';
import { Search, RefreshCw, Home, TrendingUp, Hash, Settings, X, Smartphone, Globe, LogIn, LogOut, Info, User, UserCircle, Trash2, ArrowLeft, Moon, ChevronDown, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import { SquigglyLoader } from './components/SquigglyLoader';
import { getGifUrl, getProxiedMediaUrl } from './lib/media';
import { decodeHtml } from './lib/decode';

export default function App() {
  const [view, setView] = useState<'feed' | 'settings' | 'profile' | 'browse' | 'inbox'>('feed');
  const [postSort, setPostSort] = useState('hot');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'system' | 'light' | 'dark') || 'system';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme !== 'system') {
      root.classList.add(theme);
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    }
  }, [theme]);
  const [subreddit, setSubreddit] = useState(localStorage.getItem('reddit_access_token') ? 'home' : 'all');
  const [subredditInfo, setSubredditInfo] = useState<any>(null);
  const [subredditHistory, setSubredditHistory] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [fullViewMediaPost, setFullViewMediaPost] = useState<RedditPost | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [redditClientId, setRedditClientId] = useState(localStorage.getItem('reddit_client_id') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('reddit_access_token'));
  const [currentUsername, setCurrentUsername] = useState(localStorage.getItem('reddit_current_username') || '');
  const [showSubreddits, setShowSubreddits] = useState(false);
  const [mySubreddits, setMySubreddits] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const isPopStateRef = useRef(false);
  const [filteredSubreddits, setFilteredSubreddits] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('reddit_filtered_subreddits') || '[]');
    } catch {
      return [];
    }
  });
  const [filteredUsers, setFilteredUsers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('reddit_filtered_users') || '[]');
    } catch {
      return [];
    }
  });
  const [showHeader, setShowHeader] = useState(true);
  const settingsScrollY = useRef(0);
  const observerTarget = useRef<HTMLDivElement>(null);
  const afterRef = useRef<string | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const feedContainerRef = useRef<HTMLElement>(null);

  // Scroll listener for hiding/showing header
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    let lastScrollY = container.scrollTop;
    let scrollDirection = 0; // 1 for down, -1 for up
    let scrollStart = lastScrollY;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      
      if (currentScrollY <= 100) {
        setShowHeader(true);
        lastScrollY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY;
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
      
      lastScrollY = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [view, selectedPost]);

  // Prevent browser context menu on elements with .no-callout
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.no-callout') || target.classList.contains('no-callout')) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Prevent body scroll when modals/drawers are open on mobile
  useEffect(() => {
    if (showSubreddits || selectedPost || fullViewMediaPost) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSubreddits, selectedPost, fullViewMediaPost]);

  // Material You / Mica Styling Simulation
  useEffect(() => {
    const root = document.documentElement;
    
    // Set theme color for mobile browser UI
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', 'var(--md-sys-color-surface)');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = 'var(--md-sys-color-surface)';
      document.head.appendChild(meta);
    }

    // Set accent color for Material You feel
    root.style.setProperty('accent-color', 'var(--md-sys-color-primary)');
  }, []);

  useEffect(() => {
    setGalleryIndex(0);
  }, [fullViewMediaPost]);

  useEffect(() => {
    const checkStandalone = () => {
      const inIframe = window.self !== window.top;
      setIsIframe(inIframe);
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      // If in iframe, we are not the standalone app even if the parent is
      setIsStandalone(isStandaloneMode && !inIframe);
    };
    checkStandalone();
    
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      const state = event.state;
      
      if (state) {
        if (state.view) setView(state.view);
        if (state.subreddit) setSubreddit(state.subreddit);
        if (state.postId === null) setSelectedPost(null);
        if (state.showSubreddits !== undefined) setShowSubreddits(state.showSubreddits);
        if (state.selectedUser === null) setSelectedUser(null);
        if (state.fullViewMediaPost === null) setFullViewMediaPost(null);
      } else {
        // Default state
        setView('feed');
        setSelectedPost(null);
        setShowSubreddits(false);
        setSelectedUser(null);
        setFullViewMediaPost(null);
      }
      
      // Reset the ref after the state updates have been processed
      setTimeout(() => {
        isPopStateRef.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);

    // Initial state
    if (!window.history.state) {
      window.history.replaceState({ 
        view: 'feed', 
        subreddit, 
        postId: null, 
        showSubreddits: false,
        selectedUser: null,
        fullViewMediaPost: null
      }, '');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Restore scroll position when returning to feed
  useEffect(() => {
    if (view === 'feed' && !selectedPost) {
      // Use a small timeout to ensure DOM has updated and framer-motion has finished layout
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          if (feedContainerRef.current) {
            feedContainerRef.current.scrollTo(0, scrollPositionRef.current);
          }
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view, selectedPost]);

  // Sync state changes to history
  useEffect(() => {
    if (isPopStateRef.current) return;

    const currentState = window.history.state;
    const newState = { 
      view, 
      subreddit, 
      postId: selectedPost?.id || null, 
      showSubreddits,
      selectedUser,
      fullViewMediaPost: fullViewMediaPost?.id || null
    };

    // Check if we should push a new state
    const hasChanged = !currentState || 
      currentState.view !== newState.view || 
      currentState.subreddit !== newState.subreddit || 
      currentState.postId !== newState.postId || 
      currentState.showSubreddits !== newState.showSubreddits ||
      currentState.selectedUser !== newState.selectedUser ||
      currentState.fullViewMediaPost !== newState.fullViewMediaPost;

    if (hasChanged) {
      window.history.pushState(newState, '');
    }
  }, [view, subreddit, selectedPost, showSubreddits, selectedUser, fullViewMediaPost]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    localStorage.setItem('reddit_filtered_subreddits', JSON.stringify(filteredSubreddits));
  }, [filteredSubreddits]);

  useEffect(() => {
    localStorage.setItem('reddit_filtered_users', JSON.stringify(filteredUsers));
  }, [filteredUsers]);

  const loadPosts = useCallback(async (sub: string, sort: string, append = false) => {
  if (!append) {
    setLoading(true);
    setPosts([]);
    scrollPositionRef.current = 0;
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTop = 0;
    }
    afterRef.current = null;
    // Only fetch subreddit info on fresh loads, not on appends
    if (sub !== 'home' && sub !== 'all' && sub !== 'popular') {
      fetchSubredditInfo(sub).then(setSubredditInfo);
    } else {
      setSubredditInfo(null);
    }
  }
  try {
    const { posts: newPosts, after: newAfter } = await fetchSubreddit(
      sub,
      append ? afterRef.current ?? undefined : undefined,
      sort
    );
    afterRef.current = newAfter;
    setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
  } catch (error) {
    console.error('Failed to load posts', error);
  } finally {
    setLoading(false);
    setIsRefreshing(false);
  }
}, []);

  const loadMySubreddits = useCallback(async () => {
    if (isLoggedIn) {
      const subs = await fetchMySubreddits();
      setMySubreddits(subs);
    } else {
      setMySubreddits([]);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadPosts(subreddit, postSort);
  }, [subreddit, postSort, loadPosts]);

  // Infinite Scroll Observer
  
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && afterRef.current && !loading && view === 'feed') {
        loadPosts(subreddit, postSort, true);
      }
    },
    { threshold: 0.1, rootMargin: '200px' }
  );
  if (observerTarget.current) observer.observe(observerTarget.current);
  return () => observer.disconnect();
}, [loading, subreddit, postSort, loadPosts, view]); // removed `after` dep


  useEffect(() => {
    loadMySubreddits();
  }, [loadMySubreddits]);

  useEffect(() => {
  const delayDebounceFn = setTimeout(async () => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
      try {
        // Use the already-imported searchSubreddits (static import at top of file)
        const results = await searchSubreddits(searchQuery);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search failed', error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, 500);
  return () => clearTimeout(delayDebounceFn);
}, [searchQuery]);


  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPosts(subreddit, postSort);
  };

  useEffect(() => {
    import('./services/reddit').then(m => {
      setAccounts(m.getAccounts());
    }).catch(err => {
      console.error('Failed to load accounts', err);
    });
  }, [isLoggedIn, showSettings]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    // Validate origin is from AI Studio preview or localhost
    const origin = event.origin;
    if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
      return;
    }
    
    if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
      const { hash, search } = event.data;
      const { setRedditAuth, fetchMe, exchangeCodeForTokens } = await import('./services/reddit');
      
      let tokenData: any = null;

      // Handle Implicit Grant (hash) - fallback
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const state = params.get('state');
        const savedState = localStorage.getItem('reddit_auth_state');

        if (token && state === savedState) {
          tokenData = {
            access_token: token,
            expires_in: params.get('expires_in') ? parseInt(params.get('expires_in')!) : null,
            refresh_token: null
          };
        }
      } 
      // Handle Authorization Code (search) - preferred for long-lived sessions
      else if (search) {
        const params = new URLSearchParams(search);
        const code = params.get('code');
        const state = params.get('state');
        const savedState = localStorage.getItem('reddit_auth_state');

        if (code && state === savedState) {
          const redirectUri = `${window.location.origin}/auth/callback`;
          try {
            tokenData = await exchangeCodeForTokens(code, redditClientId, redirectUri);
          } catch (error) {
            console.error('Failed to exchange code', error);
            alert('Failed to login with Reddit. Please try again.');
          }
        }
      }

      if (tokenData) {
        // Temporarily set auth to fetch profile
        setRedditAuth(tokenData.access_token, redditClientId, tokenData.refresh_token, tokenData.expires_in);
        const profile = await fetchMe();
        if (profile) {
          setRedditAuth(tokenData.access_token, redditClientId, tokenData.refresh_token, tokenData.expires_in, profile.name);
          setIsLoggedIn(true);
          setCurrentUsername(profile.name);
          setSubreddit('home');
          loadPosts('home', postSort);
          setShowSettings(false);
          const { getAccounts } = await import('./services/reddit');
          setAccounts(getAccounts());
        } else {
          alert('Failed to fetch Reddit profile. Please try again.');
        }
      }
    }
  }, [redditClientId, loadPosts, postSort]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleRedditLogin = () => {
    if (!redditClientId) {
      alert('Please enter your Reddit Client ID first in Settings.');
      setShowSettings(true);
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    const authUrl = getAuthUrl(redditClientId, redirectUri);
    
    const authWindow = window.open(
      authUrl,
      'oauth_popup',
      'width=600,height=700'
    );

    if (!authWindow) {
      alert('Please allow popups for this site to connect your account.');
    }
  };

  const handleFilterSubreddit = (sub: string) => {
    setFilteredSubreddits(prev => [...new Set([...prev, sub.toLowerCase()])]);
  };

  const handleFilterUser = (user: string) => {
    setFilteredUsers(prev => [...new Set([...prev, user.toLowerCase()])]);
  };

  const visiblePosts = useMemo(
  () =>
    posts.filter(
      post =>
        !filteredSubreddits.includes(post.subreddit.toLowerCase()) &&
        !filteredUsers.includes(post.author.toLowerCase())
    ),
  [posts, filteredSubreddits, filteredUsers]
);

  const handleRedditLogout = async () => {
    const { setRedditAuth } = await import('./services/reddit');
    setRedditAuth(null, null);
    setIsLoggedIn(false);
    setCurrentUsername('');
    setSubreddit('all');
    loadPosts('all', postSort);
    setShowSettings(false);
  };

  const handleSwitchAccount = async (username: string) => {
    const { switchAccount } = await import('./services/reddit');
    if (switchAccount(username)) {
      setIsLoggedIn(true);
      setCurrentUsername(username);
      setSubreddit('home');
      loadPosts('home', postSort);
      setShowSettings(false);
    }
  };

  const handleRemoveAccount = async (username: string) => {
    const { removeAccount, getAccounts } = await import('./services/reddit');
    removeAccount(username);
    setAccounts(getAccounts());
    if (currentUsername === username) {
      setIsLoggedIn(false);
      setCurrentUsername('');
      setSubreddit('all');
      loadPosts('all', postSort);
    }
  };

  const handleMediaClick = (post: RedditPost, index?: number) => {
    const isGallery = post.is_gallery && post.gallery_data?.items && post.media_metadata;
    const isVideo = post.is_video && post.media?.reddit_video;
    const isImage = post.post_hint === 'image' || post.url?.match(/\.(jpg|jpeg|png|gif)$/i);
    const streamableId = getStreamableId(post.url);
    const isGif = getGifUrl(post) !== null;
    
    if (!isGallery && !isVideo && !isImage && !streamableId && !isGif) {
      window.open(post.url, '_blank');
      return;
    }
    
    setFullViewMediaPost(post);
    if (index !== undefined) setGalleryIndex(index);
  };

  const closeMediaView = () => {
    if (window.history.state?.fullViewMediaPost) {
      window.history.back();
    } else {
      setFullViewMediaPost(null);
    }
  };

  const closePostDetail = () => {
    if (window.history.state?.postId) {
      window.history.back();
    } else {
      setSelectedPost(null);
    }
  };

  const closeSubreddits = () => {
    if (window.history.state?.showSubreddits) {
      window.history.back();
    } else {
      setShowSubreddits(false);
    }
  };

  const closeView = () => {
    if (window.history.state?.view && window.history.state.view !== 'feed') {
      window.history.back();
    } else {
      setView('feed');
    }
  };

  const handleSubredditChange = (newSub: string) => {
    if (newSub === subreddit && view !== 'feed') {
      // Just return to feed without reloading
      setView('feed');
      setShowSubreddits(false);
      return;
    }
    
    if (newSub === subreddit && view === 'feed') {
      // Refresh current feed
      scrollPositionRef.current = 0;
      feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      handleRefresh();
      setShowSubreddits(false);
      return;
    }
    
    if (newSub !== subreddit) {
      setSubredditHistory(prev => [...prev, subreddit]);
      setSubreddit(newSub);
      setView('feed');
      afterRef.current = null;
      setPosts([]);
      setShowSubreddits(false);
      scrollPositionRef.current = 0;
      feedContainerRef.current?.scrollTo(0, 0);
    }
  };

  const handleBack = useCallback(() => {
    if (selectedPost) {
      setSelectedPost(null);
    } else if (fullViewMediaPost) {
      setFullViewMediaPost(null);
    } else if (view === 'profile') {
      setView('feed');
      setSelectedUser(null);
    } else if (view === 'settings' || view === 'browse') {
      setView('feed');
    } else if (subredditHistory.length > 0) {
      const prevSub = subredditHistory[subredditHistory.length - 1];
      setSubredditHistory(prev => prev.slice(0, -1));
      setSubreddit(prevSub);
      afterRef.current = null;
      setPosts([]);
      scrollPositionRef.current = 0;
      feedContainerRef.current?.scrollTo(0, 0);
    }
  }, [selectedPost, fullViewMediaPost, subredditHistory, subreddit, view]);

  const handleVote = async (id: string, dir: number) => {
    if (!isLoggedIn) {
      alert('Please login to vote.');
      return false;
    }
    const { vote } = await import('./services/reddit');
    return await vote(id, dir);
  };

  const handleComment = async (parentId: string, text: string) => {
    if (!isLoggedIn) {
      alert('Please login to reply.');
      return null;
    }
    const { submitComment } = await import('./services/reddit');
    return await submitComment(parentId, text);
  };
const handlePostClick = useCallback((post: RedditPost) => {
  scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
  setSelectedPost(post);
}, []);

const handleUserClick = useCallback((user: string) => {
  scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
  setSelectedUser(user);
  setView('profile');
}, []);

const handleRedditLinkClick = useCallback((url: string) => {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const path = parsedUrl.pathname;

    // Handle /r/subreddit
    const subredditMatch = path.match(/^\/r\/([^/]+)\/?$/);
    if (subredditMatch) {
      handleSubredditChange(subredditMatch[1]);
      return;
    }

    // Handle /u/user or /user/user
    const userMatch = path.match(/^\/(?:u|user)\/([^/]+)\/?$/);
    if (userMatch) {
      handleUserClick(userMatch[1]);
      return;
    }

    // Handle /r/subreddit/comments/id/title
    const postMatch = path.match(/^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/?$/);
    // Handle /r/subreddit/comments/id/title/commentId
    const commentMatch = path.match(/^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/([^/]+)\/?$/);
    // Handle shortlinks like /r/DotA2/s/qidd5d2hMU
    const shortMatch = path.match(/^\/r\/([^/]+)\/s\/([^/]+)\/?$/);
    // Handle redd.it shortlinks and reddit.com/id shortlinks
    const isReddIt = parsedUrl.hostname === 'redd.it';
    const isRedditComShort = (parsedUrl.hostname === 'reddit.com' || parsedUrl.hostname === 'www.reddit.com') && path.match(/^\/[a-zA-Z0-9]+\/?$/);

    if (postMatch || commentMatch || shortMatch || isReddIt || isRedditComShort) {
      const fetchPost = async () => {
        try {
          let fetchUrl = '';
          if (isReddIt || isRedditComShort) {
            const id = path.replace(/\//g, '');
            fetchUrl = `https://www.reddit.com/api/info.json?id=t3_${id}`;
          } else {
            const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
            fetchUrl = `https://www.reddit.com${cleanPath}.json`;
          }
          const response = await redditFetch(fetchUrl);
          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            // If JSON parsing fails, it might be because the shortlink redirected to an HTML page.
            // Check if the final URL is different and looks like a post URL.
            if (response.url && response.url !== fetchUrl) {
              const finalUrl = new URL(response.url);
              if (
                finalUrl.pathname.match(/^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/?$/) ||
                finalUrl.pathname.match(/^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/([^/]+)\/?$/)
              ) {
                // Recursively handle the resolved URL
                handleRedditLinkClick(response.url);
                return;
              }
            }
            throw jsonError;
          }
          
          // /api/info returns { data: { children: [...] } }
          // regular post returns [{ data: { children: [...] } }, ...]
          const children = (isReddIt || isRedditComShort)
            ? data?.data?.children 
            : data?.[0]?.data?.children;

          if (children && children[0]) {
            const postData = children[0].data;
            handlePostClick(postData);
          } else {
            window.open(url, '_blank');
          }
        } catch (e) {
          console.error("Failed to fetch post from link", e);
          window.open(url, '_blank');
        }
      };
      fetchPost();
      return;
    }

    // Fallback for other reddit links
    window.open(url, '_blank');
  } catch (e) {
    console.error("Invalid URL", e);
    window.open(url, '_blank');
  }
}, [handleSubredditChange, handleUserClick, handlePostClick]);

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] bg-bg-primary text-text-primary pb-20 md:pb-0 overflow-hidden">
        <div className="flex h-[100dvh] w-full max-w-7xl mx-auto">
          {/* Desktop Navigation Rail */}
      <div className="hidden md:block h-full">
        <Sidebar 
          currentSubreddit={subreddit} 
          onSubredditChange={handleSubredditChange} 
          onSettingsClick={() => {
            if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
            setView('settings');
          }}
          onInboxClick={() => {
            if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
            setView('inbox');
          }}
          isLoggedIn={isLoggedIn}
          onLoginClick={handleRedditLogin}
          onLogoutClick={handleRedditLogout}
          mySubreddits={mySubreddits}
          redditClientId={redditClientId}
          currentUsername={currentUsername}
          currentView={view}
        />
      </div>

      <div className="flex-1 relative h-full w-full min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* Feed View */}
          {view === 'feed' && !selectedPost && (
            <motion.main 
              key="feed"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ 
                duration: 0.5, 
                ease: [0.2, 0, 0, 1], // M3 Emphasized
                opacity: { duration: 0.3, ease: "linear" }
              }}
              className="absolute inset-0 flex flex-col w-full h-full overflow-y-auto"
              ref={(node) => {
                feedContainerRef.current = node;
                if (node && scrollPositionRef.current > 0) {
                  // Restore scroll position when mounting
                  node.scrollTop = scrollPositionRef.current;
                }
              }}
            >
            {/* Top App Bar */}
            <motion.header 
              initial={false}
              animate={{ y: showHeader ? 0 : -80 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-md px-4 flex items-center justify-between h-16 md:h-20 md:px-8 shrink-0"
            >
              <AnimatePresence mode="popLayout">
                {isSearchExpanded ? (
                  <motion.div 
                    key="search-expanded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "linear" }}
                    className="flex-1 flex items-center gap-2"
                  >
                    <button 
                      onClick={() => {
                        setIsSearchExpanded(false);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                      className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
                    >
                      <ArrowLeft size={24} />
                      <Ripple />
                    </button>
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Search subreddits..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSubredditChange(searchQuery.replace('r/', ''));
                            setShowSearchResults(false);
                            setIsSearchExpanded(false);
                          }
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-bg-secondary text-text-primary rounded-full text-base focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                      
                      <AnimatePresence>
                        {showSearchResults && searchResults.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute top-full left-0 right-0 mt-3 bg-bg-secondary rounded-3xl z-50 overflow-hidden"
                          >
                            {searchResults.map((sr) => (
                              <button
                                key={sr}
                                onClick={() => {
                                  handleSubredditChange(sr);
                                  setSearchQuery('');
                                  setShowSearchResults(false);
                                  setIsSearchExpanded(false);
                                }}
                                className="relative w-full px-5 py-3.5 text-left text-base text-text-primary hover:bg-hover-bg transition-colors flex items-center gap-3 overflow-hidden"
                              >
                                <Hash size={18} className="text-text-secondary" />
                                <span>r/{sr}</span>
                                <Ripple />
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="header-normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "linear" }}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                        {subreddit === 'home' ? (
                          <Home size={20} className="text-on-primary" />
                        ) : subreddit === 'popular' ? (
                          <TrendingUp size={20} className="text-on-primary" />
                        ) : subreddit === 'all' ? (
                          <Globe size={20} className="text-on-primary" />
                        ) : subredditInfo && (subredditInfo.icon_img || subredditInfo.community_icon) ? (
                          <img 
                            src={(subredditInfo.icon_img || subredditInfo.community_icon).split('?')[0]} 
                            alt="" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-display font-bold text-on-primary">
                            {subreddit.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <h1 className="text-xl md:text-2xl font-display font-medium tracking-tight truncate max-w-[150px] md:max-w-none text-text-primary">
                        {subreddit === 'home' ? 'Home' : subreddit === 'popular' ? 'Popular' : subreddit === 'all' ? 'All' : `r/${subreddit}`}
                      </h1>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                      <button 
                        onClick={() => setIsSearchExpanded(true)}
                        className="relative sm:hidden p-2.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
                      >
                        <Search size={24} />
                        <Ripple />
                      </button>

                      {!isLoggedIn && (
                        <button 
                          onClick={handleRedditLogin}
                          className="relative sm:hidden p-2.5 text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden"
                        >
                          <LogIn size={24} />
                          <Ripple />
                        </button>
                      )}
                      {!isLoggedIn && (
                        <button 
                          onClick={handleRedditLogin}
                          className="relative hidden sm:flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-full hover:opacity-90 transition-all active:scale-95 overflow-hidden"
                        >
                          <LogIn size={18} />
                          <span>Login</span>
                          <Ripple />
                        </button>
                      )}
                      <div className="relative hidden sm:block">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                        <input 
                          type="text" 
                          placeholder="Search subreddits..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSubredditChange(searchQuery.replace('r/', ''));
                              setShowSearchResults(false);
                            }
                          }}
                          className="pl-11 pr-5 py-2.5 bg-bg-secondary text-text-primary rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all w-56 lg:w-72 focus:bg-bg-tertiary"
                        />
                        
                        <AnimatePresence>
                          {showSearchResults && searchResults.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                              className="absolute top-full left-0 right-0 mt-3 bg-bg-tertiary rounded-3xl z-50 overflow-hidden"
                            >
                              {searchResults.map((sr) => (
                                <button
                                  key={sr}
                                  onClick={() => {
                                    handleSubredditChange(sr);
                                    setSearchQuery('');
                                    setShowSearchResults(false);
                                  }}
                                  className="relative w-full px-5 py-3 text-left text-sm text-text-primary hover:bg-hover-bg transition-colors flex items-center gap-3 overflow-hidden"
                                >
                                  <Hash size={16} className="text-text-secondary" />
                                  <span>r/{sr}</span>
                                  <Ripple />
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative group">
                          <select
                            value={postSort}
                            onChange={(e) => setPostSort(e.target.value)}
                            className="bg-primary/10 text-primary font-bold text-sm rounded-full pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer transition-colors hover:bg-primary/20"
                          >
                            <option value="hot">Hot</option>
                            <option value="new">New</option>
                            <option value="top">Top</option>
                            <option value="rising">Rising</option>
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none transition-transform group-hover:translate-y-[-40%]" />
                        </div>
                        <button 
                          onClick={handleRefresh}
                          className={`relative p-2.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all touch-manipulation active:scale-90 overflow-hidden ${isRefreshing ? 'animate-spin text-primary' : ''}`}
                        >
                          <RefreshCw size={24} />
                          <Ripple />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.header>

            {/* Feed */}
            <div className="-mt-16 md:-mt-20 pt-16 md:pt-20">
              <div className="p-2 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-3 md:gap-6">
              {!isLoggedIn && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-primary-container text-on-primary-container rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 m-4 md:m-0"
                >
                  {!redditClientId ? (
                    <>
                      <div className="flex flex-col gap-1 text-center sm:text-left">
                        <h3 className="font-display font-bold text-xl">Setup Reddit API</h3>
                        <p className="text-sm opacity-80">Enter your Client ID in Settings to enable account features.</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
                          setView('settings');
                        }}
                        className="relative px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold hover:opacity-90 transition-all active:scale-95 shrink-0 overflow-hidden"
                      >
                        Open Settings
                        <Ripple />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1 text-center sm:text-left">
                        <h3 className="font-display font-bold text-xl">Connect your Reddit account</h3>
                        <p className="text-sm opacity-80">Login to see your personal frontpage and subreddits.</p>
                      </div>
                      <button 
                        onClick={handleRedditLogin}
                        className="relative px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold hover:opacity-90 transition-all active:scale-95 shrink-0 overflow-hidden"
                      >
                        Login Now
                        <Ripple />
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {loading && posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-text-secondary">
                  <SquigglyLoader size={32} className="text-primary" />
                </div>
              ) : (
                <>
                  {subredditInfo && (
                    <div className="p-6 md:p-8 flex flex-col gap-6 bg-bg-secondary mb-2">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg-tertiary overflow-hidden shrink-0">
                          {subredditInfo.icon_img || subredditInfo.community_icon ? (
                            <img 
                              src={(subredditInfo.icon_img || subredditInfo.community_icon).split('?')[0]} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-display font-bold text-text-secondary">
                              {subreddit.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <h1 className="text-2xl md:text-3xl font-display font-bold text-text-primary tracking-tight">r/{subreddit}</h1>
                          <div className="text-sm font-medium mt-1 text-text-secondary">
                            {subredditInfo.subscribers?.toLocaleString()} members
                          </div>
                        </div>
                      </div>
                      {subredditInfo.public_description && (
                        <div className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">
                          {decodeHtml(subredditInfo.public_description)}
                        </div>
                      )}
                    </div>
                  )}
                  {visiblePosts.map((post, idx) => (
  <PostCard 
    key={`${post.id}-${idx}`} 
    post={post} 
    hideSubredditInfo={subreddit !== 'home' && subreddit !== 'all' && subreddit !== 'popular'}
    onClick={handlePostClick}
    onVote={handleVote}
    onSubredditClick={handleSubredditChange}
    onUserClick={handleUserClick}
    onMediaClick={handleMediaClick}
    onFilterSubreddit={handleFilterSubreddit}
    onFilterUser={handleFilterUser}
    onRedditLinkClick={handleRedditLinkClick}
  />
))}
                  
                  {/* Infinite Scroll Target */}
                  <div ref={observerTarget} className="h-20 flex items-center justify-center">
                    {loading && <SquigglyLoader size={24} className="text-text-secondary" />}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.main>
      )}

      {/* Browse View */}
      {view === 'browse' && !selectedPost && (
        <motion.main 
          key="browse"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 1
          }}
          className="fixed inset-0 bg-bg-primary z-40 overflow-y-auto overscroll-y-none"
        >
          <header className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-md px-4 pt-4 pb-2 safe-top">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('feed')}
                className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-colors active:scale-95 overflow-hidden"
              >
                <ArrowLeft size={24} />
                <Ripple />
              </button>
            </div>
            <h1 className="text-4xl font-display font-bold text-text-primary mt-2 px-2 tracking-tight">Browse</h1>
          </header>

          <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-8 pb-24">
            <section>
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 px-2">Feeds</h2>
              <div className="flex flex-col gap-2">
                {isLoggedIn && (
                  <button 
                    onClick={() => { handleSubredditChange('home'); setView('feed'); }}
                    className="relative w-full flex items-center gap-4 px-6 py-4 bg-primary/10 text-primary rounded-3xl hover:bg-primary/20 transition-colors overflow-hidden"
                  >
                    <Home size={24} />
                    <span className="font-display font-bold text-lg">Home</span>
                    <Ripple />
                  </button>
                )}
                <button 
                  onClick={() => { handleSubredditChange('popular'); setView('feed'); }}
                  className="relative w-full flex items-center gap-4 px-6 py-4 bg-primary/10 text-primary rounded-3xl hover:bg-primary/20 transition-colors overflow-hidden"
                >
                  <TrendingUp size={24} />
                  <span className="font-display font-bold text-lg">Popular</span>
                  <Ripple />
                </button>
                <button 
                  onClick={() => { handleSubredditChange('all'); setView('feed'); }}
                  className="relative w-full flex items-center gap-4 px-6 py-4 bg-primary/10 text-primary rounded-3xl hover:bg-primary/20 transition-colors overflow-hidden"
                >
                  <Globe size={24} />
                  <span className="font-display font-bold text-lg">All</span>
                  <Ripple />
                </button>
              </div>
            </section>

            {mySubreddits.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 px-2">Your Subreddits</h2>
                <div className="flex flex-col gap-2">
                  {mySubreddits.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => { handleSubredditChange(sub); setView('feed'); }}
                      className="relative w-full flex items-center gap-4 px-6 py-4 bg-bg-secondary text-text-primary rounded-3xl hover:bg-hover-bg transition-colors overflow-hidden"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Hash size={20} className="text-primary" />
                      </div>
                      <span className="font-display font-bold text-lg">r/{sub}</span>
                      <Ripple />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </motion.main>
      )}

        {/* Settings View */}
        {view === 'settings' && !selectedPost && (
          <motion.main 
            key="settings"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.2, 0, 0, 1], // M3 Emphasized
              opacity: { duration: 0.3, ease: "linear" }
            }}
            className="absolute inset-0 flex flex-col w-full h-full bg-bg-primary overflow-y-auto"
            onScroll={(e) => {
              const currentScrollY = e.currentTarget.scrollTop;
              if (currentScrollY <= 100) {
                setShowHeader(true);
                settingsScrollY.current = currentScrollY;
                return;
              }
              const diff = currentScrollY - settingsScrollY.current;
              if (diff > 20) {
                setShowHeader(false);
                settingsScrollY.current = currentScrollY;
              } else if (diff < -20) {
                setShowHeader(true);
                settingsScrollY.current = currentScrollY;
              }
            }}
          >
            <motion.header 
              initial={false}
              animate={{ y: showHeader ? 0 : -64 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-md px-4 h-16 md:px-8 flex items-center justify-between shrink-0"
            >
              <div className="flex items-center gap-4">
                <button onClick={closeView} className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden">
                  <ArrowLeft size={24} />
                  <Ripple />
                </button>
                <h1 className="text-2xl font-display font-medium text-text-primary">Settings</h1>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsRefreshing(true);
                    setTimeout(() => setIsRefreshing(false), 500);
                  }}
                  className={`relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all touch-manipulation active:scale-90 overflow-hidden ${isRefreshing ? 'animate-spin text-primary' : ''}`}
                >
                  <RefreshCw size={24} />
                  <Ripple />
                </button>
              </div>
            </motion.header>
            <div className="-mt-16 pt-16">
              <div className="p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col gap-8">
              {/* Appearance Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-text-primary px-2">
                  <Moon size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg">Appearance</h3>
                </div>
                <div className="flex flex-col gap-3 p-5 bg-bg-secondary rounded-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-base font-bold text-text-primary">Theme</label>
                      <p className="text-sm text-text-secondary mt-0.5">Choose your preferred theme</p>
                    </div>
                    <select 
                      className="bg-bg-primary rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* API Configuration Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-text-primary px-2">
                  <Hash size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg">API Configuration</h3>
                </div>
                <div className="flex flex-col gap-3 p-5 bg-bg-secondary rounded-3xl">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Reddit Client ID</label>
                    <input 
                      type="text" 
                      value={redditClientId}
                      onChange={(e) => {
                        setRedditClientId(e.target.value);
                        localStorage.setItem('reddit_client_id', e.target.value);
                      }}
                      placeholder="Enter Reddit Client ID"
                      className="bg-bg-primary rounded-xl px-4 py-3 text-base text-text-primary outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      Create an app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">reddit.com/prefs/apps</a> (Type: installed app).<br/>
                      Set redirect uri to: <br/>
                      <code className="bg-bg-primary px-2 py-1 rounded-md mt-1.5 inline-block select-all font-mono text-xs">{window.location.origin}/auth/callback</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Reddit Account Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-text-primary px-2">
                  <UserCircle size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg">Reddit Accounts</h3>
                </div>
                <div className="flex flex-col gap-3 p-5 bg-bg-secondary rounded-3xl">
                  {accounts.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {accounts.map(acc => (
                        <div key={acc.username} className="flex items-center justify-between p-3 bg-bg-primary rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${acc.username === currentUsername ? 'bg-green-500' : 'bg-bg-tertiary'}`} />
                            <div className="flex flex-col">
                              <span className="text-base font-bold text-text-primary">{acc.username}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {acc.username !== currentUsername && (
                              <button 
                                onClick={() => handleSwitchAccount(acc.username)}
                                className="relative text-sm text-primary hover:bg-primary/10 px-3 py-1.5 rounded-full font-bold transition-colors overflow-hidden"
                              >
                                Switch
                                <Ripple />
                              </button>
                            )}
                            <button 
                              onClick={() => handleRemoveAccount(acc.username)}
                              className="relative p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors overflow-hidden"
                            >
                              <Trash2 size={18} />
                              <Ripple />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={handleRedditLogin}
                        className="relative flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary hover:opacity-90 rounded-full text-sm font-bold mt-2 transition-all active:scale-95 overflow-hidden"
                      >
                        <LogIn size={18} /> Add Another Account
                        <Ripple />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-base text-text-primary font-bold">Status</span>
                        <span className="text-xs px-3 py-1 bg-bg-tertiary text-text-secondary rounded-full font-bold uppercase tracking-wider">Disconnected</span>
                      </div>
                      <button 
                        onClick={handleRedditLogin}
                        className="relative flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary hover:opacity-90 rounded-full text-sm font-bold transition-all active:scale-95 overflow-hidden"
                      >
                        <LogIn size={18} /> Login with Reddit
                        <Ripple />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* App Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-text-primary px-2">
                  <Smartphone size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg">App</h3>
                </div>
                <div className="flex flex-col gap-3 p-5 bg-bg-secondary rounded-3xl">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-base text-text-primary font-bold">Install Minute</span>
                      <span className="text-xs text-text-secondary max-w-[200px] leading-relaxed">
                        {isIframe 
                          ? 'Open in a new tab to install as a PWA'
                          : isStandalone 
                            ? 'Running in standalone mode' 
                            : isInstallable 
                              ? 'Add to your home screen for a better experience' 
                              : 'Waiting for browser to enable installation...'}
                      </span>
                    </div>
                    <button 
                      disabled={!isInstallable || isStandalone || isIframe}
                      onClick={handleInstallClick}
                      className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 overflow-hidden ${isInstallable && !isStandalone && !isIframe ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-bg-tertiary text-text-secondary cursor-not-allowed'}`}
                    >
                      {isStandalone ? 'Installed' : isInstallable ? 'Install' : isIframe ? 'Unavailable' : 'Checking...'}
                      <Ripple />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-4 mt-2">
                    <span className="text-sm text-text-primary font-bold">Version</span>
                    <span className="text-sm font-mono text-text-secondary bg-bg-primary px-2 py-1 rounded-md">1.0.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.main>
      )}

        {/* Profile View */}
        {view === 'profile' && selectedUser && !selectedPost && (
          <motion.main 
            key="profile"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.2, 0, 0, 1], // M3 Emphasized
              opacity: { duration: 0.3, ease: "linear" }
            }}
            className="absolute inset-0 flex flex-col w-full h-full overflow-y-auto"
          >
            <UserProfile 
              username={selectedUser} 
              onClose={closeView} 
              onPostClick={setSelectedPost}
              onVote={handleVote}
              onSubredditClick={handleSubredditChange}
              onMediaClick={handleMediaClick}
              onRedditLinkClick={handleRedditLinkClick}
            />
          </motion.main>
        )}

        {/* Post Detail View */}
        {selectedPost && (
          <motion.main 
            key="post-detail"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.2, 0, 0, 1], // M3 Emphasized
              opacity: { duration: 0.3, ease: "linear" }
            }}
            className="absolute inset-0 flex flex-col w-full h-full bg-bg-primary overflow-hidden"
          >
            <PostDetail 
              post={selectedPost} 
              onClose={closePostDetail} 
              onVote={handleVote}
              onComment={handleComment}
              onSubredditClick={(sr) => {
                handleSubredditChange(sr);
                closePostDetail();
              }}
              onUserClick={(user) => {
                setSelectedUser(user);
                setView('profile');
                closePostDetail();
              }}
              onFilterSubreddit={handleFilterSubreddit}
              onFilterUser={handleFilterUser}
              onMediaClick={handleMediaClick}
              onRedditLinkClick={handleRedditLinkClick}
            />
          </motion.main>
        )}

        {view === 'inbox' && !selectedPost && (
          <Inbox 
            onClose={closeView}
            onUserClick={handleUserClick}
            onRedditLinkClick={handleRedditLinkClick}
          />
        )}
      </AnimatePresence>
      </div>
      </div>

      {/* Mobile Navigation Bar */}
      <AnimatePresence>
        {!selectedPost && !fullViewMediaPost && view !== 'profile' && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-primary/95 backdrop-blur-md px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around z-50 transform translate-z-0"
          >
            <MobileNavItem icon={<Home size={20} />} label="Home" active={subreddit === 'home' && view === 'feed'} onClick={() => handleSubredditChange('home')} />
            <MobileNavItem icon={<Globe size={20} />} label="Browse" active={view === 'browse'} onClick={() => {
              if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
              setView('browse');
            }} />
            {isLoggedIn && (
              <MobileNavItem icon={<Mail size={20} />} label="Inbox" active={view === 'inbox'} onClick={() => {
                if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
                setView('inbox');
              }} />
            )}
            <MobileNavItem icon={<Settings size={20} />} label="Settings" active={view === 'settings'} onClick={() => {
              if (view === 'feed') scrollPositionRef.current = feedContainerRef.current?.scrollTop || 0;
              setView('settings');
            }} />
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Mobile Subreddits Drawer */}
      <AnimatePresence>
        {showSubreddits && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "linear" }}
              onClick={closeSubreddits}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ 
                duration: 0.5,
                ease: [0.2, 0, 0, 1], // M3 Emphasized easing
                opacity: { duration: 0.3, ease: "linear" }
              }}
              className="fixed bottom-0 left-0 right-0 max-h-[70vh] bg-bg-secondary rounded-t-3xl z-[90] overflow-hidden flex flex-col"
            >
              <header className="p-5 flex items-center justify-between sticky top-0 bg-bg-secondary z-10">
                <h2 className="font-display font-bold text-xl text-text-primary">Subreddits</h2>
                <button onClick={closeSubreddits} className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-all active:scale-90 overflow-hidden">
                  <X size={24} />
                  <Ripple />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 pb-24">
                {(isLoggedIn && mySubreddits.length > 0 ? mySubreddits : ['all', 'popular', 'gaming', 'technology', 'worldnews', 'science', 'movies']).map(sub => (
                  <button
                    key={sub}
                    onClick={() => handleSubredditChange(sub)}
                    className={`relative flex items-center gap-4 px-5 py-3.5 rounded-full text-base font-medium transition-colors overflow-hidden ${
                      subreddit === sub ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary active:bg-bg-tertiary'
                    }`}
                  >
                    <Hash size={20} className={subreddit === sub ? 'text-on-secondary-container' : 'text-text-secondary'} />
                    <span className="capitalize">{sub}</span>
                    <Ripple />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal - Removed as it's now a view */}

      {/* Post Detail Drawer */}
      {/* Persistent Media View Modal */}
      <AnimatePresence>
        {fullViewMediaPost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "linear" }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md"
            onClick={closeMediaView}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
                <a 
                  href={fullViewMediaPost.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="relative p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all flex items-center gap-2 px-5 text-sm font-bold backdrop-blur-md active:scale-95 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe size={20} />
                  Open Link
                  <Ripple />
                </a>
                <button 
                  onClick={closeMediaView}
                  className="relative p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md active:scale-90 overflow-hidden"
                >
                  <X size={24} />
                  <Ripple />
                </button>
              </div>

              <div className="w-full h-full flex items-center justify-center">
                {fullViewMediaPost.is_gallery && fullViewMediaPost.gallery_data?.items && fullViewMediaPost.media_metadata ? (
                  <div 
                    className="w-full h-full flex items-center justify-center relative touch-none"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      (e.currentTarget as any).startX = touch.clientX;
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const startX = (e.currentTarget as any).startX;
                      if (startX === undefined) return;
                      
                      const diff = touch.clientX - startX;
                      
                      if (Math.abs(diff) > 50) {
                        if (diff > 0) { // Right swipe - previous
                          setGalleryIndex(prev => prev === 0 ? fullViewMediaPost.gallery_data!.items.length - 1 : prev - 1);
                        } else { // Left swipe - next
                          setGalleryIndex(prev => prev === fullViewMediaPost.gallery_data!.items.length - 1 ? 0 : prev + 1);
                        }
                        // Reset startX to avoid rapid switching
                        (e.currentTarget as any).startX = touch.clientX;
                      }
                    }}
                  >
                    <img 
                      src={fullViewMediaPost.media_metadata[fullViewMediaPost.gallery_data.items[galleryIndex].media_id]?.s?.u?.replace(/&amp;/g, '&') || ''} 
                      alt="" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                      {galleryIndex + 1} / {fullViewMediaPost.gallery_data.items.length}
                    </div>
                  </div>
                ) : (() => {
                  const gif = getGifUrl(fullViewMediaPost);
                  if (gif) {
                    if (gif.type === 'hls' || gif.type === 'mp4') {
                      return (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoPlayer 
                            src={getProxiedMediaUrl(gif.url)} 
                            hlsUrl={gif.type === 'hls' ? getProxiedMediaUrl(gif.url) : undefined}
                            autoPlay={true}
                            muted={false}
                            className="w-full h-full"
                          />
                        </div>
                      );
                    } else {
                      return (
                        <img 
                          src={getProxiedMediaUrl(gif.url)} 
                          alt="" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      );
                    }
                  }
                  
                  const streamableId = getStreamableId(fullViewMediaPost.url);
                  if (streamableId) {
                    return (
                      <div className="w-full h-full relative bg-black">
                        <ReactPlayer
                          url={fullViewMediaPost.url}
                          playing={true}
                          muted={true}
                          controls={true}
                          width="100%"
                          height="100%"
                          style={{ position: 'absolute', top: 0, left: 0 }}
                        />
                      </div>
                    );
                  }
                  if (fullViewMediaPost.post_hint === 'image' || fullViewMediaPost.url?.match(/\.(jpg|jpeg|png)$/i)) {
                    return (
                      <img 
                        src={fullViewMediaPost.url} 
                        alt="" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    );
                  }
                  return null;
                })()
                }
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </ErrorBoundary>
);
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-bg-primary text-text-primary">
          <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
            <X size={32} />
          </div>
          <h1 className="text-2xl font-display font-bold text-text-primary mb-2">Something went wrong</h1>
          <p className="text-text-secondary mb-6 max-w-md">
            The application encountered an unexpected error. This might be due to corrupted local data.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="relative w-full py-3 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 transition-all active:scale-95 overflow-hidden"
            >
              Reload Application
              <Ripple />
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="relative w-full py-3 bg-error/10 text-error rounded-full font-bold hover:bg-error/20 transition-all active:scale-95 overflow-hidden"
            >
              Clear Data & Reset
              <Ripple />
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-8 p-4 bg-bg-secondary rounded-2xl text-left text-xs overflow-auto max-w-full text-text-secondary">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform cursor-pointer touch-manipulation group"
    >
      <div className={`relative px-5 py-1 rounded-full transition-all duration-300 overflow-hidden ${active ? 'bg-secondary-container text-on-secondary-container' : 'text-text-secondary group-hover:bg-hover-bg'}`}>
        {icon}
        <Ripple />
      </div>
      <span className={`text-[11px] font-medium transition-colors ${active ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>
        {label}
      </span>
    </button>
  );
}
