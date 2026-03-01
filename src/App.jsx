import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import HomeFeed from './components/HomeFeed';
import SearchPage from './components/SearchPage';

const STORAGE_KEYS = {
  searchHistory: 'cinenext_search_history',
  watchHistory: 'cinenext_watch_history',
  watchlist: 'cinenext_watchlist',
  interactions: 'cinenext_interactions',
  legacyVideos: 'cinenext_videos',
};

const HOT_KEYWORDS = ['短剧', '逆袭', '豪门', '重生', '甜宠'];
const LOCAL_VIDEO_KEYS = [
  STORAGE_KEYS.legacyVideos,
  'legacyVideos',
  'cinenext_videos',
  'cinenext_admin_videos',
];
const LOCAL_VIDEO_KEY_SET = new Set(LOCAL_VIDEO_KEYS);

const safeGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const getTelegramWebApp = () => window.Telegram?.WebApp || null;

const toText = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const toPlaybackUrl = (playbackId) => `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;
const toCoverUrl = (playbackId) => `https://livepeer.studio/thumbnail/${playbackId}.png`;

const normalizeAsset = (asset, index) => {
  const playbackId = toText(asset?.playbackId || asset?.playback_id);
  if (!playbackId) {
    return null;
  }

  const metadata = typeof asset?.meta === 'object' && asset?.meta
    ? asset.meta
    : typeof asset?.metadata === 'object' && asset?.metadata
      ? asset.metadata
      : {};

  const episode = metadata.episode || metadata.currentEpisode || index + 1;
  const nftCollectionAddress = metadata.nftCollectionAddress || metadata.collectionAddress || '';
  const unlockType = nftCollectionAddress ? 'nft' : 'free';
  const price = metadata.price || metadata.unlockPrice || '0.5';
  const actorList = Array.isArray(metadata.actors)
    ? metadata.actors
    : typeof metadata.actors === 'string' && metadata.actors
      ? metadata.actors.split(',').map((actor) => actor.trim()).filter(Boolean)
      : [];

  const keywordList = Array.isArray(metadata.keywords)
    ? metadata.keywords
    : typeof metadata.keywords === 'string' && metadata.keywords
      ? metadata.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
      : [];

  return {
    id: String(asset?.id || playbackId),
    playbackId,
    playbackUrl: toPlaybackUrl(playbackId),
    coverUrl: toCoverUrl(playbackId),
    title: toText(asset?.name || metadata.title, `短剧 ${index + 1}`),
    episode: Number(episode) || index + 1,
    likes: Number(metadata.likes || Math.floor(2000 + Math.random() * 9000)),
    views: Number(metadata.views || Math.floor(30000 + Math.random() * 300000)),
    actors: actorList,
    keywords: keywordList,
    unlockType,
    nftCollectionAddress,
    price,
  };
};

const normalizeLegacyVideo = (video, index) => {
  const playbackId = toText(video?.playbackId);
  if (!playbackId) {
    return null;
  }

  const episode = Number(video?.episode || index + 1) || index + 1;
  const likes = Number(video?.likes || 1000 + index * 87);
  const views = Number(video?.views || 10000 + index * 529);
  const unlockType = video?.unlockType === 'nft' ? 'nft' : 'free';
  const actors = Array.isArray(video?.actors) ? video.actors : [];
  const keywords = Array.isArray(video?.keywords) ? video.keywords : [];

  return {
    id: String(video?.id || `legacy-${playbackId}`),
    playbackId,
    playbackUrl: toText(video?.playbackUrl, toPlaybackUrl(playbackId)),
    coverUrl: toCoverUrl(playbackId),
    title: toText(video?.title, `短剧 ${index + 1}`),
    episode,
    likes,
    views,
    actors,
    keywords,
    unlockType,
    nftCollectionAddress: toText(video?.nftCollectionAddress),
    price: toText(video?.price, '0.5'),
  };
};

const readLegacyVideos = () => {
  const all = [];
  LOCAL_VIDEO_KEYS.forEach((key) => {
    const list = safeGet(key, []);
    if (Array.isArray(list)) {
      all.push(...list);
    }
  });

  const normalized = all.map(normalizeLegacyVideo).filter(Boolean);
  const unique = new Map();

  normalized.forEach((video) => {
    const sig = `${video.playbackId}::${video.episode}::${video.title}`;
    if (!unique.has(sig)) {
      unique.set(sig, video);
    }
  });

  return [...unique.values()];
};

const formatCount = (value) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }
  return String(value);
};

function App() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [page, setPage] = useState('home');
  const [videos, setVideos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => safeGet(STORAGE_KEYS.searchHistory, []));
  const [watchlist, setWatchlist] = useState(() => safeGet(STORAGE_KEYS.watchlist, []));
  const [interactions, setInteractions] = useState(() => safeGet(STORAGE_KEYS.interactions, {}));
  const [accessMap, setAccessMap] = useState({});

  const [unlockingId, setUnlockingId] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const feedRef = useRef(null);
  const pendingScrollIndexRef = useRef(null);
  const scrollRafRef = useRef(0);

  const activeVideo = videos[activeIndex] || null;

  useEffect(() => {
    safeSet(STORAGE_KEYS.searchHistory, searchHistory.slice(0, 5));
  }, [searchHistory]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.watchlist, watchlist);
  }, [watchlist]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.interactions, interactions);
  }, [interactions]);

  useEffect(() => {
    const history = safeGet(STORAGE_KEYS.watchHistory, []);
    const next = [
      {
        videoId: activeVideo?.id,
        timestamp: Date.now(),
      },
      ...history.filter((item) => item.videoId !== activeVideo?.id),
    ].slice(0, 30);

    if (activeVideo?.id) {
      safeSet(STORAGE_KEYS.watchHistory, next);
    }
  }, [activeVideo?.id]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) {
      return;
    }

    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    const theme = tg.themeParams || {};
    const root = document.documentElement;
    if (theme.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
    }
    if (theme.text_color) {
      root.style.setProperty('--tg-theme-text-color', theme.text_color);
    }
    if (theme.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
    }
    if (theme.button_color) {
      root.style.setProperty('--tg-theme-button-color', theme.button_color);
    }
    if (theme.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
    }
  }, []);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) {
      return;
    }

    const onBack = () => setPage('home');
    tg.BackButton.onClick(onBack);

    if (page === 'search') {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(onBack);
    };
  }, [page]);

  const fetchLivepeerAssets = async () => {
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
  };

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
          const currentId = videos[activeIndex]?.id;
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
  }, [reloadTick]);

  useEffect(() => {
    const requestReload = () => {
      setReloadTick((prev) => prev + 1);
    };

    const onStorage = (event) => {
      if (!event.key || LOCAL_VIDEO_KEY_SET.has(event.key)) {
        requestReload();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestReload();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', requestReload);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', requestReload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const checkNftAccess = async (video, address) => {
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
  };

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
  }, [videos, wallet?.account?.address]);

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

  const updateInteraction = (videoId, updater) => {
    setInteractions((prev) => {
      const current = prev[videoId] || { liked: false, likes: 0, comments: 0, shares: 0 };
      return {
        ...prev,
        [videoId]: updater(current),
      };
    });
  };

  const getInteraction = (video) => {
    const current = interactions[video.id] || { liked: false, likes: 0, comments: 0, shares: 0 };
    return {
      liked: current.liked,
      likes: video.likes + current.likes,
      comments: current.comments,
      shares: current.shares,
    };
  };

  const toggleLike = (video) => {
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
  };

  const openComment = (video) => {
    const comment = window.prompt(`给《${video.title}》写条评论`);
    if (!comment || !comment.trim()) {
      return;
    }

    updateInteraction(video.id, (current) => ({
      ...current,
      comments: current.comments + 1,
    }));
  };

  const shareVideo = async (video) => {
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
  };

  const toggleWatchlist = (video) => {
    setWatchlist((prev) =>
      prev.includes(video.id)
        ? prev.filter((id) => id !== video.id)
        : [video.id, ...prev]
    );
  };

  const onFeedScroll = () => {
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
  };

  const navigateToHomeVideo = (videoId, keyword = '') => {
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
  };

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

  const openSearch = () => {
    setPage('search');
    setSearchQuery('');
  };

  const requestUnlock = async (video) => {
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
  };

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
