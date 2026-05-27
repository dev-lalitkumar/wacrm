import crypto from 'crypto'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/**
 * Generate a fresh webhook secret. 24 bytes of crypto-random data
 * encoded as URL-safe base64 (32 chars, no padding). Long enough to
 * resist guessing; short enough to be easy to copy/paste.
 */
export function generateSecret(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/**
 * AES-GCM encrypt the raw secret for at-rest storage. We re-use the
 * battle-tested helper from WhatsApp config so we don't introduce a
 * second crypto path.
 */
export function encryptSecret(raw: string): string {
  return encrypt(raw)
}

/**
 * Decrypt a stored secret. Throws if the ciphertext is tampered.
 * Only the ingestion route + the secret-reveal API call this.
 */
export function decryptSecret(stored: string): string {
  return decrypt(stored)
}

/**
 * First 8 chars of the raw secret — safe to show to viewers who
 * don't have reveal permission. Pairs with a masked tail in the UI.
 */
export function secretPrefix(raw: string): string {
  return raw.slice(0, 8)
}

/**
 * Constant-time comparison so an attacker can't time-side-channel
 * the right prefix by measuring response latency.
 */
export function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
