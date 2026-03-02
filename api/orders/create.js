import crypto from 'crypto';
import { requireTelegramUser } from '../_lib/auth.js';
import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { query } from '../_lib/db.js';

const createOrderNo = () => {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CNX-${Date.now()}-${suffix}`;
};

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
    const videoId = String(body.videoId || '').trim();
    const amountTon = Number(body.amountTon || 0);
    const walletAddress = String(body.walletAddress || '').trim() || null;

    if (!videoId) {
      return badRequest(res, 'Missing required field: videoId');
    }

    if (!Number.isFinite(amountTon) || amountTon <= 0) {
      return badRequest(res, 'Invalid amountTon');
    }

    const orderNo = createOrderNo();
    const { rows } = await query(
      `
      INSERT INTO orders (order_no, user_id, video_id, amount_ton, status, wallet_address, metadata)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6::jsonb)
      RETURNING id, order_no, video_id, amount_ton, currency, status, created_at
      `,
      [
        orderNo,
        auth.user.id,
        videoId,
        amountTon,
        walletAddress,
        JSON.stringify({ source: 'tonpay', createdBy: 'miniapp' }),
      ]
    );

    const merchantWallet = String(process.env.TONPAY_MERCHANT_WALLET || process.env.VITE_UNLOCK_CONTRACT || '').trim();

    return res.status(201).json({
      order: rows[0],
      payTo: merchantWallet || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
