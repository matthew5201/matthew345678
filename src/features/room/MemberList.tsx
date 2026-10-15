import type { Member } from '../../lib/types'

interface Props {
  members: Member[]
  present: Set<string>
  selfId: string
}

export function MemberList({ members, present, selfId }: Props) {
  return (
    <ul className="flex flex-col gap-1">
      {members.map((m) => {
        const self = m.user_id === selfId
        const online = self || present.has(m.user_id)
        return (
          <li key={m.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden
            />
            <span className={`min-w-0 truncate ${online ? 'text-slate-800' : 'text-slate-400'}`}>
              {m.nickname}
              {self && '（你）'}
            </span>
            {!online && <span className="ml-auto shrink-0 text-xs text-slate-400">斷線中</span>}
          </li>
        )
      })}
    </ul>
  )
}
