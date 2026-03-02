// ─── JWT ──────────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(str: string): Uint8Array {
  return Uint8Array.from(
    atob(str.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

export async function createJWT(userId: string, email: string): Promise<string> {
  const secret = Deno.env.get('JWT_SECRET') ?? '';
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(
    encoder.encode(
      JSON.stringify({
        userId,
        email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      })
    )
  );

  const message = `${header}.${payload}`;
  const key = await hmacKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return `${message}.${b64url(sig)}`;
}

/**
 * Verifies HMAC-SHA256 signature and expiry.
 * Returns userId on success, null on any failure.
 */
export async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, b64Sig] = parts;
    const secret = Deno.env.get('JWT_SECRET') ?? '';

    // 1. Verify signature
    const key = await hmacKey(secret, ['verify']);
    const sigBytes = fromB64url(b64Sig);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${b64Header}.${b64Payload}`)
    );
    if (!valid) return null;

    // 2. Verify expiry
    const payload = JSON.parse(
      new TextDecoder().decode(fromB64url(b64Payload))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload.userId ?? null;
  } catch {
    return null;
  }
}

// ─── Password hashing (PBKDF2 + random salt) ──────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    // New format: pbkdf2:<saltHex>:<hashHex>
    const [, saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const computed = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === hashHex;
  }

  // Legacy SHA-256 (no salt) — backward-compatible for existing accounts
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const legacy = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return legacy === stored;
}
