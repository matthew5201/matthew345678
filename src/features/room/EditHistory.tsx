import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import type { Message, MessageEdit } from '../../lib/types'

export function EditHistory({ message, onClose }: { message: Message; onClose: () => void }) {
  const [edits, setEdits] = useState<MessageEdit[] | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('message_edits')
      .select('id, content, replaced_at')
      .eq('message_id', message.id)
      .order('replaced_at', { ascending: true })
      .then(({ data }) => alive && setEdits((data as MessageEdit[]) ?? []))
    return () => {
      alive = false
    }
  }, [message.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="編輯紀錄"
        className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{message.nickname} 的編輯紀錄</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="關閉">
            ✕
          </button>
        </div>
        {edits === null ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {edits.map((e, i) => (
              <li key={e.id} className="rounded-lg bg-slate-50 p-3">
                <div className="mb-1 text-xs text-slate-500">
                  第 {i + 1} 版 · 於 {formatDateTime(e.replaced_at)} 被取代
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{e.content}</p>
              </li>
            ))}
            <li className="rounded-lg bg-indigo-50 p-3">
              <div className="mb-1 text-xs text-indigo-600">
                目前版本{message.edited_at ? ` · ${formatDateTime(message.edited_at)}` : ''}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{message.content}</p>
            </li>
          </ol>
        )}
      </div>
    </div>
  )
}
