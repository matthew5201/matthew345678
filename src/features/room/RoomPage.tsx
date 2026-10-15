import { useEffect, useRef, useState } from 'react'
import { CloseIcon, CopyIcon, UsersIcon, WifiOffIcon } from '../../components/icons'
import { leaveRoom } from '../../lib/api'
import type { JoinResult, Message } from '../../lib/types'
import { Composer } from './Composer'
import { EditHistory } from './EditHistory'
import { LeaveDialog } from './LeaveDialog'
import { MemberList } from './MemberList'
import { MessageItem } from './MessageItem'
import { useRoom } from './useRoom'

const MAX_MEMBERS = 20

interface Props {
  room: JoinResult
  userId: string
  onLeft: () => void
  onRemoved: () => void
}

export function RoomPage({ room, userId, onLeft, onRemoved }: Props) {
  const { messages, members, present, connection, loaded, addLocal } = useRoom({
    roomId: room.room_id,
    code: room.code,
    userId,
    nickname: room.nickname,
    onRemoved,
  })
  const [drawer, setDrawer] = useState(false)
  const [historyOf, setHistoryOf] = useState<Message | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // 使用者已捲到底部附近時，新訊息自動捲到底
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  async function leave() {
    setLeaving(true)
    try {
      await leaveRoom(room.room_id)
    } catch {
      /* 就算失敗也讓使用者離開；伺服器會因心跳逾時而移除 */
    }
    onLeft()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪貼簿不可用時，使用者仍可手動抄代碼 */
    }
  }

  const memberPanel = <MemberList members={members} present={present} selfId={userId} />

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col bg-bg sm:border-x sm:border-line">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 pr-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold sm:text-[1.0625rem]">房間</h1>
            <button
              onClick={copyCode}
              aria-label={`複製房間代碼 ${room.code}`}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-line2 bg-surface2 px-2.5 font-mono text-sm tracking-[0.14em] hover:bg-line"
            >
              {room.code}
              <span className="text-muted">
                <CopyIcon />
              </span>
            </button>
            {copied && (
              <span role="status" className="text-xs text-online">
                已複製
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted">以「{room.nickname}」身分聊天</p>
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-[0.625rem] border border-line2 px-3 text-[0.8125rem] hover:bg-surface2 sm:hidden"
        >
          <UsersIcon />
          成員 {members.length}/{MAX_MEMBERS}
        </button>
        <button
          onClick={() => setConfirmLeave(true)}
          className="h-11 shrink-0 rounded-[0.625rem] border border-danger-line px-3 text-[0.8125rem] font-medium text-danger hover:bg-danger-bg sm:px-4 sm:text-sm"
        >
          離開房間
        </button>
      </header>

      {connection === 'offline' && (
        <div
          role="status"
          className="flex items-center gap-2.5 border-y border-warn-line bg-warn-bg px-4 py-3 text-[0.8125rem] leading-normal text-warn"
        >
          <WifiOffIcon />
          <span>連線中斷，重新連線中…（10 分鐘內重連可保留你的身分）</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
            className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-3.5 py-4 sm:px-8 sm:py-5"
          >
            {!loaded && <p className="rounded-xl bg-surface py-3.5 text-center text-sm text-muted">載入中…</p>}
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} mine={m.user_id === userId} onShowHistory={setHistoryOf} />
            ))}
          </div>
          <Composer roomId={room.room_id} onSent={addLocal} />
        </div>

        <aside
          aria-label="成員清單"
          className="hidden w-64 shrink-0 overflow-y-auto border-l border-line bg-surface p-3 sm:block"
        >
          <h2 className="mb-2 px-2 text-[0.8125rem] font-bold text-muted">
            成員 {members.length}/{MAX_MEMBERS}
          </h2>
          {memberPanel}
        </aside>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-20 bg-black/60 sm:hidden" onClick={() => setDrawer(false)}>
          <aside
            aria-label="成員清單"
            className="absolute right-0 top-0 flex h-full w-72 flex-col gap-3 overflow-y-auto border-l border-line bg-surface p-3 shadow-[-12px_0_32px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pl-2">
              <h2 className="text-base font-bold">
                成員 <span className="font-medium text-muted">{members.length}/{MAX_MEMBERS}</span>
              </h2>
              <button
                onClick={() => setDrawer(false)}
                aria-label="關閉成員清單"
                className="flex size-11 items-center justify-center rounded-xl text-ink2 hover:bg-surface2"
              >
                <CloseIcon />
              </button>
            </div>
            {memberPanel}
            <p className="mt-auto px-2 text-xs leading-relaxed text-muted">
              斷線超過 10 分鐘的成員會被移除，並在聊天室顯示離開通知。
            </p>
          </aside>
        </div>
      )}

      {historyOf && <EditHistory message={historyOf} onClose={() => setHistoryOf(null)} />}
      {confirmLeave && (
        <LeaveDialog busy={leaving} onConfirm={leave} onCancel={() => !leaving && setConfirmLeave(false)} />
      )}
    </div>
  )
}
