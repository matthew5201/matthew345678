import { useEffect, useState } from 'react'
import { CloseIcon } from '../../components/icons'
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="編輯紀錄"
        className="flex max-h-[80dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pb-8 pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:border sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line2 sm:hidden" />

        <div className="flex items-center justify-between">
          <h2 className="text-[1.0625rem] font-bold">{message.nickname} 的編輯紀錄</h2>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="flex size-11 items-center justify-center rounded-xl text-ink2 hover:bg-surface2"
          >
            <CloseIcon />
          </button>
        </div>

        {edits === null ? (
          <p className="text-[0.8125rem] text-muted">載入中…</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {edits.map((e, i) => (
              <li key={e.id} className="rounded-[0.875rem] bg-surface2 px-3.5 py-3">
                <div className="mb-1.5 text-xs text-muted">
                  第 {i + 1} 版 · 於 {formatDateTime(e.replaced_at)} 被取代
                </div>
                <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-normal text-ink2">{e.content}</p>
              </li>
            ))}
            <li className="rounded-[0.875rem] border border-rose-deep bg-rose/10 px-3.5 py-3">
              <div className="mb-1.5 text-xs text-rose-soft">
                目前版本{message.edited_at ? ` · ${formatDateTime(message.edited_at)}` : ''}
              </div>
              <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-normal">{message.content}</p>
            </li>
          </ol>
        )}

        <p className="mt-1 text-xs leading-relaxed text-muted">
          長按已編輯的訊息（電腦：按右鍵）或點「已編輯」即可開啟。
        </p>
      </div>
    </div>
  )
}
