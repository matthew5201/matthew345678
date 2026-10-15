import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MAX_FILE_BYTES, formatSize, safeStorageName } from '../../lib/format'
import type { Message } from '../../lib/types'

const BUCKET = 'room-files'

const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😅', '😭', '😡', '🥳',
  '👍', '👎', '👏', '🙏', '💪', '👀', '🔥', '❤️', '💔', '🎉', '✨', '💯',
  '🍻', '☕', '🍕', '🐶', '🐱', '🌈', '⭐', '✅', '❌', '❓', '❗', '💤',
]

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
    <div className="relative border-t border-slate-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {showEmoji && (
        <div className="absolute bottom-full left-3 mb-1 grid grid-cols-6 gap-1 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200 sm:grid-cols-12">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => insertEmoji(e)}
              className="rounded p-1 text-xl hover:bg-slate-100"
              aria-label={`插入 ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="rounded-lg p-2 text-xl hover:bg-slate-100"
          aria-label="表情符號"
          aria-expanded={showEmoji}
        >
          😊
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg p-2 text-xl hover:bg-slate-100 disabled:opacity-40"
          aria-label="傳送圖片或檔案"
        >
          📎
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
        <textarea
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
          placeholder="輸入訊息（Enter 送出，Shift+Enter 換行）"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          onClick={sendText}
          disabled={busy || !text.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white enabled:hover:bg-indigo-700 disabled:opacity-40"
        >
          送出
        </button>
      </div>
    </div>
  )
}
