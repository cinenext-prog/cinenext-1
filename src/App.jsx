import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import VideoPlayer from './components/VideoPlayer';

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
  const touchStartYRef = useRef(null);
  const swipeLockRef = useRef(false);

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
          setVideos(nextVideos);
          setActiveIndex(0);
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
      if (!event.key || event.key === STORAGE_KEYS.legacyVideos) {
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

  const moveToIndex = (targetIndex) => {
    if (!feedRef.current || videos.length === 0) {
      return;
    }

    const safeIndex = Math.min(videos.length - 1, Math.max(0, targetIndex));
    if (safeIndex === activeIndex) {
      return;
    }

    setActiveIndex(safeIndex);
    feedRef.current.scrollTo({
      top: feedRef.current.clientHeight * safeIndex,
      behavior: 'smooth',
    });
  };

  const moveByDirection = (direction) => {
    if (swipeLockRef.current) {
      return;
    }

    swipeLockRef.current = true;
    moveToIndex(activeIndex + direction);

    window.setTimeout(() => {
      swipeLockRef.current = false;
    }, 360);
  };

  const onFeedTouchStart = (event) => {
    touchStartYRef.current = event.touches?.[0]?.clientY ?? null;
  };

  const onFeedTouchEnd = (event) => {
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;

    if (typeof startY !== 'number') {
      return;
    }

    const endY = event.changedTouches?.[0]?.clientY;
    if (typeof endY !== 'number') {
      return;
    }

    const deltaY = startY - endY;
    if (Math.abs(deltaY) < 36) {
      return;
    }

    moveByDirection(deltaY > 0 ? 1 : -1);
  };

  const onFeedWheel = (event) => {
    const deltaY = event.deltaY || 0;
    if (Math.abs(deltaY) < 8) {
      return;
    }

    event.preventDefault();
    moveByDirection(deltaY > 0 ? 1 : -1);
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

  const renderHome = () => {
    if (loading) {
      return <div className="state-view">加载中...</div>;
    }

    if (videos.length === 0) {
      return (
        <div className="state-view">
          <p>{loadError || '暂无视频内容'}</p>
        </div>
      );
    }

    return (
      <>
        <header className="home-topbar">
          <div className="logo">CineNext</div>
          <div className="topbar-actions">
            <button type="button" className="wallet-btn" onClick={() => tonConnectUI.openModal()}>
              {wallet ? '钱包已连接' : '连接钱包'}
            </button>
            <button type="button" className="icon-btn" onClick={openSearch} aria-label="搜索">
              🔍
            </button>
          </div>
        </header>

        <div
          className="feed-scroll"
          ref={feedRef}
          onTouchStart={onFeedTouchStart}
          onTouchEnd={onFeedTouchEnd}
          onWheel={onFeedWheel}
        >
          {videos.map((video, index) => {
            const interaction = getInteraction(video);
            const blocked = video.unlockType === 'nft' && !accessMap[video.id];
            const lockLabel = wallet
              ? `需 NFT 解锁 · ${video.price} TON`
              : '连接钱包后解锁观看';

            return (
              <section key={video.id} className="feed-item">
                <VideoPlayer
                  sourceUrl={video.playbackUrl}
                  poster={video.coverUrl}
                  title={video.title}
                  active={index === activeIndex}
                  preload={Math.abs(index - activeIndex) <= 3}
                  blocked={blocked}
                  lockLabel={unlockingId === video.id ? '解锁处理中...' : lockLabel}
                  onUnlock={() => requestUnlock(video)}
                />

                <div className="video-meta">
                  <h2>{video.title}</h2>
                  <p>第 {video.episode} 集</p>
                  <div className="meta-tags">
                    <span>热度 {formatCount(video.views)}</span>
                    <span>点赞 {formatCount(interaction.likes)}</span>
                    <span className={video.unlockType === 'nft' ? 'tag-lock' : 'tag-free'}>
                      {video.unlockType === 'nft' ? '需 NFT 解锁' : '免费'}
                    </span>
                  </div>
                </div>

                <div className="video-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => toggleLike(video)} className={interaction.liked ? 'active' : ''}>
                    ❤ {formatCount(interaction.likes)}
                  </button>
                  <button type="button" onClick={() => openComment(video)}>
                    💬 {formatCount(interaction.comments)}
                  </button>
                  <button type="button" onClick={() => shareVideo(video)}>
                    ↗ {formatCount(interaction.shares)}
                  </button>
                  <button type="button" onClick={() => toggleWatchlist(video)}>
                    {watchlist.includes(video.id) ? '★ 已追' : '☆ 追剧'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  };

  const renderSearch = () => {
    return (
      <section className="search-page">
        <div className="search-header">
          <input
            className="search-input"
            placeholder="搜索剧名 / 演员 / 关键词"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button type="button" className="cancel-btn" onClick={() => setPage('home')}>
            取消
          </button>
        </div>

        {searchQuery.trim() && searchSuggestions.length > 0 && (
          <div className="suggestions">
            {searchSuggestions.map((word) => (
              <button key={word} type="button" onClick={() => setSearchQuery(word)}>
                {word}
              </button>
            ))}
          </div>
        )}

        {!searchQuery.trim() && (
          <>
            <div className="search-block">
              <div className="block-title">
                <h3>搜索历史</h3>
                <button type="button" onClick={() => setSearchHistory([])}>清空</button>
              </div>
              <div className="chips">
                {searchHistory.length === 0 ? (
                  <p className="empty-note">暂无搜索历史</p>
                ) : (
                  searchHistory.map((word) => (
                    <button key={word} type="button" onClick={() => setSearchQuery(word)}>{word}</button>
                  ))
                )}
              </div>
            </div>

            <div className="search-block">
              <h3>热门搜索</h3>
              <div className="chips">
                {HOT_KEYWORDS.map((word) => (
                  <button key={word} type="button" onClick={() => setSearchQuery(word)}>{word}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {searchQuery.trim() && (
          <div className="result-grid">
            {homeSearchResults.length === 0 ? (
              <div className="empty-note">未找到相关短剧</div>
            ) : (
              homeSearchResults.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  className="result-card"
                  onClick={() => navigateToHomeVideo(video.id, searchQuery)}
                >
                  <img src={video.coverUrl} alt={video.title} loading="lazy" />
                  <div className="result-meta">
                    <h4>{video.title}</h4>
                    <p>{video.actors[0] || '主演待更新'}</p>
                    <span>热度 {formatCount(video.views)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    );
  };

  return <div className="app-root">{page === 'home' ? renderHome() : renderSearch()}</div>;
}

export default App;
