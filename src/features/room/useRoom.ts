import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { heartbeat } from '../../lib/api'
import type { Member, Message } from '../../lib/types'

const HEARTBEAT_MS = 20_000

export type Connection = 'connecting' | 'online' | 'offline'

interface Options {
  roomId: string
  code: string
  userId: string
  nickname: string
  /** 伺服器端已不認得這個成員（逾時被移除或房間已關閉） */
  onRemoved: () => void
}

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) map.set(m.id, m)
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function useRoom({ roomId, code, userId, nickname, onRemoved }: Options) {
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [connection, setConnection] = useState<Connection>('connecting')
  const [loaded, setLoaded] = useState(false)
  const onRemovedRef = useRef(onRemoved)
  onRemovedRef.current = onRemoved

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    if (data) setMessages((prev) => mergeMessages(prev, data as Message[]))
  }, [roomId])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('room_members')
      .select('user_id, nickname, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
    if (data) setMembers(data as Member[])
  }, [roomId])

  const refresh = useCallback(async () => {
    await Promise.all([fetchMessages(), fetchMembers()])
  }, [fetchMessages, fetchMembers])

  useEffect(() => {
    let cancelled = false

    // 訊息（Postgres Changes，RLS 會過濾）。先訂閱、訂閱成功後才抓歷史，避免漏訊息；以 id 去重。
    const db: RealtimeChannel = supabase
      .channel(`db:${code}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as Message
          setMessages((prev) => mergeMessages(prev, [m]))
          // 有人加入／離開（系統訊息）→ 重新抓成員名單
          if (m.kind === 'system') void fetchMembers()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => mergeMessages(prev, [payload.new as Message])),
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          // 首次訂閱與斷線重連都會進來：補抓中斷期間的內容
          void refresh().then(() => !cancelled && setLoaded(true))
          setConnection('online')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline')
        }
      })

    // 在線狀態（Presence，私有頻道）。不在 Presence 內的成員顯示為「斷線中」。
    const presence: RealtimeChannel = supabase
      .channel(`room:${code}`, { config: { private: true, presence: { key: userId } } })
      .on('presence', { event: 'sync' }, () => {
        setPresent(new Set(Object.keys(presence.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ nickname, at: new Date().toISOString() })
        }
      })

    // 心跳：讓伺服器知道自己還活著；回 false 代表已被移除
    const beat = async () => {
      try {
        const ok = await heartbeat(roomId)
        if (!ok && !cancelled) onRemovedRef.current()
      } catch {
        /* 網路暫時不通：下一輪再試 */
      }
    }
    void beat()
    const timer = setInterval(beat, HEARTBEAT_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void beat()
        void refresh()
      }
    }
    const onOnline = () => {
      void beat()
      void refresh()
    }
    const onOffline = () => setConnection('offline')
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      void supabase.removeChannel(db)
      void supabase.removeChannel(presence)
    }
  }, [roomId, code, userId, nickname, refresh, fetchMembers])

  /** 本地先放入剛送出的訊息；Realtime 回音會以 id 去重 */
  const addLocal = useCallback((m: Message) => setMessages((prev) => mergeMessages(prev, [m])), [])

  return { messages, members, present, connection, loaded, addLocal }
}
