import { useRef, useState } from 'react'
import { PaperclipIcon, SendIcon, SmileIcon } from '../../components/icons'
import { supabase } from '../../lib/supabase'
import { MAX_FILE_BYTES, formatSize, safeStorageName } from '../../lib/format'
import type { Message } from '../../lib/types'

const BUCKET = 'room-files'

const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😅', '😭', '😡', '🥳',
  '👍', '👎', '👏', '🙏', '💪', '👀', '🔥', '❤️', '💔', '🎉', '✨', '💯',
  '🍻', '☕', '🍕', '🐶', '🐱', '🌈', '⭐', '✅', '❌', '❓', '❗', '💤',
]

const iconBtn =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-ink2 hover:bg-surface2 disabled:opacity-40'

export function Composer({ roomId, onSent }: { roomId: string; onSent: (m: Message) => void }) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  async function sendText() {
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('messages')
      .insert({ room_id: roomId, kind: 'text', content })
      .select()
      .single()
    setBusy(false)
    if (err || !data) {
      setError('訊息送出失敗，請再試一次')
      return
    }
    setText('')
    onSent(data as Message)
    textRef.current?.focus()
  }

  async function sendFile(file: File) {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError(`檔案太大（${formatSize(file.size)}），上限 ${formatSize(MAX_FILE_BYTES)}`)
      return
    }
    setBusy(true)
    const path = `${roomId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream' })
    if (upErr) {
      setBusy(false)
      setError(/size|exceed|too large/i.test(upErr.message) ? '檔案太大，上限 20MB' : '檔案上傳失敗，請再試一次')
      return
    }
    const { data, error: insErr } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        kind: file.type.startsWith('image/') ? 'image' : 'file',
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_mime: file.type || null,
      })
      .select()
      .single()
    setBusy(false)
    if (insErr || !data) {
      setError('檔案已上傳但訊息送出失敗，請再試一次')
      return
    }
    onSent(data as Message)
  }

  function insertEmoji(e: string) {
    const el = textRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + e + text.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + e.length, start + e.length)
    })
  }

  return (
    <div className="relative border-t border-line bg-surface px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:py-3">
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-[0.625rem] border border-danger-line bg-danger-bg px-3 py-2 text-sm leading-normal text-danger-ink"
        >
          {error}
        </p>
      )}

      {showEmoji && (
        <div className="absolute inset-x-2.5 bottom-full mb-1 grid grid-cols-6 gap-1 rounded-2xl border border-line bg-surface2 p-2 shadow-lg sm:inset-x-auto sm:left-6 sm:w-[28rem] sm:grid-cols-9">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => insertEmoji(e)}
              className="h-11 rounded-[0.625rem] text-2xl hover:bg-line"
              aria-label={`插入 ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className={`${iconBtn} ${showEmoji ? 'bg-line text-rose-soft' : ''}`}
          aria-label="表情符號"
          aria-expanded={showEmoji}
        >
          <SmileIcon />
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={iconBtn} aria-label="傳送圖片或檔案">
          <PaperclipIcon />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void sendFile(f)
          }}
        />
        <label htmlFor="msg" className="sr-only">
          訊息內容
        </label>
        <textarea
          id="msg"
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // 輸入法選字中按 Enter 不送出
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void sendText()
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="輸入訊息"
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-[1.375rem] border border-line bg-bg px-4 py-2.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-rose focus:ring-[3px] focus:ring-rose/20"
        />
        <button
          onClick={sendText}
          disabled={busy || !text.trim()}
          aria-label="送出"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose text-rose-ink enabled:hover:brightness-110 disabled:bg-line disabled:text-muted"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
