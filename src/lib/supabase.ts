import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)

// 只使用公開的 anon key；權限完全由資料庫 RLS 與 RPC 決定
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** 取得（或建立）匿名 session，回傳 user id。session 存在 localStorage，重新整理後仍是同一人。 */
export async function ensureAnonymousSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signed, error } = await supabase.auth.signInAnonymously()
  if (error || !signed.user) throw error ?? new Error('anonymous sign-in failed')
  return signed.user.id
}
