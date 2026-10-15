import type { Member } from '../../lib/types'

interface Props {
  members: Member[]
  present: Set<string>
  selfId: string
}

export function MemberList({ members, present, selfId }: Props) {
  return (
    <ul className="flex flex-col gap-0.5">
      {members.map((m) => {
        const self = m.user_id === selfId
        const online = self || present.has(m.user_id)
        return (
          <li
            key={m.user_id}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-2 ${self ? 'bg-surface2' : ''}`}
          >
            <span
              aria-hidden
              className={`box-border size-2.5 shrink-0 rounded-full ${
                online ? 'bg-online' : 'border-2 border-[#9a7392]'
              }`}
            />
            <span
              className={`min-w-0 flex-1 truncate text-[0.9375rem] ${
                online ? (self ? 'font-medium text-ink' : 'text-ink') : 'text-muted'
              }`}
            >
              {m.nickname}
              {self && '（你）'}
            </span>
            {online ? (
              <span className="shrink-0 text-xs text-online sm:hidden">在線</span>
            ) : (
              <span className="shrink-0 rounded-full border border-line2 px-2 py-0.5 text-xs text-muted">斷線中</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
