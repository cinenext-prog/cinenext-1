import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import HomeFeed from './components/HomeFeed';
import SearchPage from './components/SearchPage';
import usePersistentState from './hooks/usePersistentState';
import useTelegramSetup from './hooks/useTelegramSetup';
import useVideoReloadSync from './hooks/useVideoReloadSync';
import {
  HOT_KEYWORDS,
  LOCAL_VIDEO_KEY_SET,
  formatCount,
  normalizeAsset,
  readLegacyVideos,
} from './lib/videoData';

const STORAGE_KEYS = {
  searchHistory: 'cinenext_search_history',
  watchlist: 'cinenext_watchlist',
  interactions: 'cinenext_interactions',
};

const getTelegramWebApp = () => window.Telegram?.WebApp || null;

function App() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [page, setPage] = useState('home');
  const [videos, setVideos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = usePersistentState(STORAGE_KEYS.searchHistory, []);
  const [watchlist, setWatchlist] = usePersistentState(STORAGE_KEYS.watchlist, []);
  const [interactions, setInteractions] = usePersistentState(STORAGE_KEYS.interactions, {});
  const [accessMap, setAccessMap] = useState({});

  const [unlockingId, setUnlockingId] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const feedRef = useRef(null);
  const pendingScrollIndexRef = useRef(null);
  const scrollRafRef = useRef(0);

  const activeVideo = videos[activeIndex] || null;
  const currentVideoIdRef = useRef(null);

  useTelegramSetup(page, setPage);

  useEffect(() => {
    if (searchHistory.length > 5) {
      setSearchHistory((prev) => prev.slice(0, 5));
    }
  }, [searchHistory, setSearchHistory]);

  useEffect(() => {
    currentVideoIdRef.current = activeVideo?.id || null;
  }, [activeVideo?.id]);

  const fetchLivepeerAssets = useCallback(async () => {
    const apiKey = import.meta.env.VITE_LIVEPEER_API_KEY;
    if (!apiKey) {
      return [];
    }

    const response = await fetch('https://livepeer.studio/api/asset?limit=60', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取 Livepeer 资源失败');
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : data?.assets || [];
    return list.map(normalizeAsset).filter(Boolean);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      setLoading(true);
      setLoadError('');

      try {
        let remoteVideos = [];
        let remoteError = '';

        try {
          remoteVideos = await fetchLivepeerAssets();
        } catch (error) {
          remoteError = error instanceof Error ? error.message : '获取云端资源失败';
        }

        const legacyVideos = readLegacyVideos();

        const remoteMap = new Map();
        remoteVideos.forEach((video) => {
          if (!remoteMap.has(video.playbackId)) {
            remoteMap.set(video.playbackId, video);
          }
        });

        const nextVideos = [...remoteMap.values(), ...legacyVideos];

        if (!cancelled) {
          const currentId = currentVideoIdRef.current;
          const nextIndex = currentId
            ? Math.max(0, nextVideos.findIndex((video) => video.id === currentId))
            : 0;

          setVideos(nextVideos);
          setActiveIndex(nextIndex);
          if (nextVideos.length === 0) {
            setLoadError(remoteError || '暂无可播放内容，请配置 Livepeer API Key 或先添加资源。');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '加载视频失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadVideos();

    return () => {
      cancelled = true;
    };
  }, [reloadTick, fetchLivepeerAssets]);

  const requestReload = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useVideoReloadSync(requestReload, LOCAL_VIDEO_KEY_SET);

  const checkNftAccess = useCallback(async (video, address) => {
    if (!video?.nftCollectionAddress) {
      return true;
    }

    if (!address) {
      return false;
    }

    try {
      const apiKey = import.meta.env.VITE_TONCENTER_API_KEY;
      const endpoint = new URL('https://toncenter.com/api/v3/nft/items');
      endpoint.searchParams.set('owner_address', address);
      endpoint.searchParams.set('collection_address', video.nftCollectionAddress);
      endpoint.searchParams.set('limit', '1');

      const response = await fetch(endpoint.toString(), {
        headers: apiKey
          ? {
              'X-API-Key': apiKey,
            }
          : undefined,
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      const items = Array.isArray(payload?.nft_items)
        ? payload.nft_items
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      return items.length > 0;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const validateAccess = async () => {
      const address = wallet?.account?.address;
      const lockedVideos = videos.filter((video) => video.unlockType === 'nft');

      if (lockedVideos.length === 0) {
        return;
      }

      const updates = {};
      for (const video of lockedVideos) {
        updates[video.id] = await checkNftAccess(video, address);
      }

      if (!cancelled) {
        setAccessMap((prev) => ({ ...prev, ...updates }));
      }
    };

    validateAccess();

    return () => {
      cancelled = true;
    };
  }, [videos, wallet?.account?.address, checkNftAccess]);

  const homeSearchResults = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    return videos.filter((video) => {
      const actor = video.actors.join(' ').toLowerCase();
      const tags = video.keywords.join(' ').toLowerCase();
      return (
        video.title.toLowerCase().includes(keyword) ||
        actor.includes(keyword) ||
        tags.includes(keyword)
      );
    });
  }, [videos, searchQuery]);

  const searchSuggestions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    return videos
      .filter((video) => video.title.toLowerCase().includes(keyword))
      .slice(0, 6)
      .map((video) => video.title);
  }, [videos, searchQuery]);

  const updateInteraction = useCallback((videoId, updater) => {
    setInteractions((prev) => {
      const current = prev[videoId] || { liked: false, likes: 0, comments: 0, shares: 0 };
      return {
        ...prev,
        [videoId]: updater(current),
      };
    });
  }, [setInteractions]);

  const getInteraction = useCallback((video) => {
    const current = interactions[video.id] || { liked: false, likes: 0, comments: 0, shares: 0 };
    return {
      liked: current.liked,
      likes: video.likes + current.likes,
      comments: current.comments,
      shares: current.shares,
    };
  }, [interactions]);

  const toggleLike = useCallback((video) => {
    updateInteraction(video.id, (current) => {
      if (current.liked) {
        return {
          ...current,
          liked: false,
          likes: Math.max(0, current.likes - 1),
        };
      }
      return {
        ...current,
        liked: true,
        likes: current.likes + 1,
      };
    });
  }, [updateInteraction]);

  const openComment = useCallback((video) => {
    const comment = window.prompt(`给《${video.title}》写条评论`);
    if (!comment || !comment.trim()) {
      return;
    }

    updateInteraction(video.id, (current) => ({
      ...current,
      comments: current.comments + 1,
    }));
  }, [updateInteraction]);

  const shareVideo = useCallback(async (video) => {
    const shareText = `正在看：${video.title} 第${video.episode}集`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#playback=${video.playbackId}`;

    try {
      const tg = getTelegramWebApp();
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
      } else if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }

      updateInteraction(video.id, (current) => ({
        ...current,
        shares: current.shares + 1,
      }));
    } catch {
      // ignore canceled share
    }
  }, [updateInteraction]);

  const toggleWatchlist = useCallback((video) => {
    setWatchlist((prev) =>
      prev.includes(video.id)
        ? prev.filter((id) => id !== video.id)
        : [video.id, ...prev]
    );
  }, [setWatchlist]);

  const onFeedScroll = useCallback(() => {
    if (!feedRef.current || videos.length === 0) {
      return;
    }

    if (scrollRafRef.current) {
      return;
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = 0;

      if (!feedRef.current) {
        return;
      }

      const { scrollTop, clientHeight } = feedRef.current;
      if (clientHeight <= 0) {
        return;
      }

      const nextIndex = Math.round(scrollTop / clientHeight);
      const safeIndex = Math.min(videos.length - 1, Math.max(0, nextIndex));
      setActiveIndex((prev) => (prev === safeIndex ? prev : safeIndex));
    });
  }, [videos.length]);

  const navigateToHomeVideo = useCallback((videoId, keyword = '') => {
    const idx = videos.findIndex((video) => video.id === videoId);
    if (idx < 0) {
      return;
    }

    if (keyword.trim()) {
      setSearchHistory((prev) => [keyword.trim(), ...prev.filter((item) => item !== keyword.trim())].slice(0, 5));
    }

    setPage('home');
    setActiveIndex(idx);
    pendingScrollIndexRef.current = idx;
  }, [videos, setSearchHistory]);

  useEffect(() => {
    if (page !== 'home' || pendingScrollIndexRef.current === null || !feedRef.current) {
      return;
    }

    const idx = pendingScrollIndexRef.current;
    feedRef.current.scrollTo({
      top: feedRef.current.clientHeight * idx,
      behavior: 'smooth',
    });
    pendingScrollIndexRef.current = null;
  }, [page]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const openSearch = useCallback(() => {
    setPage('search');
    setSearchQuery('');
  }, []);

  const requestUnlock = useCallback(async (video) => {
    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }

    const target = import.meta.env.VITE_UNLOCK_CONTRACT || video.nftCollectionAddress;
    if (!target) {
      return;
    }

    const amountTon = Number(video.price || 0.5);
    const amount = String(BigInt(Math.floor(amountTon * 1e9)));

    try {
      setUnlockingId(video.id);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: target,
            amount,
          },
        ],
      });

      const hasAccess = await checkNftAccess(video, wallet?.account?.address);
      setAccessMap((prev) => ({
        ...prev,
        [video.id]: hasAccess,
      }));
    } catch {
      // ignore canceled tx
    } finally {
      setUnlockingId('');
    }
  }, [wallet, tonConnectUI, checkNftAccess]);

  return (
    <div className="app-root">
      {page === 'home' ? (
        <HomeFeed
          loading={loading}
          videos={videos}
          loadError={loadError}
          tonConnectUI={tonConnectUI}
          wallet={wallet}
          openSearch={openSearch}
          feedRef={feedRef}
          onFeedScroll={onFeedScroll}
          activeIndex={activeIndex}
          getInteraction={getInteraction}
          accessMap={accessMap}
          unlockingId={unlockingId}
          requestUnlock={requestUnlock}
          toggleLike={toggleLike}
          openComment={openComment}
          shareVideo={shareVideo}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          formatCount={formatCount}
        />
      ) : (
        <SearchPage
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setPage={setPage}
          searchSuggestions={searchSuggestions}
          searchHistory={searchHistory}
          setSearchHistory={setSearchHistory}
          hotKeywords={HOT_KEYWORDS}
          homeSearchResults={homeSearchResults}
          navigateToHomeVideo={navigateToHomeVideo}
          formatCount={formatCount}
        />
      )}
    </div>
  );
}

export default App;
