// 對真實 Supabase 專案的整合測試：用 3 個匿名身分驗證 RPC、RLS、Storage、Realtime。
// 執行：node scripts/integration.mjs   （讀取 .env 的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
// 注意：每次執行會建立 3 個匿名使用者與 1 個房間（結束時會離開並關閉房間）。
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('.env 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

let passed = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(name)
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}
const section = (t) => console.log(`\n${t}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Realtime 訂閱回報 SUBSCRIBED 後，伺服器端還需要一點時間才會真正開始推送，所以用輪詢取代固定等待
async function waitFor(cond, ms = 12000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (cond()) return true
    await sleep(250)
  }
  return cond()
}
const msg = (e) => (e ? `${e.message}${e.hint ? ` [hint: ${e.hint}]` : ''}` : '')

async function newUser(label) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`${label} 匿名登入失敗：${error.message}`)
  return { c, id: data.user.id, label }
}

async function main() {
  section('匿名登入')
  const A = await newUser('A')
  const B = await newUser('B')
  const C = await newUser('C')
  check('三個匿名身分建立成功且各自不同', new Set([A.id, B.id, C.id]).size === 3)

  section('建立房間')
  const created = await A.c.rpc('create_room', { p_nickname: '小明' })
  check('A 建立房間成功', !created.error, msg(created.error))
  const room = created.data
  check('回傳 6 碼代碼（易辨認字元集）', /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(room?.code ?? ''), room?.code)
  check('建立者暱稱正確', room?.nickname === '小明')

  const badNick = await A.c.rpc('create_room', { p_nickname: '   ' })
  check('空白暱稱被拒絕 (INVALID_NICKNAME)', badNick.error?.message.includes('INVALID_NICKNAME'), msg(badNick.error))
  const longNick = await A.c.rpc('create_room', { p_nickname: 'x'.repeat(21) })
  check('超過 20 字暱稱被拒絕', longNick.error?.message.includes('INVALID_NICKNAME'), msg(longNick.error))

  section('加入房間')
  const nf = await B.c.rpc('join_room', { p_code: 'ZZZZZZ', p_nickname: '阿華' })
  check('不存在的代碼 → ROOM_NOT_FOUND', nf.error?.message.includes('ROOM_NOT_FOUND'), msg(nf.error))

  const dup = await B.c.rpc('join_room', { p_code: room.code, p_nickname: '小明' })
  check('暱稱重複 → NICKNAME_TAKEN', dup.error?.message.includes('NICKNAME_TAKEN'), msg(dup.error))
  check('建議值為「小明#2」', dup.error?.hint === '小明#2', `hint=${dup.error?.hint}`)

  const dupCase = await B.c.rpc('join_room', { p_code: room.code.toLowerCase(), p_nickname: '小明' })
  check('代碼不分大小寫、暱稱衝突仍被擋', dupCase.error?.message.includes('NICKNAME_TAKEN'), msg(dupCase.error))

  const bJoin = await B.c.rpc('join_room', { p_code: room.code, p_nickname: dup.error?.hint ?? '小明#2' })
  check('B 用建議暱稱加入成功', !bJoin.error && bJoin.data?.nickname === '小明#2', msg(bJoin.error))
  check('首次加入 rejoined=false', bJoin.data?.rejoined === false)

  const bAgain = await B.c.rpc('join_room', { p_code: room.code, p_nickname: '隨便' })
  check('已是成員再呼叫 → 視為重連並保留原暱稱', bAgain.data?.rejoined === true && bAgain.data?.nickname === '小明#2', msg(bAgain.error))

  const roomId = room.room_id

  section('成員與系統訊息')
  const mem = await A.c.from('room_members').select('user_id,nickname').eq('room_id', roomId)
  check('A 看得到 2 位成員', mem.data?.length === 2, msg(mem.error))
  const sys = await B.c.from('messages').select('*').eq('room_id', roomId).eq('kind', 'system').order('created_at')
  check('有 2 則「加入」系統訊息（B 能看到加入前的歷史）', sys.data?.length === 2 && sys.data.every((m) => m.content === 'join'), `${sys.data?.length} ${msg(sys.error)}`)

  section('非成員隔離（RLS）')
  const cRooms = await C.c.from('rooms').select('*')
  check('C 讀不到任何房間', (cRooms.data ?? []).length === 0, `${cRooms.data?.length}`)
  const cMsgs = await C.c.from('messages').select('*').eq('room_id', roomId)
  check('C 讀不到房間訊息', (cMsgs.data ?? []).length === 0)
  const cMembers = await C.c.from('room_members').select('*').eq('room_id', roomId)
  check('C 讀不到成員名單', (cMembers.data ?? []).length === 0)
  const cInsert = await C.c.from('messages').insert({ room_id: roomId, kind: 'text', content: '我是外人' })
  check('C 不能對該房間寫入訊息', !!cInsert.error, 'insert 竟然成功')
  const hb = await C.c.rpc('heartbeat', { p_room: roomId })
  check('C 的 heartbeat 回傳 false', hb.data === false)

  section('直接寫入被擋')
  const directRoom = await A.c.from('rooms').insert({ code: 'HACK22' })
  check('不能直接 insert rooms', !!directRoom.error)
  const directMember = await C.c.from('room_members').insert({ room_id: roomId, user_id: C.id, nickname: '偷渡' })
  check('不能直接 insert room_members', !!directMember.error)
  const fakeSystem = await A.c.from('messages').insert({ room_id: roomId, kind: 'system', content: 'leave', nickname: '偽造' })
  check('不能偽造系統訊息', !!fakeSystem.error)

  section('傳送訊息')
  const sent = await A.c.from('messages').insert({ room_id: roomId, kind: 'text', content: '晚上七點', nickname: '冒名者', user_id: B.id }).select().single()
  check('A 送出文字訊息成功', !sent.error, msg(sent.error))
  check('伺服器覆寫暱稱與發送者（不信任前端）', sent.data?.nickname === '小明' && sent.data?.user_id === A.id, JSON.stringify({ n: sent.data?.nickname, u: sent.data?.user_id === A.id }))
  const bSees = await B.c.from('messages').select('*').eq('id', sent.data?.id)
  check('B 看得到', bSees.data?.length === 1)
  const empty = await A.c.from('messages').insert({ room_id: roomId, kind: 'text', content: '   ' })
  check('空白訊息被拒絕', !!empty.error)
  const tooLong = await A.c.from('messages').insert({ room_id: roomId, kind: 'text', content: 'x'.repeat(4001) })
  check('超過 4000 字被拒絕', !!tooLong.error)

  section('編輯訊息')
  const bEdit = await B.c.rpc('edit_message', { p_id: sent.data.id, p_content: '我偷改' })
  check('B 不能編輯 A 的訊息 (FORBIDDEN)', bEdit.error?.message.includes('FORBIDDEN'), msg(bEdit.error))
  const directUpdate = await A.c.from('messages').update({ content: '直接改' }).eq('id', sent.data.id).select()
  check('不能繞過 RPC 直接 update', (directUpdate.data ?? []).length === 0)
  const aEdit = await A.c.rpc('edit_message', { p_id: sent.data.id, p_content: '晚上七點半' })
  check('A 編輯自己的訊息成功', !aEdit.error, msg(aEdit.error))
  const aEdit2 = await A.c.rpc('edit_message', { p_id: sent.data.id, p_content: '晚上八點' })
  check('可連續編輯', !aEdit2.error, msg(aEdit2.error))
  const after = await B.c.from('messages').select('*').eq('id', sent.data.id).single()
  check('內容更新且 edited_at 有值', after.data?.content === '晚上八點' && !!after.data?.edited_at)
  const edits = await B.c.from('message_edits').select('content').eq('message_id', sent.data.id).order('replaced_at')
  check('B 看得到舊版本（依序：七點、七點半）', JSON.stringify(edits.data?.map((e) => e.content)) === JSON.stringify(['晚上七點', '晚上七點半']), JSON.stringify(edits.data))
  const cEdits = await C.c.from('message_edits').select('*').eq('message_id', sent.data.id)
  check('C 看不到編輯紀錄', (cEdits.data ?? []).length === 0)
  const emptyEdit = await A.c.rpc('edit_message', { p_id: sent.data.id, p_content: '  ' })
  check('編輯成空白被拒絕', !!emptyEdit.error)

  section('檔案（Storage）')
  const bucket = 'room-files'
  const okPath = `${roomId}/${crypto.randomUUID()}-hello.txt`
  const up = await B.c.storage.from(bucket).upload(okPath, new Blob(['hello']), { contentType: 'text/plain' })
  check('成員可上傳到自己房間資料夾', !up.error, msg(up.error))
  const cUp = await C.c.storage.from(bucket).upload(`${roomId}/${crypto.randomUUID()}-evil.txt`, new Blob(['x']), { contentType: 'text/plain' })
  check('非成員不能上傳到該房間', !!cUp.error)
  const big = await B.c.storage.from(bucket).upload(`${roomId}/${crypto.randomUUID()}-big.bin`, new Uint8Array(21 * 1024 * 1024), { contentType: 'application/octet-stream' })
  check('21MB 檔案被伺服器拒絕', !!big.error, big.error ? '' : '上傳竟然成功')
  const signed = await A.c.storage.from(bucket).createSignedUrl(okPath, 60)
  check('A 可為檔案產生簽名網址', !!signed.data?.signedUrl, msg(signed.error))
  if (signed.data?.signedUrl) {
    const res = await fetch(signed.data.signedUrl)
    check('簽名網址可下載且內容正確', res.ok && (await res.text()) === 'hello')
  }
  const cSigned = await C.c.storage.from(bucket).createSignedUrl(okPath, 60)
  check('C 無法取得簽名網址', !cSigned.data?.signedUrl)
  const fileMsg = await B.c.from('messages').insert({ room_id: roomId, kind: 'file', file_path: okPath, file_name: 'hello.txt', file_size: 5, file_mime: 'text/plain' }).select().single()
  check('B 送出檔案訊息成功', !fileMsg.error, msg(fileMsg.error))
  const badPath = await B.c.from('messages').insert({ room_id: roomId, kind: 'file', file_path: `${crypto.randomUUID()}/x.txt`, file_name: 'x.txt' })
  check('附件路徑不在本房間資料夾內 → 被拒絕', !!badPath.error)
  const hugeMeta = await B.c.from('messages').insert({ room_id: roomId, kind: 'file', file_path: okPath, file_name: 'x', file_size: 21 * 1024 * 1024 })
  check('file_size 超過 20MB 的紀錄被拒絕', !!hugeMeta.error)

  section('Realtime')
  const got = { b: [], c: [] }
  const chB = B.c.channel(`db:${room.code}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) => got.b.push(p.new.content))
  const chC = C.c.channel(`dbc:${room.code}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) => got.c.push(p.new.content))
  const subscribed = (ch) => new Promise((res) => ch.subscribe((s) => (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && res(s)))
  const [sb, sc] = await Promise.all([subscribed(chB), subscribed(chC)])
  check('B 訂閱 Postgres Changes 成功', sb === 'SUBSCRIBED', sb)
  check('C 訂閱成功（但不應收到事件）', sc === 'SUBSCRIBED', sc)
  await sleep(3000)
  await A.c.from('messages').insert({ room_id: roomId, kind: 'text', content: '即時測試' })
  await waitFor(() => got.b.includes('即時測試'))
  await sleep(1500) // 再多等一下，確認 C 不會收到
  check('B 即時收到 A 的新訊息', got.b.includes('即時測試'), JSON.stringify(got.b))
  check('C（非成員）收不到', got.c.length === 0, JSON.stringify(got.c))

  const presState = { b: null }
  const presB = B.c.channel(`room:${room.code}`, { config: { private: true, presence: { key: B.id } } })
  presB.on('presence', { event: 'sync' }, () => (presState.b = Object.keys(presB.presenceState())))
  const ps = await subscribed(presB)
  check('B 加入私有 Presence 頻道', ps === 'SUBSCRIBED', ps)
  if (ps === 'SUBSCRIBED') await presB.track({ nickname: '小明#2' })
  const presA = A.c.channel(`room:${room.code}`, { config: { private: true, presence: { key: A.id } } })
  presA.on('presence', { event: 'sync' }, () => {})
  const psA = await subscribed(presA)
  if (psA === 'SUBSCRIBED') await presA.track({ nickname: '小明' })
  await waitFor(() => presState.b?.includes(A.id) && presState.b?.includes(B.id))
  check('Presence 內看得到 A 與 B', presState.b?.includes(A.id) && presState.b?.includes(B.id), JSON.stringify(presState.b))
  const presC = C.c.channel(`room:${room.code}`, { config: { private: true } })
  const psC = await subscribed(presC)
  check('非成員 C 不能加入私有 Presence 頻道', psC !== 'SUBSCRIBED', psC)

  for (const ch of [chB, chC, presA, presB, presC]) await ch.unsubscribe()

  section('心跳、離開與房間關閉')
  const hbB = await B.c.rpc('heartbeat', { p_room: roomId })
  check('成員 heartbeat 回傳 true', hbB.data === true, msg(hbB.error))
  const leaveB = await B.c.rpc('leave_room', { p_room: roomId })
  check('B 離開成功', !leaveB.error, msg(leaveB.error))
  const hbB2 = await B.c.rpc('heartbeat', { p_room: roomId })
  check('離開後 heartbeat 回傳 false', hbB2.data === false)
  const leaveMsg = await A.c.from('messages').select('nickname,content').eq('room_id', roomId).eq('content', 'leave')
  check('A 看到「小明#2 離開」系統訊息', leaveMsg.data?.some((m) => m.nickname === '小明#2'), JSON.stringify(leaveMsg.data))
  const bRead = await B.c.from('messages').select('*').eq('room_id', roomId)
  check('離開後 B 讀不到房間內容', (bRead.data ?? []).length === 0)
  const members2 = await A.c.from('room_members').select('user_id').eq('room_id', roomId)
  check('成員剩 1 人', members2.data?.length === 1)

  const leaveA = await A.c.rpc('leave_room', { p_room: roomId })
  check('最後一人離開成功', !leaveA.error, msg(leaveA.error))
  const reopen = await C.c.rpc('join_room', { p_code: room.code, p_nickname: '遲到者' })
  check('房間關閉後再輸入代碼 → ROOM_NOT_FOUND', reopen.error?.message.includes('ROOM_NOT_FOUND'), msg(reopen.error))

  section('權限')
  const sweep = await A.c.rpc('sweep_rooms')
  check('一般使用者不能呼叫 sweep_rooms', !!sweep.error)

  console.log(`\n結果：${passed} 通過，${failures.length} 失敗`)
  if (failures.length) {
    console.log('失敗項目：\n- ' + failures.join('\n- '))
    process.exitCode = 1
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error('\n測試中止：', e.message)
    process.exit(2)
  },
)
