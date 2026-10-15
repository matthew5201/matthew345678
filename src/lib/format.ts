export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_NICKNAME = 20

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
  return `${date} ${formatTime(iso)}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Storage 的 key 只放安全字元；原始檔名另存在 messages.file_name */
export function safeStorageName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  return cleaned.slice(-80) || 'file'
}

export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}
