import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import HomeFeed from './components/HomeFeed';
import SearchPage from './components/SearchPage';
import usePersistentState from './hooks/usePersistentState';
import useTelegramSetup from './hooks/useTelegramSetup';
import useVideoReloadSync from './hooks/useVideoReloadSync';
import { showRewardedAd } from './lib/adsgram';
import {
  BUILTIN_DEMO_VIDEOS,
  HOT_KEYWORDS,
  LOCAL_VIDEO_KEY_SET,
  LOCAL_VIDEO_VERSION_KEY,
  formatCount,
  normalizeAsset,
  readLegacyVideos,
} from './lib/videoData';

const STORAGE_KEYS = {
  searchHistory: 'cinenext_search_history',
  watchlist: 'cinenext_watchlist',
  interactions: 'cinenext_interactions',
  adUnlocks: 'cinenext_ad_unlocks',
};
const API_KEY_STORAGE = 'cinenext_livepeer_api_key';

const getTelegramWebApp = () => window.Telegram?.WebApp || null;
const getTelegramInitData = () => getTelegramWebApp()?.initData || '';

const postApi = async (url, payload = {}) => {
  const initData = getTelegramInitData();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
    },
    body: JSON.stringify(payload),
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result?.error || '请求失败');
  }

  return result;
};

const getSeriesKey = (video) => {
  const key = String(video?.seriesName || video?.title || video?.id || '').trim();
  return key || '未命名短剧';
};

const buildSeriesFeed = (rawVideos, selectedEpisodeMap = {}) => {
  const groups = new Map();

  rawVideos.forEach((video) => {
    const seriesKey = getSeriesKey(video);
    if (!groups.has(seriesKey)) {
      groups.set(seriesKey, []);
    }
    groups.get(seriesKey).push({ ...video, seriesKey });
  });

  return [...groups.entries()]
    .map(([seriesKey, episodes]) => {
      const sortedEpisodes = [...episodes].sort((left, right) => {
        if (left.episode !== right.episode) {
          return left.episode - right.episode;
        }
        return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
      });

      const withNumberedEpisodes = sortedEpisodes.map((item, index) => {
        const parsedEpisode = Number(item.episode || 0);
        return {
          ...item,
          episode: parsedEpisode > 0 ? parsedEpisode : index + 1,
        };
      });

      const uniqueEpisodeCount = new Set(withNumberedEpisodes.map((item) => item.episode)).size;
      const normalizedEpisodes = uniqueEpisodeCount === withNumberedEpisodes.length
        ? withNumberedEpisodes
        : withNumberedEpisodes.map((item, index) => ({
            ...item,
            episode: index + 1,
          }));

      const preferredEpisodeId = selectedEpisodeMap[seriesKey];
      const selectedEpisode = normalizedEpisodes.find((item) => item.id === preferredEpisodeId)
        || normalizedEpisodes[normalizedEpisodes.length - 1]
        || normalizedEpisodes[0];

      const totalEpisodes = normalizedEpisodes.length;
      const latestEpisode = normalizedEpisodes[normalizedEpisodes.length - 1]?.episode || selectedEpisode?.episode || 1;
      const isCompleted = normalizedEpisodes.some((item) => item.isCompleted === true);

      return {
        ...selectedEpisode,
        id: `series:${seriesKey}`,
        seriesKey,
        seriesTitle: seriesKey,
        selectedEpisodeId: selectedEpisode?.id || '',
        totalEpisodes,
        latestEpisode,
        isCompleted,
        seriesSummary: isCompleted
          ? `全集${totalEpisodes}集 · 完结`
          : `全集${totalEpisodes}集 · 更新至${latestEpisode}集`,
        episodes: normalizedEpisodes.map((item) => ({
          id: item.id,
          title: item.title,
          episode: item.episode,
        })),
      };
    })
    .sort((left, right) => left.seriesTitle.localeCompare(right.seriesTitle, 'zh-CN'));
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
  const [searchHistory, setSearchHistory] = usePersistentState(STORAGE_KEYS.searchHistory, []);
  const [watchlist, setWatchlist] = usePersistentState(STORAGE_KEYS.watchlist, []);
  const [interactions, setInteractions] = usePersistentState(STORAGE_KEYS.interactions, {});
  const [adUnlocks, setAdUnlocks] = usePersistentState(STORAGE_KEYS.adUnlocks, {});
  const [accessMap, setAccessMap] = useState({});

  const [unlockingId, setUnlockingId] = useState('');
  const [rewardingId, setRewardingId] = useState('');
  const [selectedEpisodeMap, setSelectedEpisodeMap] = useState({});
  const [reloadTick, setReloadTick] = useState(0);

  const feedRef = useRef(null);
  const pendingScrollIndexRef = useRef(null);
  const scrollRafRef = useRef(0);

  const homeVideos = useMemo(() => buildSeriesFeed(videos, selectedEpisodeMap), [videos, selectedEpisodeMap]);
  const activeVideo = homeVideos[activeIndex] || null;
  const currentVideoIdRef = useRef(null);
  const currentSeriesKeyRef = useRef('');

  useTelegramSetup(page, setPage);

  useEffect(() => {
    if (searchHistory.length > 5) {
      setSearchHistory((prev) => prev.slice(0, 5));
    }
  }, [searchHistory, setSearchHistory]);

  useEffect(() => {
    currentVideoIdRef.current = activeVideo?.id || null;
    currentSeriesKeyRef.current = activeVideo?.seriesKey || '';
  }, [activeVideo?.id]);

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) {
      return;
    }

    postApi('/api/auth/telegram', { initData }).catch(() => {
      // ignore auth sync error in non-telegram or unconfigured backend
    });
  }, []);

  const fetchLivepeerAssets = useCallback(async () => {
    const apiKey = import.meta.env.VITE_LIVEPEER_API_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
    if (!apiKey) {
      return [];
    }

    const parseAssetPage = (payload) => {
      if (Array.isArray(payload)) {
        return { items: payload, nextCursor: '', hasNext: false };
      }

      const items = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.assets)
          ? payload.assets
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

      const nextCursor =
        payload?.nextCursor || payload?.next_cursor || payload?.meta?.nextCursor || payload?.meta?.next_cursor || '';

      const hasNext = Boolean(payload?.hasNextPage || payload?.hasNext || payload?.meta?.hasNextPage || nextCursor);

      return {
        items,
        nextCursor: String(nextCursor || ''),
        hasNext,
      };
    };

    const requestPage = async ({ page, cursor }) => {
      const query = new URLSearchParams();
      query.set('limit', '100');
      query.set('page', String(page));
      if (cursor) {
        query.set('cursor', cursor);
      }

      const response = await fetch(`https://livepeer.studio/api/asset?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取 Livepeer 资源失败');
      }

      return response.json();
    };

    const rawItems = [];
    let page = 1;
    let cursor = '';

    for (let index = 0; index < 50; index += 1) {
      const payload = await requestPage({ page, cursor });
      const parsed = parseAssetPage(payload);

      if (!parsed.items.length) {
        break;
      }

      rawItems.push(...parsed.items);

      if (parsed.nextCursor) {
        cursor = parsed.nextCursor;
        page += 1;
        continue;
      }

      if (!parsed.hasNext || parsed.items.length < 100) {
        break;
      }

      page += 1;
    }

    const uniqueAssets = [];
    const seen = new Set();
    rawItems.forEach((item) => {
      const id = String(item?.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      uniqueAssets.push(item);
    });

    return uniqueAssets
      .map(normalizeAsset)
      .filter(Boolean)
      .sort((left, right) => {
        const leftSeries = String(left.seriesName || left.title || '');
        const rightSeries = String(right.seriesName || right.title || '');

        if (leftSeries !== rightSeries) {
          return leftSeries.localeCompare(rightSeries, 'zh-CN');
        }

        if (left.episode !== right.episode) {
          return left.episode - right.episode;
        }

        return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
      });
  }, []);

  const fetchBackendFeed = useCallback(async () => {
    const response = await fetch('/api/content?action=feed');
    if (!response.ok) {
      throw new Error('获取后台视频源失败');
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.videos) ? payload.videos : [];

    return items
      .map((item, index) => normalizeAsset(item, index))
      .filter(Boolean)
      .sort((left, right) => {
        const leftSeries = String(left.seriesName || left.title || '');
        const rightSeries = String(right.seriesName || right.title || '');

        if (leftSeries !== rightSeries) {
          return leftSeries.localeCompare(rightSeries, 'zh-CN');
        }

        return left.episode - right.episode;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      setLoading(true);
      setLoadError('');

      try {
        let backendVideos = [];
        try {
          backendVideos = await fetchBackendFeed();
        } catch {
          backendVideos = [];
        }

        let remoteVideos = [];
        let remoteError = '';

        try {
          remoteVideos = await fetchLivepeerAssets();
        } catch (error) {
          remoteError = error instanceof Error ? error.message : '获取云端资源失败';
        }

        const legacyVideos = readLegacyVideos();

        const remoteMap = new Map();
        backendVideos.forEach((video) => {
          if (!remoteMap.has(video.playbackId)) {
            remoteMap.set(video.playbackId, video);
          }
        });

        remoteVideos.forEach((video) => {
          if (!remoteMap.has(video.playbackId)) {
            remoteMap.set(video.playbackId, video);
          }
        });

        const mergedVideos = [...remoteMap.values(), ...legacyVideos];
        const nextVideos = mergedVideos.length > 0
          ? mergedVideos
          : BUILTIN_DEMO_VIDEOS.map((video, index) => normalizeAsset(video, index) || video).filter(Boolean);

        if (!cancelled) {
          const currentSeriesKey = currentSeriesKeyRef.current;
          const nextSeriesVideos = buildSeriesFeed(nextVideos, {});
          const nextIndex = currentSeriesKey
            ? Math.max(0, nextSeriesVideos.findIndex((video) => video.seriesKey === currentSeriesKey))
            : 0;

          setVideos(nextVideos);
          setActiveIndex(nextIndex);
          if (mergedVideos.length === 0 && remoteError) {
            setLoadError(`已切换演示视频（${remoteError}）`);
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
  }, [reloadTick, fetchBackendFeed, fetchLivepeerAssets]);

  useEffect(() => {
    if (homeVideos.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((prev) => Math.min(Math.max(prev, 0), homeVideos.length - 1));
  }, [homeVideos.length]);

  const requestReload = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useVideoReloadSync(requestReload, LOCAL_VIDEO_KEY_SET, LOCAL_VIDEO_VERSION_KEY);

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

    return homeVideos.filter((video) => {
      const actor = video.actors.join(' ').toLowerCase();
      const tags = video.keywords.join(' ').toLowerCase();
      return (
        video.title.toLowerCase().includes(keyword) ||
        actor.includes(keyword) ||
        tags.includes(keyword)
      );
    });
  }, [homeVideos, searchQuery]);

  const searchSuggestions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    return homeVideos
      .filter((video) => video.title.toLowerCase().includes(keyword))
      .slice(0, 6)
      .map((video) => video.title);
  }, [homeVideos, searchQuery]);

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

    postApi('/api/interactions/toggle-like', { videoId: video.id })
      .then((result) => {
        if (typeof result?.likes !== 'number' || typeof result?.liked !== 'boolean') {
          return;
        }

        setInteractions((prev) => {
          const current = prev[video.id] || { liked: false, likes: 0, comments: 0, shares: 0 };
          return {
            ...prev,
            [video.id]: {
              ...current,
              liked: result.liked,
              likes: Math.max(0, result.likes - Number(video.likes || 0)),
            },
          };
        });
      })
      .catch(() => {
        // keep local fallback behavior
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

    postApi('/api/comments/create', {
      videoId: video.id,
      content: comment.trim(),
    })
      .then((result) => {
        if (typeof result?.comments !== 'number') {
          return;
        }

        setInteractions((prev) => {
          const current = prev[video.id] || { liked: false, likes: 0, comments: 0, shares: 0 };
          return {
            ...prev,
            [video.id]: {
              ...current,
              comments: result.comments,
            },
          };
        });
      })
      .catch(() => {
        // keep local fallback behavior
      });
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

      postApi('/api/share/track', {
        videoId: video.id,
      })
        .then((result) => {
          if (typeof result?.shares !== 'number') {
            return;
          }

          setInteractions((prev) => {
            const current = prev[video.id] || { liked: false, likes: 0, comments: 0, shares: 0 };
            return {
              ...prev,
              [video.id]: {
                ...current,
                shares: result.shares,
              },
            };
          });
        })
        .catch(() => {
          // keep local fallback behavior
        });
    } catch {
      // ignore canceled share
    }
  }, [updateInteraction]);

  const reportAdsEvent = useCallback((video, eventType, payload = {}) => {
    const telegramId = Number(getTelegramWebApp()?.initDataUnsafe?.user?.id || 0) || null;

    postApi('/api/adsgram/event', {
      videoId: video?.id || null,
      eventType,
      telegramId,
      payload,
    }).catch(() => {
      // ignore ad telemetry errors
    });
  }, []);

  const watchAdToUnlock = useCallback(async (video) => {
    if (!video?.id) {
      return;
    }

    const blockId = String(import.meta.env.VITE_ADSGRAM_BLOCK_ID || '').trim();
    if (!blockId) {
      window.alert('广告配置未完成，请设置 VITE_ADSGRAM_BLOCK_ID');
      return;
    }

    try {
      setRewardingId(video.id);
      reportAdsEvent(video, 'impression', { blockId });
      const result = await showRewardedAd({ blockId });
      reportAdsEvent(video, 'reward', { blockId, result: result || null });

      setAdUnlocks((prev) => ({
        ...prev,
        [video.id]: true,
      }));
    } catch (error) {
      reportAdsEvent(video, 'error', {
        blockId,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    } finally {
      setRewardingId('');
    }
  }, [reportAdsEvent, setAdUnlocks]);

  const reportPlaybackEvent = useCallback((video, eventType, positionSeconds = 0, payload = {}) => {
    if (!video?.id || !eventType) {
      return;
    }

    postApi('/api/playback/event', {
      videoId: video.id,
      eventType,
      positionSeconds,
      payload,
    }).catch(() => {
      // ignore telemetry errors
    });
  }, []);

  const toggleWatchlist = useCallback((video) => {
    setWatchlist((prev) =>
      prev.includes(video.id)
        ? prev.filter((id) => id !== video.id)
        : [video.id, ...prev]
    );
  }, [setWatchlist]);

  const onFeedScroll = useCallback(() => {
    if (!feedRef.current || homeVideos.length === 0) {
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
      const safeIndex = Math.min(homeVideos.length - 1, Math.max(0, nextIndex));
      setActiveIndex((prev) => (prev === safeIndex ? prev : safeIndex));
    });
  }, [homeVideos.length]);

  const navigateToHomeVideo = useCallback((videoId, keyword = '') => {
    const idx = homeVideos.findIndex((video) => video.id === videoId);
    if (idx < 0) {
      return;
    }

    if (keyword.trim()) {
      setSearchHistory((prev) => [keyword.trim(), ...prev.filter((item) => item !== keyword.trim())].slice(0, 5));
    }

    setPage('home');
    setActiveIndex(idx);
    pendingScrollIndexRef.current = idx;
  }, [homeVideos, setSearchHistory]);

  const selectSeriesEpisode = useCallback((seriesKey, episodeId) => {
    if (!seriesKey || !episodeId) {
      return;
    }

    setSelectedEpisodeMap((prev) => ({
      ...prev,
      [seriesKey]: episodeId,
    }));
  }, []);

  const selectRelativeEpisode = useCallback((seriesKey, currentEpisodeId, step) => {
    const series = homeVideos.find((item) => item.seriesKey === seriesKey);
    if (!series || !Array.isArray(series.episodes) || series.episodes.length <= 1) {
      return;
    }

    const currentIndex = Math.max(0, series.episodes.findIndex((item) => item.id === currentEpisodeId));
    const nextIndex = Math.min(series.episodes.length - 1, Math.max(0, currentIndex + step));
    const nextEpisodeId = series.episodes[nextIndex]?.id;
    if (!nextEpisodeId || nextEpisodeId === currentEpisodeId) {
      return;
    }

    setSelectedEpisodeMap((prev) => ({
      ...prev,
      [seriesKey]: nextEpisodeId,
    }));
  }, [homeVideos]);

  const markNotInterested = useCallback((video) => {
    const seriesKey = video?.seriesKey || getSeriesKey(video);
    if (!seriesKey) {
      return;
    }

    setVideos((prev) => prev.filter((item) => getSeriesKey(item) !== seriesKey));
    setSelectedEpisodeMap((prev) => {
      if (!(seriesKey in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[seriesKey];
      return next;
    });

    reportPlaybackEvent(video, 'not_interested', 0, { seriesKey });
  }, [reportPlaybackEvent]);

  const reportVideo = useCallback((video) => {
    const reason = window.prompt(`举报《${video?.seriesTitle || video?.title || '该短剧'}》原因（选填）`);
    reportPlaybackEvent(video, 'report', 0, {
      seriesKey: video?.seriesKey || getSeriesKey(video),
      reason: String(reason || '').trim(),
    });
    window.alert('举报已提交，我们会尽快处理。');
  }, [reportPlaybackEvent]);

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
      const orderResult = await postApi('/api/orders/create', {
        videoId: video.id,
        amountTon,
        walletAddress: wallet?.account?.address || '',
      });

      const orderNo = String(orderResult?.order?.order_no || '');
      const payTo = String(orderResult?.payTo || target || '').trim();
      if (!orderNo || !payTo) {
        throw new Error('创建订单失败');
      }

      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: payTo,
            amount,
          },
        ],
      });

      await postApi('/api/orders/confirm', {
        orderNo,
        status: 'paid',
        proof: txResult,
        txHash: txResult?.boc || null,
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
          videos={homeVideos}
          loadError={loadError}
          tonConnectUI={tonConnectUI}
          wallet={wallet}
          openSearch={openSearch}
          feedRef={feedRef}
          onFeedScroll={onFeedScroll}
          activeIndex={activeIndex}
          getInteraction={getInteraction}
          accessMap={accessMap}
          adUnlocks={adUnlocks}
          unlockingId={unlockingId}
          rewardingId={rewardingId}
          requestUnlock={requestUnlock}
          watchAdToUnlock={watchAdToUnlock}
          toggleLike={toggleLike}
          openComment={openComment}
          shareVideo={shareVideo}
          reportPlaybackEvent={reportPlaybackEvent}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          onSelectEpisode={selectSeriesEpisode}
          onSelectRelativeEpisode={selectRelativeEpisode}
          onNotInterested={markNotInterested}
          onReportVideo={reportVideo}
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
