// 診斷 Realtime：A 建房、B 加入，兩人訂閱後 A 發訊息，印出所有狀態與事件。
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function user() {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw error
  return { c, id: data.user.id, token: data.session.access_token }
}

const A = await user()
const B = await user()
const room = (await A.c.rpc('create_room', { p_nickname: 'A' })).data
await B.c.rpc('join_room', { p_code: room.code, p_nickname: 'B' })
console.log('room', room.code)

for (const [name, u] of [['A', A], ['B', B]]) {
  const ch = u.c
    .channel(`dbg-${name}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => console.log(`[${name}] unfiltered event`, p.eventType, p.new?.content))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.room_id}` }, (p) => console.log(`[${name}] filtered INSERT`, p.new?.content))
    .subscribe((s, err) => console.log(`[${name}] postgres_changes status`, s, err?.message ?? ''))
  void ch
}
await sleep(3000)

const ins = await A.c.from('messages').insert({ room_id: room.room_id, kind: 'text', content: 'hello-realtime' })
console.log('insert error:', ins.error?.message ?? null)
await sleep(5000)

for (const [name, u] of [['A', A], ['B', B]]) {
  const ch = u.c.channel(`room:${room.code}`, { config: { private: true, presence: { key: u.id } } })
  ch.on('presence', { event: 'sync' }, () => console.log(`[${name}] presence sync:`, Object.keys(ch.presenceState()).map((k) => (k === A.id ? 'A' : 'B'))))
  ch.subscribe(async (s, err) => {
    console.log(`[${name}] presence status`, s, err?.message ?? '')
    if (s === 'SUBSCRIBED') console.log(`[${name}] track:`, await ch.track({ who: name }))
  })
  await sleep(2500)
}
await sleep(3000)

await A.c.rpc('leave_room', { p_room: room.room_id })
await B.c.rpc('leave_room', { p_room: room.room_id })
process.exit(0)
