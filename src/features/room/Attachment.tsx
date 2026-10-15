import { useEffect, useState } from 'react'
import { FileIcon } from '../../components/icons'
import { supabase } from '../../lib/supabase'
import { formatSize } from '../../lib/format'
import type { Message } from '../../lib/types'

const BUCKET = 'room-files'
const URL_TTL_SECONDS = 3600

function useSignedUrl(path: string | null, download?: string) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!path) return
    let alive = true
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, URL_TTL_SECONDS, download ? { download } : undefined)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) setFailed(true)
        else setUrl(data.signedUrl)
      })
    return () => {
      alive = false
    }
  }, [path, download])
  return { url, failed }
}

export function Attachment({ message }: { message: Message }) {
  const isImage = message.kind === 'image' && (message.file_mime ?? '').startsWith('image/')
  const name = message.file_name ?? '檔案'
  // 圖片行內預覽；其他一律當成下載，不在頁面內執行／渲染
  const { url, failed } = useSignedUrl(message.file_path, isImage ? undefined : name)

  if (failed) return <span className="text-sm opacity-80">（檔案無法載入）</span>

  if (isImage) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={name} loading="lazy" className="max-h-72 max-w-full rounded-[0.875rem] object-contain" />
      </a>
    ) : (
      <div
        role="img"
        aria-label="圖片載入中"
        className="h-32 w-48 animate-pulse rounded-[0.875rem] bg-gradient-to-r from-line via-[#4d2f4a] to-line"
      />
    )
  }

  return (
    <a
      href={url ?? undefined}
      download={name}
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl bg-black/10 px-3 py-2.5 no-underline"
    >
      <FileIcon />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold">{name}</span>
        <span className="text-xs opacity-80">
          {message.file_size != null ? formatSize(message.file_size) : ''} · 點擊下載
        </span>
      </span>
    </a>
  )
}
