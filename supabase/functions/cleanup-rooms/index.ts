// 定時清理：逾時成員、空房間／全員斷線的房間，以及這些房間的 Storage 檔案。
// 由 pg_cron + pg_net 每 30 秒呼叫（見 supabase/cron.sql），以 x-cron-secret 驗證。
// 部署：supabase functions deploy cleanup-rooms --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'room-files'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  // service_role 只存在於這個函式的環境變數，不會進入前端
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: roomIds, error } = await admin.rpc('sweep_rooms')
  if (error) return new Response(error.message, { status: 500 })

  let deleted = 0
  const failed: string[] = []

  for (const roomId of (roomIds ?? []) as string[]) {
    try {
      await removeFolder(admin, roomId)
      // 先刪檔案、後刪資料列：檔案刪除失敗時房間列保留，下一輪重試
      const { error: delErr } = await admin.from('rooms').delete().eq('id', roomId)
      if (delErr) throw delErr
      deleted++
    } catch (e) {
      console.error('cleanup failed for room', roomId, e)
      failed.push(roomId)
    }
  }

  return Response.json({ deleted, failed })
})

async function removeFolder(admin: ReturnType<typeof createClient>, folder: string) {
  const storage = admin.storage.from(BUCKET)
  // 每次列出前 1000 個並刪除，直到清空
  for (;;) {
    const { data, error } = await storage.list(folder, { limit: 1000 })
    if (error) throw error
    if (!data || data.length === 0) return
    const { error: rmErr } = await storage.remove(data.map((f) => `${folder}/${f.name}`))
    if (rmErr) throw rmErr
  }
}
