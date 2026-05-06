import { join } from 'path'

/**
 * ML verification and /api/uploads write under this directory.
 * VPS mistakes often set UPLOAD_DIR to the literal "UPLOAD_DIR="; reject garbage and fall back.
 */
export function resolveUploadDir(cwd: string = process.cwd()): string {
  const raw = process.env.UPLOAD_DIR?.trim()
  if (!raw) {
    return join(cwd, 'uploads')
  }
  // Broken .env / shell exports (value is the key with equals, or empty-looking junk)
  if (raw === 'UPLOAD_DIR=' || raw === 'UPLOAD_DIR' || /^[A-Z0-9_]+=$/.test(raw)) {
    return join(cwd, 'uploads')
  }
  return raw
}
