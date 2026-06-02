const BACKUP_DOWNLOADED_PREFIX = 'dcu_wallet_backup_downloaded_'

export function walletBackupDownloadedKey(userId: string): string {
  return `${BACKUP_DOWNLOADED_PREFIX}${userId}`
}

export function markWalletBackupDownloaded(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(walletBackupDownloadedKey(userId), '1')
  } catch {
    /* ignore quota */
  }
}

export function isWalletBackupMarkedDownloaded(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false
  try {
    return localStorage.getItem(walletBackupDownloadedKey(userId)) === '1'
  } catch {
    return false
  }
}
