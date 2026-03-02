import { safeGet } from './storage';

export const HOT_KEYWORDS = ['短剧', '逆袭', '豪门', '重生', '甜宠'];

export const LOCAL_VIDEO_KEYS = [
  'cinenext_videos',
  'legacyVideos',
  'cinenext_admin_videos',
];
export const LOCAL_VIDEO_KEY_SET = new Set(LOCAL_VIDEO_KEYS);
export const LOCAL_VIDEO_VERSION_KEY = 'cinenext_videos_version';

const toText = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

export const toPlaybackUrl = (playbackId) => `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;
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
    playbackUrl: toPlaybackUrl(playbackId),
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
