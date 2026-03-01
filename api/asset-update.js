const LIVEPEER_API_BASE = 'https://livepeer.studio/api';

const parseJsonBody = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const pickApiKey = (req, body) => {
  const envKey = String(process.env.LIVEPEER_API_KEY || '').trim();
  if (envKey) return envKey;

  const bodyKey = String(body?.apiKey || '').trim();
  if (bodyKey) return bodyKey;

  const auth = String(req.headers.authorization || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const assetId = String(body?.assetId || '').trim();
  const name = String(body?.name || '').trim();
  const metadata = body?.metadata;

  if (!assetId) {
    return res.status(400).json({ error: 'Missing required field: assetId' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return res.status(400).json({ error: 'metadata must be a JSON object' });
  }

  const apiKey = pickApiKey(req, body);
  if (!apiKey) {
    return res.status(400).json({
      error: 'Missing Livepeer API key',
      hint: 'Set LIVEPEER_API_KEY in server env, or pass apiKey in request body.',
    });
  }

  try {
    const upstreamResponse = await fetch(`${LIVEPEER_API_BASE}/asset/${encodeURIComponent(assetId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, metadata }),
    });

    const text = await upstreamResponse.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json(
        parsed || {
          error: 'Livepeer asset patch failed',
          details: text || 'Unknown upstream error',
        }
      );
    }

    return res.status(200).json(parsed || { ok: true });
  } catch (error) {
    return res.status(502).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
