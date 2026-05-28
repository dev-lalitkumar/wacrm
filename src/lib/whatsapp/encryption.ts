/**
 * Re-export from the shared encryption module.
 *
 * The implementation was moved to `src/lib/encryption.ts` so Gmail and
 * future integrations can reuse it. This file is kept for backward
 * compatibility — existing WhatsApp imports continue working.
 */
export { encrypt, decrypt, isLegacyFormat } from '@/lib/encryption'
