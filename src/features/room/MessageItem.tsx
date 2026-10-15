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
      <div className="text-center text-xs text-muted">
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
      <div className="flex items-baseline gap-2 px-1 text-xs text-muted">
        {!mine && <span className="font-medium text-ink2">{message.nickname}</span>}
        <span>{formatTime(message.created_at)}</span>
        {editing && <span>· 編輯中</span>}
      </div>

      {editing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-2.5 rounded-[1.125rem] border border-rose bg-surface p-2.5 shadow-[0_0_0_3px_rgba(240,140,164,0.22)] sm:max-w-[70%]">
          <label htmlFor={`edit-${message.id}`} className="sr-only">
            編輯訊息
          </label>
          <textarea
            id={`edit-${message.id}`}
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
            className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-base leading-normal text-ink outline-none focus:border-rose"
          />
          {error && (
            <p role="alert" className="text-[0.8125rem] text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="h-11 rounded-xl px-4.5 text-[0.9375rem] text-ink2 hover:bg-surface2"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={saving || !draft.trim()}
              className="h-11 rounded-xl bg-rose px-5.5 text-[0.9375rem] font-bold text-rose-ink disabled:opacity-40"
            >
              儲存
            </button>
          </div>
        </div>
      ) : (
        <div
          {...historyHandlers}
          title={edited ? '長按或按右鍵可查看編輯前的版本' : undefined}
          className={`max-w-[85%] select-text break-words px-3.5 py-2.5 text-[0.9375rem] leading-normal sm:max-w-[70%] ${
            message.kind === 'text' ? '' : '!p-1.5'
          } ${
            mine
              ? 'rounded-[1.125rem_1.125rem_0.375rem_1.125rem] bg-rose font-medium text-rose-ink'
              : 'rounded-[1.125rem_1.125rem_1.125rem_0.375rem] bg-surface2 text-ink'
          } ${edited ? '[-webkit-touch-callout:none]' : ''}`}
        >
          {message.kind === 'text' ? <p className="whitespace-pre-wrap">{message.content}</p> : <Attachment message={message} />}
        </div>
      )}

      {!editing && (edited || canEdit) && (
        <div className="flex gap-2.5 px-1 text-xs text-muted">
          {edited && (
            <button
              onClick={() => onShowHistory(message)}
              className="py-1 underline underline-offset-2 hover:text-ink2"
            >
              已編輯
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => {
                setDraft(message.content)
                setError(null)
                setEditing(true)
              }}
              className="py-1 text-rose-soft hover:underline"
            >
              編輯
            </button>
          )}
        </div>
      )}
    </div>
  )
}
