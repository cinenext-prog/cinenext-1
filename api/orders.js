import crypto from 'crypto';
import { requireTelegramUser } from './_lib/auth.js';
import { badRequest, parseJsonBody } from './_lib/http.js';
import { query } from './_lib/db.js';

const createOrderNo = () => {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CNX-${Date.now()}-${suffix}`;
};

const createOrder = async (req, res, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
};

const confirmOrder = async (req, res, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
};

export default async function handler(req, res) {
  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const action = String(req.query?.action || '').trim().toLowerCase();

    if (action === 'create') {
      return await createOrder(req, res, auth);
    }

    if (action === 'confirm') {
      return await confirmOrder(req, res, auth);
    }

    return res.status(404).json({ error: 'Unknown orders action' });
  } catch (error) {
    return res.status(500).json({
      error: 'Orders API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
