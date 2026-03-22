/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import VideoPlayer from './components/VideoPlayer';
import UserProfile from './components/UserProfile';
import { RedditPost, fetchSubreddit, setRedditAuth, getAuthUrl, fetchMySubreddits, getStreamableId } from './services/reddit';
import { Search, RefreshCw, Loader2, Home, TrendingUp, Hash, Settings, X, Smartphone, Globe, LogIn, LogOut, Info, User, UserCircle, Trash2, ArrowLeft, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';

export default function App() {
  const [view, setView] = useState<'feed' | 'settings' | 'profile'>('feed');
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
  const [subredditHistory, setSubredditHistory] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [fullViewMediaPost, setFullViewMediaPost] = useState<RedditPost | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<string | null>(null);
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
  const observerTarget = useRef<HTMLDivElement>(null);
  const afterRef = useRef<string | null>(null);

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
    // Base Material You colors for dark theme
    root.style.setProperty('--m3-primary', '#FF4500');
    root.style.setProperty('--m3-on-primary', '#FFFFFF');
    root.style.setProperty('--m3-primary-container', '#4A1D00');
    root.style.setProperty('--m3-on-primary-container', '#FFDBCB');
    root.style.setProperty('--m3-surface', 'rgba(26, 26, 27, 0.7)'); // Translucent for Mica
    root.style.setProperty('--m3-on-surface', '#D7DADC');
    root.style.setProperty('--m3-surface-variant', 'rgba(39, 39, 41, 0.6)');
    root.style.setProperty('--m3-on-surface-variant', '#818384');
    root.style.setProperty('--m3-background', '#030303');
    
    // Set theme color for mobile browser UI
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#030303');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#030303';
      document.head.appendChild(meta);
    }

    // Set accent color for Material You feel
    root.style.setProperty('accent-color', '#FF4500');
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
      } else {
        // Default state
        setView('feed');
        setSelectedPost(null);
        setShowSubreddits(false);
        setSelectedUser(null);
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
        selectedUser: null
      }, '');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sync state changes to history
  useEffect(() => {
    if (isPopStateRef.current) return;

    const currentState = window.history.state;
    const newState = { 
      view, 
      subreddit, 
      postId: selectedPost?.id || null, 
      showSubreddits,
      selectedUser
    };

    // Check if we should push a new state
    const hasChanged = !currentState || 
      currentState.view !== newState.view || 
      currentState.subreddit !== newState.subreddit || 
      currentState.postId !== newState.postId || 
      currentState.showSubreddits !== newState.showSubreddits ||
      currentState.selectedUser !== newState.selectedUser;

    if (hasChanged) {
      window.history.pushState(newState, '');
    }
  }, [view, subreddit, selectedPost, showSubreddits, selectedUser]);

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

  const loadPosts = useCallback(async (sub: string, append = false) => {
    if (!append) {
      setLoading(true);
      afterRef.current = null;
    }
    try {
      const { posts: newPosts, after: newAfter } = await fetchSubreddit(sub, append ? afterRef.current || undefined : undefined);
      setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
      afterRef.current = newAfter;
      setAfter(newAfter); // Still keep state for UI if needed, but use ref for logic
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
    loadPosts(subreddit);
  }, [subreddit, loadPosts]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && after && !loading && view === 'feed') {
          loadPosts(subreddit, true);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [after, loading, subreddit, loadPosts, view]);

  useEffect(() => {
    loadMySubreddits();
  }, [loadMySubreddits]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const { searchSubreddits } = await import('./services/reddit');
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
    loadPosts(subreddit);
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
          loadPosts('home');
          setShowSettings(false);
          const { getAccounts } = await import('./services/reddit');
          setAccounts(getAccounts());
        } else {
          alert('Failed to fetch Reddit profile. Please try again.');
        }
      }
    }
  }, [redditClientId, loadPosts]);

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

  const visiblePosts = posts.filter(post => 
    !filteredSubreddits.includes(post.subreddit.toLowerCase()) && 
    !filteredUsers.includes(post.author.toLowerCase())
  );

  const handleRedditLogout = async () => {
    const { setRedditAuth } = await import('./services/reddit');
    setRedditAuth(null, null);
    setIsLoggedIn(false);
    setCurrentUsername('');
    setSubreddit('all');
    loadPosts('all');
    setShowSettings(false);
  };

  const handleSwitchAccount = async (username: string) => {
    const { switchAccount } = await import('./services/reddit');
    if (switchAccount(username)) {
      setIsLoggedIn(true);
      setCurrentUsername(username);
      setSubreddit('home');
      loadPosts('home');
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
      loadPosts('all');
    }
  };

  const handleSubredditChange = (newSub: string) => {
    if (newSub !== subreddit || view !== 'feed') {
      setSubredditHistory(prev => [...prev, subreddit]);
      setSubreddit(newSub);
      setView('feed');
    }
    setAfter(null);
    setPosts([]);
    setShowSubreddits(false);
    window.scrollTo(0, 0);
  };

  const handleBack = useCallback(() => {
    if (selectedPost) {
      setSelectedPost(null);
    } else if (fullViewMediaPost) {
      setFullViewMediaPost(null);
    } else if (view === 'profile') {
      setView('feed');
      setSelectedUser(null);
    } else if (view === 'settings') {
      setView('feed');
    } else if (subredditHistory.length > 0) {
      const prevSub = subredditHistory[subredditHistory.length - 1];
      setSubredditHistory(prev => prev.slice(0, -1));
      setSubreddit(prevSub);
      setAfter(null);
      setPosts([]);
      window.scrollTo(0, 0);
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

  return (
    <ErrorBoundary>
      <div className="flex min-h-[100dvh] bg-bg-primary text-text-primary pb-20 md:pb-0 overflow-x-hidden">
        <div className="flex min-h-[100dvh] w-full">
          {/* Desktop Navigation Rail */}
      <div className="hidden md:block">
        <Sidebar 
          currentSubreddit={subreddit} 
          onSubredditChange={handleSubredditChange} 
          onSettingsClick={() => setView('settings')}
          isLoggedIn={isLoggedIn}
          onLoginClick={handleRedditLogin}
          onLogoutClick={handleRedditLogout}
          mySubreddits={mySubreddits}
          redditClientId={redditClientId}
          currentUsername={currentUsername}
        />
      </div>

        {/* Feed View */}
        {view === 'feed' && (
          <main className="flex-1 flex flex-col w-full min-w-0">
            {/* Top App Bar */}
            <header className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-md px-4 py-3 md:px-8 md:py-4 flex items-center justify-between min-h-[56px]">
              <AnimatePresence mode="wait">
                {isSearchExpanded ? (
                  <motion.div 
                    key="search-expanded"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex items-center gap-2"
                  >
                    <button 
                      onClick={() => {
                        setIsSearchExpanded(false);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                      className="p-2 text-text-secondary hover:text-text-primary"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
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
                        className="w-full pl-9 pr-4 py-2 bg-bg-secondary text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500] transition-all"
                      />
                      
                      <AnimatePresence>
                        {showSearchResults && searchResults.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-bg-secondary border border-border-color rounded-lg shadow-2xl z-50 overflow-hidden"
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
                                className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-hover-bg transition-colors border-b border-border-color last:border-none flex items-center gap-2"
                              >
                                <Hash size={14} className="text-text-secondary" />
                                <span>r/{sr}</span>
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
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="md:hidden w-8 h-8 bg-[#FF4500] rounded-md flex items-center justify-center shrink-0">
                        <div className="w-3 h-3 bg-white rounded-full" />
                      </div>
                      <h1 className="text-xl font-semibold tracking-tight truncate max-w-[150px] md:max-w-none text-text-primary">
                        {subreddit === 'home' ? 'Home' : `r/${subreddit}`}
                      </h1>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                      <button 
                        onClick={() => setIsSearchExpanded(true)}
                        className="sm:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-all"
                      >
                        <Search size={20} />
                      </button>

                      {!isLoggedIn && (
                        <button 
                          onClick={handleRedditLogin}
                          className="sm:hidden p-2 text-text-primary hover:bg-bg-tertiary rounded-md transition-all"
                        >
                          <LogIn size={20} />
                        </button>
                      )}
                      {!isLoggedIn && (
                        <button 
                          onClick={handleRedditLogin}
                          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#D7DADC] text-[#030303] text-xs font-medium rounded-md hover:bg-[#D7DADC]/90 transition-colors"
                        >
                          <LogIn size={14} />
                          <span>Login</span>
                        </button>
                      )}
                      <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
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
                          className="pl-9 pr-4 py-2 bg-bg-secondary text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500] transition-all w-48 lg:w-64 focus:bg-bg-tertiary"
                        />
                        
                        <AnimatePresence>
                          {showSearchResults && searchResults.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-bg-secondary border border-border-color rounded-lg shadow-2xl z-50 overflow-hidden"
                            >
                              {searchResults.map((sr) => (
                                <button
                                  key={sr}
                                  onClick={() => {
                                    handleSubredditChange(sr);
                                    setSearchQuery('');
                                    setShowSearchResults(false);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-hover-bg transition-colors border-b border-border-color last:border-none flex items-center gap-2"
                                >
                                  <Hash size={14} className="text-text-secondary" />
                                  <span>r/{sr}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <button 
                        onClick={handleRefresh}
                        className={`p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-all touch-manipulation ${isRefreshing ? 'animate-spin text-text-primary' : ''}`}
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </header>

            {/* Feed */}
            <div className="p-0 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-0 md:gap-6">
              {!isLoggedIn && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 text-white rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  {!redditClientId ? (
                    <>
                      <div className="flex flex-col gap-1 text-center sm:text-left">
                        <h3 className="font-semibold text-lg">Setup Reddit API</h3>
                        <p className="text-sm text-gray-400">Enter your Client ID in Settings to enable account features.</p>
                      </div>
                      <button 
                        onClick={() => setView('settings')}
                        className="px-6 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-100 transition-all shrink-0"
                      >
                        Open Settings
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1 text-center sm:text-left">
                        <h3 className="font-semibold text-lg">Connect your Reddit account</h3>
                        <p className="text-sm text-gray-400">Login to see your personal frontpage and subreddits.</p>
                      </div>
                      <button 
                        onClick={handleRedditLogin}
                        className="px-6 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-100 transition-all shrink-0"
                      >
                        Login Now
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {loading && posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-gray-400">
                  <Loader2 size={32} className="animate-spin" />
                  <p className="text-sm font-medium uppercase tracking-wider">Syncing with Reddit...</p>
                </div>
              ) : (
                <>
                  {visiblePosts.map((post, idx) => (
                    <PostCard 
                      key={`${post.id}-${idx}`} 
                      post={post} 
                      onClick={setSelectedPost} 
                      onVote={handleVote}
                      onSubredditClick={(sr) => {
                        handleSubredditChange(sr);
                      }}
                      onUserClick={(user) => {
                        setSelectedUser(user);
                        setView('profile');
                      }}
                      onMediaClick={setFullViewMediaPost}
                      onFilterSubreddit={handleFilterSubreddit}
                      onFilterUser={handleFilterUser}
                    />
                  ))}
                  
                  {/* Infinite Scroll Target */}
                  <div ref={observerTarget} className="h-20 flex items-center justify-center">
                    {loading && <Loader2 size={24} className="animate-spin text-text-secondary" />}
                  </div>
                </>
              )}
            </div>
          </main>
        )}

        {/* Settings View */}
        {view === 'settings' && (
          <main className="flex-1 flex flex-col w-full min-w-0 bg-bg-primary">
            <header className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-md px-4 py-3 md:px-8 md:py-4 flex items-center gap-4">
              <button onClick={() => setView('feed')} className="p-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft size={22} />
              </button>
              <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
            </header>
            <div className="p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col gap-8">
              {/* Appearance Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <Moon size={18} />
                  <h3 className="font-medium">Appearance</h3>
                </div>
                <div className="flex flex-col gap-3 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-text-primary">Theme</label>
                      <p className="text-xs text-text-secondary mt-0.5">Choose your preferred theme</p>
                    </div>
                    <select 
                      className="bg-bg-primary border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#FF4500]"
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
                <div className="flex items-center gap-2 text-text-primary">
                  <Hash size={18} />
                  <h3 className="font-medium">API Configuration</h3>
                </div>
                <div className="flex flex-col gap-3 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Reddit Client ID</label>
                    <input 
                      type="text" 
                      value={redditClientId}
                      onChange={(e) => {
                        setRedditClientId(e.target.value);
                        localStorage.setItem('reddit_client_id', e.target.value);
                      }}
                      placeholder="Enter Reddit Client ID"
                      className="bg-bg-primary rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-[#FF4500]"
                    />
                    <p className="text-[11px] text-text-secondary mt-1">
                      Create an app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" className="text-[#FF4500] hover:underline">reddit.com/prefs/apps</a> (Type: installed app).<br/>
                      Set redirect uri to: <br/>
                      <code className="bg-bg-primary px-1.5 py-0.5 rounded mt-1 inline-block select-all">{window.location.origin}/auth/callback</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Reddit Account Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <UserCircle size={18} />
                  <h3 className="font-medium">Reddit Accounts</h3>
                </div>
                <div className="flex flex-col gap-3 p-4 bg-bg-secondary rounded-lg">
                  {accounts.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {accounts.map(acc => (
                        <div key={acc.username} className="flex items-center justify-between p-2 bg-bg-primary rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${acc.username === currentUsername ? 'bg-green-500' : 'bg-[#343536]'}`} />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-text-primary">u/{acc.username}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {acc.username !== currentUsername && (
                              <button 
                                onClick={() => handleSwitchAccount(acc.username)}
                                className="text-xs text-[#FF4500] hover:underline font-medium"
                              >
                                Switch
                              </button>
                            )}
                            <button 
                              onClick={() => handleRemoveAccount(acc.username)}
                              className="p-1 text-text-secondary hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={handleRedditLogin}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-[#D7DADC] text-[#030303] hover:bg-[#D7DADC]/90 rounded-md text-sm font-medium mt-2 transition-colors"
                      >
                        <LogIn size={16} /> Add Another Account
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary font-medium">Status</span>
                        <span className="text-xs px-2 py-0.5 bg-[#343536] text-text-secondary rounded-full font-bold">Disconnected</span>
                      </div>
                      <button 
                        onClick={handleRedditLogin}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-[#D7DADC] text-[#030303] hover:bg-[#D7DADC]/90 rounded-md text-sm font-medium transition-colors"
                      >
                        <LogIn size={16} /> Login with Reddit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* App Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <Smartphone size={18} />
                  <h3 className="font-medium">App</h3>
                </div>
                <div className="flex flex-col gap-3 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-text-primary font-medium">Install Minute</span>
                      <span className="text-xs text-text-secondary">
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
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isInstallable && !isStandalone && !isIframe ? 'bg-[#FF4500] text-white hover:bg-[#FF4500]/90' : 'bg-[#343536] text-text-secondary cursor-not-allowed'}`}
                    >
                      {isStandalone ? 'Installed' : isInstallable ? 'Install' : isIframe ? 'Unavailable' : 'Checking...'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border-color">
                    <span className="text-sm text-text-primary font-medium">Version</span>
                    <span className="text-xs text-text-secondary">1.0.0</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* Profile View */}
        {view === 'profile' && selectedUser && (
          <main className="flex-1 flex flex-col w-full min-w-0">
            <UserProfile 
              username={selectedUser} 
              onClose={() => setView('feed')} 
              onPostClick={setSelectedPost}
              onVote={handleVote}
              onSubredditClick={handleSubredditChange}
              onMediaClick={setFullViewMediaPost}
            />
          </main>
        )}
      </div>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-primary/95 backdrop-blur-md px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around z-50 shadow-[0_-1px_3px_rgba(0,0,0,0.2)] transform translate-z-0">
        <MobileNavItem icon={<Home size={20} />} label="Home" active={subreddit === 'home' && view === 'feed'} onClick={() => handleSubredditChange('home')} />
        <MobileNavItem icon={<TrendingUp size={20} />} label="Popular" active={subreddit === 'popular' && view === 'feed'} onClick={() => handleSubredditChange('popular')} />
        <MobileNavItem icon={<Globe size={20} />} label="Browse" active={showSubreddits} onClick={() => setShowSubreddits(true)} />
        <MobileNavItem icon={<Settings size={20} />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>

      {/* Mobile Subreddits Drawer */}
      <AnimatePresence>
        {showSubreddits && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubreddits(false)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[70vh] bg-bg-secondary rounded-t-2xl z-[90] overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="p-4 flex items-center justify-between sticky top-0 bg-bg-secondary z-10">
                <h2 className="font-semibold text-text-primary">Subreddits</h2>
                <button onClick={() => setShowSubreddits(false)} className="p-1 text-text-secondary">
                  <X size={20} />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 pb-24">
                {(isLoggedIn && mySubreddits.length > 0 ? mySubreddits : ['all', 'popular', 'gaming', 'technology', 'worldnews', 'science', 'movies']).map(sub => (
                  <button
                    key={sub}
                    onClick={() => handleSubredditChange(sub)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      subreddit === sub ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary active:bg-bg-tertiary'
                    }`}
                  >
                    <Hash size={18} className="text-text-secondary" />
                    <span className="capitalize">{sub}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal - Removed as it's now a view */}

      {/* Post Detail Drawer */}
      <AnimatePresence>
        {selectedPost && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPost(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
              className="fixed inset-y-0 right-0 w-full md:w-[640px] z-[70] bg-bg-primary shadow-2xl overflow-hidden"
            >
              <PostDetail 
                post={selectedPost} 
                onClose={() => setSelectedPost(null)} 
                onVote={handleVote}
                onComment={handleComment}
                onSubredditClick={(sr) => {
                  handleSubredditChange(sr);
                  setSelectedPost(null);
                }}
                onUserClick={(user) => {
                  setSelectedUser(user);
                  setView('profile');
                  setSelectedPost(null);
                }}
                onFilterSubreddit={handleFilterSubreddit}
                onFilterUser={handleFilterUser}
                onMediaClick={(post, index) => {
                  setFullViewMediaPost(post);
                  if (index !== undefined) setGalleryIndex(index);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Persistent Media View Modal */}
      <AnimatePresence>
        {fullViewMediaPost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setFullViewMediaPost(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
                <a 
                  href={fullViewMediaPost.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all flex items-center gap-2 px-4 text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe size={18} />
                  Open Link
                </a>
                <button 
                  onClick={() => setFullViewMediaPost(null)}
                  className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all"
                >
                  <X size={24} />
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
                      src={fullViewMediaPost.media_metadata[fullViewMediaPost.gallery_data.items[galleryIndex].media_id].s.u.replace(/&amp;/g, '&')} 
                      alt="" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                      {galleryIndex + 1} / {fullViewMediaPost.gallery_data.items.length}
                    </div>
                  </div>
                ) : fullViewMediaPost.is_video && fullViewMediaPost.media?.reddit_video ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <VideoPlayer 
                      src={fullViewMediaPost.media.reddit_video.fallback_url} 
                      hlsUrl={fullViewMediaPost.media.reddit_video.hls_url}
                      autoPlay={false}
                      muted={false}
                      className="w-full h-full"
                    />
                  </div>
                ) : (() => {
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
                  if (fullViewMediaPost.post_hint === 'image' || fullViewMediaPost.url?.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    return (
                      <img 
                        src={fullViewMediaPost.url} 
                        alt="" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    );
                  }
                  return (
                    <div className="w-full h-full bg-bg-secondary rounded-2xl overflow-hidden flex flex-col">
                      <iframe 
                        src={fullViewMediaPost.url} 
                        className="w-full h-full border-none"
                        title="Website Preview"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                      <div className="p-4 bg-bg-primary border-t border-border-color flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Previewing</span>
                          <span className="text-sm text-text-primary truncate max-w-[200px] md:max-w-md">{fullViewMediaPost.url}</span>
                        </div>
                        <a 
                          href={fullViewMediaPost.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#FF4500] text-white rounded-lg text-sm font-bold"
                        >
                          Open in Browser
                        </a>
                      </div>
                    </div>
                  );
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
          <div className="w-16 h-16 bg-red-100/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <X size={32} />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h1>
          <p className="text-text-secondary mb-6 max-w-md">
            The application encountered an unexpected error. This might be due to corrupted local data.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-[#D7DADC] text-[#030303] rounded-md font-medium hover:bg-[#D7DADC]/90 transition-colors"
            >
              Reload Application
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2 bg-bg-secondary text-red-500 rounded-md font-medium hover:bg-red-500/10 transition-colors"
            >
              Clear Data & Reset
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-8 p-4 bg-bg-secondary rounded text-left text-xs overflow-auto max-w-full text-text-secondary">
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
      className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform cursor-pointer touch-manipulation"
    >
      <div className={`p-1.5 rounded-md transition-all duration-200 ${active ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-medium transition-colors ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
        {label}
      </span>
    </button>
  );
}
