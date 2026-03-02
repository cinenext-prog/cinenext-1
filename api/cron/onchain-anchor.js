import { ensureMethod, parseJsonBody, badRequest } from '../_lib/http.js';
import { ensureDatabaseSchema } from '../_lib/schema.js';
import { query } from '../_lib/db.js';

const isAuthorized = (req) => {
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

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized anchor callback' });
  }

  try {
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
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to update anchor status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
