import { SignJWT, importPKCS8 } from 'jose';

const isValidPlaybackId = (value) => /^[a-zA-Z0-9_-]+$/.test(value);

const parsePrivateKey = async (rawPrivateKey) => {
  const normalized = rawPrivateKey.includes('\\n')
    ? rawPrivateKey.replace(/\\n/g, '\n')
    : rawPrivateKey;

  return importPKCS8(normalized, 'ES256');
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const playbackId = String(req.query.playbackId || '').trim();
  if (!isValidPlaybackId(playbackId)) {
    return res.status(400).json({ error: 'Invalid playbackId' });
  }

  const privateKeyPem = process.env.LIVEPEER_JWT_PRIVATE_KEY;
  const issuer = process.env.LIVEPEER_JWT_ISSUER;
  const keyId = process.env.LIVEPEER_JWT_KEY_ID || issuer;
  const ttlMinutes = Number(process.env.LIVEPEER_JWT_TTL_MINUTES || 30);

  if (!privateKeyPem || !issuer) {
    return res.status(500).json({
      error: 'Signing env not configured',
      required: ['LIVEPEER_JWT_PRIVATE_KEY', 'LIVEPEER_JWT_ISSUER'],
    });
  }

  try {
    const privateKey = await parsePrivateKey(privateKeyPem);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + Math.max(1, ttlMinutes) * 60;

    const token = await new SignJWT({
      sub: playbackId,
      pub: issuer,
      vid: playbackId,
    })
      .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
      .setIssuer(issuer)
      .setIssuedAt(now)
      .setNotBefore(now - 5)
      .setExpirationTime(exp)
      .sign(privateKey);

    const playbackUrl = `https://livepeercdn.com/hls/${playbackId}/index.m3u8?jwt=${encodeURIComponent(token)}`;

    return res.status(200).json({
      playbackId,
      playbackUrl,
      expiresAt: exp,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to sign playback token',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
