import { parseJsonBody, badRequest } from './_lib/http.js';
import { ensureDatabaseSchema } from './_lib/schema.js';
import { query } from './_lib/db.js';
import { buildMerkleRoot } from './_lib/hash.js';

const checkCronAuth = (req) => {
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) return false;

  const fromHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (fromHeader && fromHeader === expected) return true;

  const fromQuery = String(req.query?.secret || '').trim();
  return Boolean(fromQuery && fromQuery === expected);
};

const isAnchorAuthorized = (req) => {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return false;
  }

  const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (authHeader && authHeader === secret) {
    return true;
  }

  const callbackToken = String(req.headers['x-anchor-token'] || '').trim();
  const expectedToken = String(process.env.ONCHAIN_ANCHOR_TOKEN || '').trim();
  if (expectedToken && callbackToken && callbackToken === expectedToken) {
    return true;
  }

  return false;
};

const stringifyRecord = (record) =>
  [
    record.source,
    record.id,
    record.user_id || '',
    record.video_id || '',
    record.event_type || '',
    record.status || '',
    record.amount_ton || '',
    record.created_at,
  ].join('|');

const listDeltaRecords = async (fromTime, toTime) => {
  const likes = await query(
    `
    SELECT 'likes'::text AS source, user_id, video_id, created_at, NULL::text AS event_type, NULL::text AS status,
           NULL::numeric AS amount_ton, CONCAT('L-', user_id, '-', video_id, '-', EXTRACT(EPOCH FROM created_at)::bigint) AS id
    FROM likes
    WHERE created_at >= $1 AND created_at < $2
    `,
    [fromTime, toTime]
  );

  const comments = await query(
    `
    SELECT 'comments'::text AS source, user_id, video_id, created_at, NULL::text AS event_type, NULL::text AS status,
           NULL::numeric AS amount_ton, CONCAT('C-', id) AS id
    FROM comments
    WHERE created_at >= $1 AND created_at < $2
    `,
    [fromTime, toTime]
  );

  const shares = await query(
    `
    SELECT 'shares'::text AS source, user_id, video_id, created_at, NULL::text AS event_type, NULL::text AS status,
           NULL::numeric AS amount_ton, CONCAT('S-', id) AS id
    FROM shares
    WHERE created_at >= $1 AND created_at < $2
    `,
    [fromTime, toTime]
  );

  const ads = await query(
    `
    SELECT 'ad_events'::text AS source, user_id, video_id, created_at, event_type, NULL::text AS status,
           NULL::numeric AS amount_ton, CONCAT('A-', id) AS id
    FROM ad_events
    WHERE created_at >= $1 AND created_at < $2
    `,
    [fromTime, toTime]
  );

  const orders = await query(
    `
    SELECT 'orders'::text AS source, user_id, video_id, created_at, NULL::text AS event_type, status,
           amount_ton, CONCAT('O-', id) AS id
    FROM orders
    WHERE updated_at >= $1 AND updated_at < $2
    `,
    [fromTime, toTime]
  );

  return [...likes.rows, ...comments.rows, ...shares.rows, ...ads.rows, ...orders.rows].sort((left, right) =>
    String(left.id).localeCompare(String(right.id))
  );
};

const tryAnchorBatch = async ({ batch, chainName }) => {
  const webhook = String(process.env.ONCHAIN_ANCHOR_WEBHOOK || '').trim();
  if (!webhook) {
    return {
      anchored: false,
      reason: 'ONCHAIN_ANCHOR_WEBHOOK not configured',
    };
  }

  const token = String(process.env.ONCHAIN_ANCHOR_TOKEN || '').trim();

  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      batchId: batch.batch_id,
      rootHash: batch.root_hash,
      recordCount: batch.record_count,
      startTime: batch.start_time,
      endTime: batch.end_time,
      chainName,
    }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Anchor webhook failed with ${response.status}`);
  }

  const txHash = String(payload?.txHash || payload?.tx_hash || '').trim();
  if (!txHash) {
    throw new Error('Anchor webhook response missing txHash');
  }

  return {
    anchored: true,
    txHash,
    raw: payload,
  };
};

const runBatch = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!checkCronAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  await ensureDatabaseSchema();

  const lastBatchResult = await query('SELECT end_time FROM onchain_batches ORDER BY end_time DESC LIMIT 1');
  const now = new Date();
  const previousEndTime = lastBatchResult.rows[0]?.end_time
    ? new Date(lastBatchResult.rows[0].end_time)
    : new Date(now.getTime() - 60 * 60 * 1000);

  const records = await listDeltaRecords(previousEndTime, now);
  const merkleRoot = buildMerkleRoot(records.map(stringifyRecord));

  const batchId = `batch-${now.toISOString().replace(/[:.]/g, '-')}`;
  const chainName = String(process.env.CHAIN_NAME || 'TON').trim();

  const { rows } = await query(
    `
    INSERT INTO onchain_batches (batch_id, start_time, end_time, root_hash, record_count, chain_name, status, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, 'anchored_pending', $7::jsonb)
    RETURNING id, batch_id, start_time, end_time, root_hash, record_count, status
    `,
    [
      batchId,
      previousEndTime,
      now,
      merkleRoot,
      records.length,
      chainName,
      JSON.stringify({ sampleIds: records.slice(0, 20).map((item) => item.id) }),
    ]
  );

  const batch = rows[0];
  let anchorResult;

  try {
    anchorResult = await tryAnchorBatch({ batch, chainName });
  } catch (error) {
    anchorResult = {
      anchored: false,
      reason: error instanceof Error ? error.message : 'Anchor failed',
    };
  }

  if (anchorResult.anchored) {
    const updated = await query(
      `
      UPDATE onchain_batches
      SET status = 'anchored',
          tx_hash = $2,
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
      WHERE batch_id = $1
      RETURNING id, batch_id, start_time, end_time, root_hash, record_count, status, tx_hash
      `,
      [batch.batch_id, anchorResult.txHash, JSON.stringify({ anchorPayload: anchorResult.raw || null })]
    );

    return res.status(200).json({
      batch: updated.rows[0],
      note: 'Batch anchored successfully.',
    });
  }

  return res.status(200).json({
    batch,
    note: anchorResult.reason || 'Root hash prepared; waiting for external anchor callback.',
  });
};

const anchorBatch = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!isAnchorAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized anchor callback' });
  }

  await ensureDatabaseSchema();

  const body = parseJsonBody(req.body);
  const batchId = String(body.batchId || '').trim();
  const txHash = String(body.txHash || '').trim();
  const status = String(body.status || 'anchored').trim();

  if (!batchId || !txHash) {
    return badRequest(res, 'Missing required fields: batchId, txHash');
  }

  if (!['anchored', 'anchor_failed', 'anchored_pending'].includes(status)) {
    return badRequest(res, 'Invalid status');
  }

  const { rows } = await query(
    `
    UPDATE onchain_batches
    SET status = $2,
        tx_hash = $3,
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = NOW()
    WHERE batch_id = $1
    RETURNING id, batch_id, start_time, end_time, root_hash, record_count, status, tx_hash, updated_at
    `,
    [batchId, status, txHash, JSON.stringify({ callbackPayload: body })]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  return res.status(200).json({ batch: rows[0] });
};

export default async function handler(req, res) {
  try {
    const action = String(req.query?.action || '').trim().toLowerCase();

    if (action === 'onchain-batch') {
      return await runBatch(req, res);
    }

    if (action === 'onchain-anchor') {
      return await anchorBatch(req, res);
    }

    return res.status(404).json({ error: 'Unknown cron action' });
  } catch (error) {
    return res.status(500).json({
      error: 'Cron API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
