// 驗證自動清理（pg_cron + cleanup-rooms Edge Function）是否有在運作。
// 需要已部署函式並建立排程；只用匿名使用者，不需要 service_role 或 CRON_SECRET。
//
//   node scripts/verify-cleanup.mjs           全員斷線 → 房間約 60–90 秒內被關閉（約 1.5 分鐘）
//   node scripts/verify-cleanup.mjs --stale   一人持續心跳、一人失聯 → 失聯者約 10 分鐘後被移除，
//                                             房間保留並出現「離開」系統訊息（約 11–12 分鐘）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stale = process.argv.includes('--stale')

async function user() {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`匿名登入失敗：${error.message}`)
  return c
}

const t0 = Date.now()
const elapsed = () => `${Math.round((Date.now() - t0) / 1000)}s`
let ok = false

if (!stale) {
  const a = await user()
  const { data: room, error } = await a.rpc('create_room', { p_nickname: 'cleanup-test' })
  if (error) throw new Error(error.message)
  console.log('房間已建立，之後不送任何心跳，觀察是否被自動關閉（上限 3 分鐘）…')
  while (Date.now() - t0 < 180_000) {
    await sleep(10_000)
    // 房間關閉後 is_room_member 為 false，成員查不到房間
    const { data } = await a.from('rooms').select('id').eq('id', room.room_id)
    if ((data ?? []).length === 0) {
      console.log(`✓ 全員斷線的房間在 ${elapsed()} 後被自動關閉`)
      ok = true
      break
    }
    console.log(`  ${elapsed()}：房間仍開著`)
  }
  if (!ok) console.log('✗ 超過 3 分鐘房間仍開著：請確認排程已建立、函式已部署且 JWT 驗證已關閉')
} else {
  const a = await user()
  const b = await user()
  const { data: room, error } = await a.rpc('create_room', { p_nickname: 'alive' })
  if (error) throw new Error(error.message)
  const joined = await b.rpc('join_room', { p_code: room.code, p_nickname: 'silent' })
  if (joined.error) throw new Error(joined.error.message)
  console.log('A 持續送心跳，B 加入後失聯。等待 B 被移除（上限 14 分鐘）…')
  // supabase-js 的查詢要 await / .then 才會真的送出，不能只呼叫
  const beat = setInterval(() => a.rpc('heartbeat', { p_room: room.room_id }).then(() => {}), 20_000)
  let removed = false
  while (Date.now() - t0 < 14 * 60_000) {
    await sleep(20_000)
    const { data: members } = await a.from('room_members').select('nickname').eq('room_id', room.room_id)
    const names = (members ?? []).map((m) => m.nickname)
    if (names.length === 0) {
      console.log(`✗ 房間在 ${elapsed()} 時整個被關閉：A 的心跳沒有生效（房間被當成全員斷線）`)
      removed = true
      break
    }
    if (!names.includes('silent')) {
      removed = true
      const { data: msgs } = await a
        .from('messages')
        .select('nickname,content')
        .eq('room_id', room.room_id)
        .eq('kind', 'system')
        .eq('content', 'leave')
      const hasLeave = (msgs ?? []).some((m) => m.nickname === 'silent')
      console.log(`${names.includes('alive') ? '✓' : '✗'} B 在 ${elapsed()} 後被移除，A 仍在房間`)
      console.log(`${hasLeave ? '✓' : '✗'} 聊天室出現「silent 離開」系統訊息`)
      ok = names.includes('alive') && hasLeave
      break
    }
    console.log(`  ${elapsed()}：成員 ${names.join('、')}`)
  }
  if (!removed) console.log('✗ 超過 14 分鐘 B 仍在房間：逾時移除沒有運作')
  clearInterval(beat)
  await a.rpc('leave_room', { p_room: room.room_id })
}

process.exit(ok ? 0 : 1)
