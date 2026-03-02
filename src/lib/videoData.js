import { safeGet } from './storage';

export const HOT_KEYWORDS = ['短剧', '逆袭', '豪门', '重生', '甜宠'];

export const BUILTIN_DEMO_VIDEOS = [
  {
    id: 'demo-x36xhzz-1',
    playbackId: 'demo-x36xhzz-1',
    playbackUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    coverUrl: 'https://image.mux.com/x36xhzz/thumbnail.jpg?time=2',
    title: '演示短剧 · 先导片',
    episode: 1,
    likes: 2680,
    views: 39800,
    unlockType: 'free',
    keywords: ['演示', '剧情'],
  },
  {
    id: 'demo-test001-2',
    playbackId: 'demo-test001-2',
    playbackUrl: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=640&q=80',
    title: '演示短剧 · 高能反转',
    episode: 2,
    likes: 3120,
    views: 52100,
    unlockType: 'free',
    keywords: ['反转', '悬疑'],
  },
  {
    id: 'demo-tears-3',
    playbackId: 'demo-tears-3',
    playbackUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    coverUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=640&q=80',
    title: '演示短剧 · 完整片段',
    episode: 3,
    likes: 4890,
    views: 73400,
    unlockType: 'free',
    keywords: ['动作', '科幻'],
  },
];

export const LOCAL_VIDEO_KEYS = [
  'cinenext_videos',
  'legacyVideos',
  'cinenext_admin_videos',
];
export const LOCAL_VIDEO_KEY_SET = new Set(LOCAL_VIDEO_KEYS);
export const LOCAL_VIDEO_VERSION_KEY = 'cinenext_videos_version';

const toText = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const getPlaybackPrefix = () => {
  const configured = String(import.meta.env.VITE_LIVEPEER_RAW_HLS_PREFIX || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return 'https://livepeercdn.com/hls';
};

export const toPlaybackUrl = (playbackId) => `${getPlaybackPrefix()}/${playbackId}/index.m3u8`;
export const toCoverUrl = (playbackId) => `https://livepeer.studio/thumbnail/${playbackId}.png`;

const pickPlaybackId = (asset) => {
  if (typeof asset?.playbackId === 'string' && asset.playbackId.trim()) {
    return asset.playbackId.trim();
  }

  if (Array.isArray(asset?.playbackIds) && asset.playbackIds.length > 0) {
    const first = asset.playbackIds[0];
    if (typeof first === 'string' && first.trim()) {
      return first.trim();
    }
    if (typeof first?.id === 'string' && first.id.trim()) {
      return first.id.trim();
    }
  }

  if (typeof asset?.playback_id === 'string' && asset.playback_id.trim()) {
    return asset.playback_id.trim();
  }

  return '';
};

const parseNameMeta = (name) => {
  const raw = String(name || '').trim();
  const matched = raw.match(/^(.*?)\s*第\s*(\d+)\s*集\s*(.*)$/i);

  if (!matched) {
    return {
      seriesName: raw || '未命名短剧',
      episode: 1,
      title: raw || '未命名短剧 第1集',
    };
  }

  const seriesName = String(matched[1] || '').trim() || '未命名短剧';
  const episode = Math.max(1, Number(matched[2] || 1));

  return {
    seriesName,
    episode,
    title: `${seriesName} 第${episode}集`,
  };
};

export const normalizeAsset = (asset, index) => {
  const playbackId = pickPlaybackId(asset);
  if (!playbackId) {
    return null;
  }

  const explicitPlaybackUrl = toText(asset?.playbackUrl || asset?.playback_url).trim();

  const metadata = typeof asset?.meta === 'object' && asset?.meta
    ? asset.meta
    : typeof asset?.metadata === 'object' && asset?.metadata
      ? asset.metadata
      : {};

  const nameMeta = parseNameMeta(asset?.name || metadata?.title || '');
  const episode = Number(metadata.episode || metadata.currentEpisode || nameMeta.episode || index + 1) || index + 1;
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
    playbackUrl: explicitPlaybackUrl || toPlaybackUrl(playbackId),
    coverUrl: toCoverUrl(playbackId),
    title: toText(asset?.name || metadata.title, nameMeta.title || `短剧 ${index + 1}`),
    seriesName: nameMeta.seriesName,
    episode,
    createdAt: String(asset?.createdAt || asset?.created_at || ''),
    likes: Number(metadata.likes || Math.floor(2000 + Math.random() * 9000)),
    views: Number(metadata.views || Math.floor(30000 + Math.random() * 300000)),
    actors: actorList,
    keywords: keywordList,
    unlockType,
    nftCollectionAddress,
    price,
  };
};

export const normalizeLegacyVideo = (video, index) => {
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
    coverUrl: toText(video?.coverUrl, toCoverUrl(playbackId)),
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

export const readLegacyVideos = () => {
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

export const formatCount = (value) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }
  return String(value);
};
