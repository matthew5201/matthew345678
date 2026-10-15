import { useEffect, useRef, useState } from 'react'
import { leaveRoom } from '../../lib/api'
import type { JoinResult, Message } from '../../lib/types'
import { Composer } from './Composer'
import { EditHistory } from './EditHistory'
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
    if (!window.confirm('確定要離開房間嗎？離開後需要重新輸入代碼加入。')) return
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
    <div className="mx-auto flex h-dvh max-w-5xl flex-col bg-slate-50 sm:border-x sm:border-slate-200">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-800">房間</h1>
            <button
              onClick={copyCode}
              className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm tracking-widest hover:bg-slate-200"
              title="點擊複製代碼"
            >
              {room.code}
            </button>
            {copied && <span className="text-xs text-emerald-600">已複製</span>}
          </div>
          <p className="truncate text-xs text-slate-500">以「{room.nickname}」身分聊天</p>
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 sm:hidden"
        >
          成員 {members.length}/{MAX_MEMBERS}
        </button>
        <button
          onClick={leave}
          disabled={leaving}
          className="rounded-lg px-3 py-1.5 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-40"
        >
          離開房間
        </button>
      </header>

      {connection === 'offline' && (
        <div className="bg-amber-100 px-3 py-1.5 text-center text-sm text-amber-900" role="status">
          連線中斷，重新連線中…（10 分鐘內重連可保留你的身分）
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
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
          >
            {!loaded && <p className="text-center text-sm text-slate-400">載入中…</p>}
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} mine={m.user_id === userId} onShowHistory={setHistoryOf} />
            ))}
          </div>
          <Composer roomId={room.room_id} onSent={addLocal} />
        </div>

        <aside className="hidden w-56 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3 sm:block">
          <h2 className="mb-2 px-2 text-xs font-semibold text-slate-500">
            成員 {members.length}/{MAX_MEMBERS}
          </h2>
          {memberPanel}
        </aside>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-20 bg-black/40 sm:hidden" onClick={() => setDrawer(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-64 overflow-y-auto bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold text-slate-700">
                成員 {members.length}/{MAX_MEMBERS}
              </h2>
              <button onClick={() => setDrawer(false)} className="px-2 text-slate-500" aria-label="關閉">
                ✕
              </button>
            </div>
            {memberPanel}
          </aside>
        </div>
      )}

      {historyOf && <EditHistory message={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  )
}
