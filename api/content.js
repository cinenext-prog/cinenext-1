import { badRequest, parseJsonBody } from './_lib/http.js';
import { ensureDatabaseSchema } from './_lib/schema.js';
import { query } from './_lib/db.js';

const getAdminAuthState = (req) => {
  const expected = String(process.env.ADMIN_WRITE_TOKEN || '').trim();
  const provided = String(req.headers['x-admin-token'] || '').trim();

  if (!expected) {
    return {
      ok: false,
      reason: 'ADMIN_WRITE_TOKEN not configured on server',
      expectedLength: 0,
      providedLength: provided.length,
    };
  }

  if (!provided) {
    return {
      ok: false,
      reason: 'X-Admin-Token header is missing',
      expectedLength: expected.length,
      providedLength: 0,
    };
  }

  if (provided !== expected) {
    return {
      ok: false,
      reason: 'X-Admin-Token does not match ADMIN_WRITE_TOKEN',
      expectedLength: expected.length,
      providedLength: provided.length,
    };
  }

  return {
    ok: true,
    reason: 'ok',
    expectedLength: expected.length,
    providedLength: provided.length,
  };
};

const parseNameInfo = (name) => {
  const text = String(name || '').trim();
  const matched = text.match(/^(.*?)\s*第\s*(\d+)\s*集\s*(.*)$/i);

  if (!matched) {
    return {
      seriesName: text || '未分组剧名',
      episodeNumber: 1,
    };
  }

  return {
    seriesName: String(matched[1] || '').trim() || '未分组剧名',
    episodeNumber: Math.max(1, Number(matched[2] || 1)),
  };
};

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

const pickPlaybackUrl = (asset) => {
  if (typeof asset?.playbackUrl === 'string' && asset.playbackUrl.trim()) {
    return asset.playbackUrl.trim();
  }

  if (typeof asset?.playback_url === 'string' && asset.playback_url.trim()) {
    return asset.playback_url.trim();
  }

  if (typeof asset?.source?.playbackUrl === 'string' && asset.source.playbackUrl.trim()) {
    return asset.source.playbackUrl.trim();
  }

  if (typeof asset?.source?.playback_url === 'string' && asset.source.playback_url.trim()) {
    return asset.source.playback_url.trim();
  }

  return '';
};

const toPlaybackUrl = (playbackId) => {
  const prefix = String(process.env.LIVEPEER_RAW_HLS_PREFIX || '').trim();
  const normalizedPrefix = prefix ? prefix.replace(/\/+$/, '') : 'https://livepeercdn.com/hls';
  return `${normalizedPrefix}/${playbackId}/index.m3u8`;
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const upsertDramaBySlug = async ({ slug, title, synopsis = '', status = 'published' }) => {
  const { rows } = await query(
    `
    INSERT INTO dramas (slug, title, synopsis, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET
      title = EXCLUDED.title,
      synopsis = EXCLUDED.synopsis,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING id, slug, title
    `,
    [slug, title, synopsis, status]
  );

  return rows[0];
};

const listLibrary = async (res) => {
  const { rows } = await query(
    `
    SELECT
      d.id AS drama_id,
      d.slug,
      d.title AS drama_title,
      d.status AS drama_status,
      e.id AS episode_id,
      e.episode_number,
      e.title AS episode_title,
      e.playback_id,
      e.playback_url,
      e.livepeer_asset_id,
      e.price_ton,
      e.is_free,
      e.updated_at
    FROM dramas d
    LEFT JOIN episodes e ON e.drama_id = d.id
    ORDER BY d.updated_at DESC, e.episode_number ASC
    `
  );

  const dramaMap = new Map();
  rows.forEach((row) => {
    if (!dramaMap.has(row.drama_id)) {
      dramaMap.set(row.drama_id, {
        id: row.drama_id,
        slug: row.slug,
        title: row.drama_title,
        status: row.drama_status,
        episodes: [],
      });
    }

    if (row.episode_id) {
      dramaMap.get(row.drama_id).episodes.push({
        id: row.episode_id,
        episodeNumber: row.episode_number,
        title: row.episode_title,
        playbackId: row.playback_id,
        playbackUrl: row.playback_url,
        livepeerAssetId: row.livepeer_asset_id,
        priceTon: row.price_ton,
        isFree: row.is_free,
        updatedAt: row.updated_at,
      });
    }
  });

  return res.status(200).json({ dramas: [...dramaMap.values()] });
};

const listFeed = async (res) => {
  const { rows } = await query(
    `
    SELECT
      d.slug,
      d.title AS drama_title,
      e.id AS episode_id,
      e.episode_number,
      e.title AS episode_title,
      e.playback_id,
      e.playback_url,
      e.livepeer_asset_id,
      e.is_free,
      e.price_ton
    FROM episodes e
    JOIN dramas d ON d.id = e.drama_id
    WHERE e.playback_id IS NOT NULL AND e.playback_id <> ''
    ORDER BY d.updated_at DESC, e.episode_number ASC
    `
  );

  const videos = rows.map((row) => ({
    id: `db-${row.episode_id}`,
    playbackId: row.playback_id,
    playbackUrl: row.playback_url || (row.playback_id ? toPlaybackUrl(row.playback_id) : null),
    title: row.episode_title || `${row.drama_title} 第${row.episode_number}集`,
    seriesName: row.drama_title,
    episode: row.episode_number,
    unlockType: row.is_free ? 'free' : 'nft',
    price: row.price_ton ? String(row.price_ton) : '0.5',
    livepeerAssetId: row.livepeer_asset_id,
  }));

  return res.status(200).json({ videos });
};

const upsertDrama = async (req, res) => {
  const auth = getAdminAuthState(req);
  if (!auth.ok) {
    return res.status(403).json({ error: 'Forbidden', ...auth });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const title = String(body.title || '').trim();
  const slug = slugify(body.slug || title);

  if (!slug || !title) {
    return badRequest(res, 'Missing required fields: title');
  }

  const drama = await upsertDramaBySlug({
    slug,
    title,
    synopsis: String(body.synopsis || '').trim(),
    status: String(body.status || 'published').trim() || 'published',
  });

  return res.status(200).json({ drama });
};

const upsertEpisode = async (req, res) => {
  const auth = getAdminAuthState(req);
  if (!auth.ok) {
    return res.status(403).json({ error: 'Forbidden', ...auth });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const dramaTitle = String(body.dramaTitle || body.seriesName || '').trim();
  const dramaSlug = slugify(body.dramaSlug || body.slug || dramaTitle);
  const episodeNumber = Math.max(1, Number(body.episodeNumber || 1));

  if (!dramaSlug || !dramaTitle) {
    return badRequest(res, 'Missing required fields: dramaTitle');
  }

  const drama = await upsertDramaBySlug({
    slug: dramaSlug,
    title: dramaTitle,
    status: 'published',
  });

  const title = String(body.title || `${dramaTitle} 第${episodeNumber}集`).trim();
  const playbackId = String(body.playbackId || '').trim() || null;
  const playbackUrl = String(body.playbackUrl || '').trim() || (playbackId ? toPlaybackUrl(playbackId) : null);
  const livepeerAssetId = String(body.livepeerAssetId || '').trim() || null;
  const isFree = body.isFree !== false;
  const priceTon = Number(body.priceTon || 0);

  const { rows } = await query(
    `
    INSERT INTO episodes (drama_id, episode_number, title, playback_id, playback_url, livepeer_asset_id, is_free, price_ton, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (drama_id, episode_number)
    DO UPDATE SET
      title = EXCLUDED.title,
      playback_id = COALESCE(EXCLUDED.playback_id, episodes.playback_id),
      playback_url = COALESCE(EXCLUDED.playback_url, episodes.playback_url),
      livepeer_asset_id = COALESCE(EXCLUDED.livepeer_asset_id, episodes.livepeer_asset_id),
      is_free = EXCLUDED.is_free,
      price_ton = EXCLUDED.price_ton,
      updated_at = NOW()
    RETURNING id, drama_id, episode_number, title, playback_id, playback_url, livepeer_asset_id, is_free, price_ton
    `,
    [
      drama.id,
      episodeNumber,
      title,
      playbackId,
      playbackUrl,
      livepeerAssetId,
      isFree,
      Number.isFinite(priceTon) ? priceTon : 0,
    ]
  );

  return res.status(200).json({ episode: rows[0] });
};

const syncAssets = async (req, res) => {
  const auth = getAdminAuthState(req);
  if (!auth.ok) {
    return res.status(403).json({ error: 'Forbidden', ...auth });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const assets = Array.isArray(body.assets) ? body.assets : [];
  if (assets.length === 0) {
    return badRequest(res, 'Missing required field: assets');
  }

  let synced = 0;

  for (const item of assets) {
    const dramaTitle = String(item.seriesName || item.dramaTitle || '').trim();
    const episodeNumber = Math.max(1, Number(item.episodeNumber || 1));
    const livepeerAssetId = String(item.id || item.livepeerAssetId || '').trim() || null;
    const playbackId = String(item.playbackId || '').trim() || null;
    const playbackUrl = String(item.playbackUrl || '').trim() || (playbackId ? toPlaybackUrl(playbackId) : null);

    if (!dramaTitle) {
      continue;
    }

    const dramaSlug = slugify(item.dramaSlug || dramaTitle);
    const drama = await upsertDramaBySlug({ slug: dramaSlug, title: dramaTitle, status: 'published' });

    await query(
      `
      INSERT INTO episodes (drama_id, episode_number, title, playback_id, playback_url, livepeer_asset_id, is_free, price_ton, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0, NOW())
      ON CONFLICT (drama_id, episode_number)
      DO UPDATE SET
        title = EXCLUDED.title,
        playback_id = COALESCE(EXCLUDED.playback_id, episodes.playback_id),
        playback_url = COALESCE(EXCLUDED.playback_url, episodes.playback_url),
        livepeer_asset_id = COALESCE(EXCLUDED.livepeer_asset_id, episodes.livepeer_asset_id),
        updated_at = NOW()
      `,
      [
        drama.id,
        episodeNumber,
        String(item.name || item.title || `${dramaTitle} 第${episodeNumber}集`),
        playbackId,
        playbackUrl,
        livepeerAssetId,
      ]
    );

    synced += 1;
  }

  return res.status(200).json({ synced });
};

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

const importFromLivepeer = async (req, res) => {
  const auth = getAdminAuthState(req);
  if (!auth.ok) {
    return res.status(403).json({ error: 'Forbidden', ...auth });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const apiKey = String(body.livepeerApiKey || '').trim();

  if (!apiKey) {
    return badRequest(res, 'Missing required field: livepeerApiKey');
  }

  const limit = 100;
  const maxPages = 50;
  const rawItems = [];

  let page = 1;
  let cursor = '';

  for (let index = 0; index < maxPages; index += 1) {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('page', String(page));
    if (cursor) query.set('cursor', cursor);

    const response = await fetch(`https://livepeer.studio/api/asset?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const reason = await response.text();
      return res.status(400).json({ error: `Livepeer pull failed: ${reason || response.status}` });
    }

    const payload = await response.json();
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

    if (parsed.items.length < limit || !parsed.hasNext) {
      break;
    }

    page += 1;
  }

  const uniqueItems = [];
  const seen = new Set();
  rawItems.forEach((item) => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    uniqueItems.push(item);
  });

  let imported = 0;

  for (const item of uniqueItems) {
    const assetId = String(item?.id || '').trim();
    if (!assetId) continue;

    const playbackId = pickPlaybackId(item);
    if (!playbackId) continue;
    const playbackUrl = pickPlaybackUrl(item) || toPlaybackUrl(playbackId);

    const name = String(item?.name || '').trim();
    const parsedName = parseNameInfo(name);
    const dramaTitle = parsedName.seriesName;
    const dramaSlug = slugify(dramaTitle);

    const drama = await upsertDramaBySlug({
      slug: dramaSlug,
      title: dramaTitle,
      status: 'published',
    });

    await query(
      `
      INSERT INTO episodes (drama_id, episode_number, title, playback_id, playback_url, livepeer_asset_id, is_free, price_ton, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0, NOW())
      ON CONFLICT (drama_id, episode_number)
      DO UPDATE SET
        title = EXCLUDED.title,
        playback_id = COALESCE(EXCLUDED.playback_id, episodes.playback_id),
        playback_url = COALESCE(EXCLUDED.playback_url, episodes.playback_url),
        livepeer_asset_id = COALESCE(EXCLUDED.livepeer_asset_id, episodes.livepeer_asset_id),
        updated_at = NOW()
      `,
      [
        drama.id,
        parsedName.episodeNumber,
        name || `${dramaTitle} 第${parsedName.episodeNumber}集`,
        playbackId,
        playbackUrl,
        assetId,
      ]
    );

    imported += 1;
  }

  return res.status(200).json({ imported, totalPulled: uniqueItems.length });
};

const deleteByAssetId = async (req, res) => {
  const auth = getAdminAuthState(req);
  if (!auth.ok) {
    return res.status(403).json({ error: 'Forbidden', ...auth });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const livepeerAssetId = String(body.livepeerAssetId || body.assetId || '').trim();

  if (!livepeerAssetId) {
    return badRequest(res, 'Missing required field: livepeerAssetId');
  }

  const result = await query('DELETE FROM episodes WHERE livepeer_asset_id = $1', [livepeerAssetId]);
  return res.status(200).json({ deleted: result.rowCount || 0 });
};

export default async function handler(req, res) {
  try {
    await ensureDatabaseSchema();

    const action = String(req.query?.action || '').trim().toLowerCase();

    if (action === 'library') {
      return await listLibrary(res);
    }

    if (action === 'feed') {
      return await listFeed(res);
    }

    if (action === 'upsert-drama') {
      return await upsertDrama(req, res);
    }

    if (action === 'upsert-episode') {
      return await upsertEpisode(req, res);
    }

    if (action === 'sync-assets') {
      return await syncAssets(req, res);
    }

    if (action === 'import-livepeer') {
      return await importFromLivepeer(req, res);
    }

    if (action === 'delete-by-asset-id') {
      return await deleteByAssetId(req, res);
    }

    return res.status(404).json({ error: 'Unknown content action' });
  } catch (error) {
    return res.status(500).json({
      error: 'Content API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
