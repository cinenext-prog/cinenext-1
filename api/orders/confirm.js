import { requireTelegramUser } from '../_lib/auth.js';
import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { query } from '../_lib/db.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const body = parseJsonBody(req.body);
    const orderNo = String(body.orderNo || '').trim();
    const txHash = String(body.txHash || '').trim() || null;
    const status = String(body.status || 'paid').trim();
    const proof = body.proof || null;

    if (!orderNo) {
      return badRequest(res, 'Missing required field: orderNo');
    }

    if (!['paid', 'failed', 'canceled'].includes(status)) {
      return badRequest(res, 'Invalid status');
    }

    const { rows } = await query(
      `
      UPDATE orders
      SET status = $1,
          tx_hash = COALESCE($2, tx_hash),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('proof', $3::jsonb, 'confirmedAt', NOW()),
          updated_at = NOW()
      WHERE order_no = $4 AND user_id = $5
      RETURNING id, order_no, video_id, amount_ton, currency, status, tx_hash, updated_at
      `,
      [status, txHash, JSON.stringify(proof), orderNo, auth.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ order: rows[0] });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to confirm order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
