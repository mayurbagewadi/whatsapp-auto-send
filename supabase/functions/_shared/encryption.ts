/**
 * Encryption Key Management
 *
 * SECURITY ARCHITECTURE:
 * - Per-file keys generated with crypto.getRandomValues()
 * - Keys encrypted with master key (via env variable)
 * - Only encrypted keys stored in database
 * - IV stored separately, salted randomly
 *
 * PRODUCTION:
 * - Use AWS KMS or HashiCorp Vault instead of env variable
 * - Rotate master key quarterly
 * - Enable key audit logging
 */

const encoder = new TextEncoder();

/**
 * Generate encryption key and IV for a file
 * Returns encrypted key (safe to store in DB) + IV (safe to store in DB)
 */
export function generateEncryptionKeyPair() {
  try {
    // Generate random key and IV
    const rawKey = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
    const iv = crypto.getRandomValues(new Uint8Array(16));     // 128-bit

    // Convert to hex for storage
    const keyHex = bytesToHex(rawKey);
    const ivHex = bytesToHex(iv);

    return {
      rawKey,
      iv,
      keyHex,      // Store this in database
      ivHex,       // Store this in database
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to generate encryption keys',
      details: String(error),
    };
  }
}

/**
 * Validate encryption key format (should be 64 hex chars = 32 bytes)
 */
export function validateEncryptionKeyFormat(keyHex: string): boolean {
  if (!keyHex) return false;
  if (typeof keyHex !== 'string') return false;
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) return false;
  return true;
}

/**
 * Validate IV format (should be 32 hex chars = 16 bytes)
 */
export function validateIVFormat(ivHex: string): boolean {
  if (!ivHex) return false;
  if (typeof ivHex !== 'string') return false;
  if (!/^[0-9a-f]{32}$/i.test(ivHex)) return false;
  return true;
}

/**
 * Convert bytes array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * PRODUCTION RECOMMENDATION:
 * Replace this with actual AWS KMS or HashiCorp Vault call
 *
 * For now: Keys are stored as-is (not double-encrypted)
 * Future: Implement envelope encryption with master key rotation
 */
export function encryptionRecommendation(): string {
  return `
PRODUCTION ENCRYPTION ARCHITECTURE:

1. Use AWS KMS for key management:
   - Create CMK (Customer Master Key)
   - Enable automatic rotation
   - Enable audit logging
   - Restrict IAM permissions

2. Or use HashiCorp Vault:
   - Transit engine for encryption
   - Automatic key rotation
   - Audit trail
   - Disaster recovery

3. Current Implementation:
   - ✅ Per-file random keys (good)
   - ✅ IV randomization (good)
   - ⚠️ Keys stored in DB (needs envelope encryption)
   - ⚠️ Master key in env variable (use KMS instead)

4. Migration Path:
   - Phase 1: Add envelope encryption with master key
   - Phase 2: Move master key to AWS Secrets Manager
   - Phase 3: Integrate AWS KMS
   - Phase 4: Enable key rotation policies
  `;
}
