import { useRef, useState } from 'react'
import { editMessage, errorText } from '../../lib/api'
import { formatTime } from '../../lib/format'
import type { Message } from '../../lib/types'
import { Attachment } from './Attachment'

const LONG_PRESS_MS = 500

interface Props {
  message: Message
  mine: boolean
  onShowHistory: (m: Message) => void
}

export function MessageItem({ message, mine, onShowHistory }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (message.kind === 'system') {
    const verb = message.content === 'leave' ? '離開了房間' : '加入了房間'
    return (
      <div className="my-1 text-center text-xs text-slate-400">
        {message.nickname} {verb} · {formatTime(message.created_at)}
      </div>
    )
  }

  const edited = message.edited_at !== null
  const canEdit = mine && message.kind === 'text'

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  // 長按（觸控）／右鍵（電腦）→ 查看被編輯前的版本
  const historyHandlers = edited
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === 'mouse') return
          pressTimer.current = setTimeout(() => onShowHistory(message), LONG_PRESS_MS)
        },
        onPointerUp: cancelPress,
        onPointerLeave: cancelPress,
        onPointerCancel: cancelPress,
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault()
          cancelPress()
          onShowHistory(message)
        },
      }
    : {}

  async function save() {
    const next = draft.trim()
    if (!next) return
    if (next === message.content) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await editMessage(message.id, next)
      setEditing(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}`}>
      <div className="flex items-baseline gap-2 px-1 text-xs text-slate-500">
        {!mine && <span className="font-medium text-slate-600">{message.nickname}</span>}
        <span>{formatTime(message.created_at)}</span>
      </div>

      {editing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-2 rounded-2xl bg-white p-2 shadow ring-1 ring-indigo-300 sm:max-w-[70%]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void save()
              } else if (e.key === 'Escape') {
                setEditing(false)
              }
            }}
            rows={Math.min(6, draft.split('\n').length + 1)}
            maxLength={4000}
            autoFocus
            className="w-full resize-none rounded-lg border border-slate-200 p-2 text-base outline-none focus:border-indigo-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 text-sm">
            <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-slate-600 hover:bg-slate-100">
              取消
            </button>
            <button
              onClick={save}
              disabled={saving || !draft.trim()}
              className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-40"
            >
              儲存
            </button>
          </div>
        </div>
      ) : (
        <div
          {...historyHandlers}
          title={edited ? '長按或按右鍵可查看編輯前的版本' : undefined}
          className={`max-w-[85%] select-text break-words rounded-2xl px-3 py-2 sm:max-w-[70%] ${
            mine
              ? 'rounded-br-md bg-indigo-600 text-white'
              : 'rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
          } ${edited ? '[-webkit-touch-callout:none]' : ''}`}
        >
          {message.kind === 'text' ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Attachment message={message} />
          )}
        </div>
      )}

      <div className="flex gap-2 px-1 text-xs text-slate-400">
        {edited && !editing && (
          <button onClick={() => onShowHistory(message)} className="underline-offset-2 hover:underline">
            已編輯
          </button>
        )}
        {canEdit && !editing && (
          <button
            onClick={() => {
              setDraft(message.content)
              setError(null)
              setEditing(true)
            }}
            className="underline-offset-2 hover:text-indigo-600 hover:underline"
          >
            編輯
          </button>
        )}
      </div>
    </div>
  )
}
