// 僅開發用：不連 Supabase，用假資料排出各畫面。開啟 /preview.html?screen=entry|room|members|edit|history|leave|states
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LeaveDialog } from './features/room/LeaveDialog'
import { MemberList } from './features/room/MemberList'
import { MessageItem } from './features/room/MessageItem'
import { EntryPage } from './features/entry/EntryPage'
import { CloseIcon, CopyIcon, SendIcon, SmileIcon, PaperclipIcon, UsersIcon, WifiOffIcon } from './components/icons'
import type { Member, Message } from './lib/types'

const base = { room_id: 'r', file_path: null, file_name: null, file_size: null, file_mime: null }
const msgs: Message[] = [
  { ...base, id: '1', user_id: null, nickname: '阿華', kind: 'system', content: 'join', created_at: '2026-10-16T06:32:00Z', edited_at: null },
  { ...base, id: '2', user_id: 'u2', nickname: '阿華', kind: 'text', content: '晚上的聚會訂在七點，大家 OK 嗎？', created_at: '2026-10-16T06:33:00Z', edited_at: null },
  { ...base, id: '3', user_id: 'me', nickname: '小明', kind: 'text', content: '可以！我會帶飲料和零食過去 🍻', created_at: '2026-10-16T06:34:00Z', edited_at: '2026-10-16T06:36:00Z' },
  { ...base, id: '4', user_id: null, nickname: '阿強', kind: 'system', content: 'leave', created_at: '2026-10-16T06:40:00Z', edited_at: null },
]
const members: Member[] = [
  { user_id: 'me', nickname: '小明', joined_at: '' },
  { user_id: 'u2', nickname: '阿華', joined_at: '' },
  { user_id: 'u3', nickname: '小美', joined_at: '' },
  { user_id: 'u4', nickname: '阿強#2', joined_at: '' },
]
const present = new Set(['u2', 'u3'])

function FakeRoom({ drawer = false, editing = false }: { drawer?: boolean; editing?: boolean }) {
  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col bg-bg sm:border-x sm:border-line">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 pr-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold">房間</h1>
            <span className="flex h-7 items-center gap-1.5 rounded-lg border border-line2 bg-surface2 px-2.5 font-mono text-sm tracking-[0.14em]">
              K7M2QX <span className="text-muted"><CopyIcon /></span>
            </span>
            <span className="text-xs text-online">已複製</span>
          </div>
          <p className="text-xs text-muted">以「小明」身分聊天</p>
        </div>
        <span className="flex h-11 items-center gap-1.5 rounded-[0.625rem] border border-line2 px-3 text-[0.8125rem] sm:hidden"><UsersIcon />成員 4/20</span>
        <span className="flex h-11 items-center rounded-[0.625rem] border border-danger-line px-3 text-[0.8125rem] font-medium text-danger">離開房間</span>
      </header>
      <div className="flex items-center gap-2.5 border-y border-warn-line bg-warn-bg px-4 py-3 text-[0.8125rem] text-warn">
        <WifiOffIcon /><span>連線中斷，重新連線中…（10 分鐘內重連可保留你的身分）</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-end gap-3.5 overflow-hidden px-3.5 py-4 sm:px-8">
            {msgs.map((m) => (
              <MessageItem key={m.id} message={m} mine={m.user_id === 'me'} onShowHistory={() => {}} />
            ))}
            {editing && <p className="text-xs text-muted">（編輯狀態請點上方「編輯」）</p>}
          </div>
          <div className="flex items-end gap-1.5 border-t border-line bg-surface px-2.5 pb-3 pt-2">
            <span className="flex size-11 items-center justify-center text-ink2"><SmileIcon /></span>
            <span className="flex size-11 items-center justify-center text-ink2"><PaperclipIcon /></span>
            <div className="min-h-11 flex-1 rounded-[1.375rem] border border-line bg-bg px-4 py-2.5 text-muted/70">輸入訊息</div>
            <span className="flex size-11 items-center justify-center rounded-full bg-line text-muted"><SendIcon /></span>
          </div>
        </div>
        <aside className="hidden w-64 shrink-0 border-l border-line bg-surface p-3 sm:block">
          <h2 className="mb-2 px-2 text-[0.8125rem] font-bold text-muted">成員 4/20</h2>
          <MemberList members={members} present={present} selfId="me" />
        </aside>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-20 bg-black/60 sm:hidden">
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col gap-3 border-l border-line bg-surface p-3">
            <div className="flex items-center justify-between pl-2">
              <h2 className="text-base font-bold">成員 <span className="font-medium text-muted">4/20</span></h2>
              <span className="flex size-11 items-center justify-center text-ink2"><CloseIcon /></span>
            </div>
            <MemberList members={members} present={present} selfId="me" />
            <p className="mt-auto px-2 text-xs leading-relaxed text-muted">斷線超過 10 分鐘的成員會被移除，並在聊天室顯示離開通知。</p>
          </aside>
        </div>
      )}
    </div>
  )
}

function Preview() {
  const screen = new URLSearchParams(location.search).get('screen') ?? 'entry'
  const [, force] = useState(0)
  void force
  switch (screen) {
    case 'room':
      return <FakeRoom />
    case 'members':
      return <FakeRoom drawer />
    case 'leave':
      return (
        <>
          <FakeRoom />
          <LeaveDialog busy={false} onConfirm={() => {}} onCancel={() => {}} />
        </>
      )
    case 'notice':
      return <EntryPage onEntered={() => {}} notice="你已離線超過 10 分鐘，或房間已被清除，請重新加入。" />
    default:
      return <EntryPage onEntered={() => {}} />
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
