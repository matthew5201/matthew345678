import { useCallback, useEffect, useState } from 'react'
import { ApiError, joinRoom } from './lib/api'
import { clearSavedRoom, loadSavedRoom, saveRoom } from './lib/session'
import { configured, ensureAnonymousSession } from './lib/supabase'
import type { JoinResult } from './lib/types'
import { EntryPage } from './features/entry/EntryPage'
import { RoomPage } from './features/room/RoomPage'

type State =
  | { view: 'loading' }
  | { view: 'fatal'; text: string }
  | { view: 'entry'; notice?: string }
  | { view: 'room'; room: JoinResult }

export default function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [state, setState] = useState<State>({ view: 'loading' })

  useEffect(() => {
    if (!configured) {
      setState({
        view: 'fatal',
        text: '尚未設定 Supabase：請複製 .env.example 為 .env 並填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。',
      })
      return
    }
    let alive = true
    ;(async () => {
      try {
        const id = await ensureAnonymousSession()
        if (!alive) return
        setUserId(id)

        // 重新整理或斷線後回來：嘗試用記住的房間重連（伺服器端判斷 10 分鐘內是否仍保留身分）
        const saved = loadSavedRoom()
        if (saved) {
          try {
            const room = await joinRoom(saved.code, saved.nickname)
            if (!alive) return
            saveRoom({ code: room.code, nickname: room.nickname })
            setState({ view: 'room', room })
            return
          } catch (e) {
            clearSavedRoom()
            if (!alive) return
            const gone = e instanceof ApiError && e.code === 'ROOM_NOT_FOUND'
            setState({
              view: 'entry',
              notice: gone ? '先前的房間已不存在（所有人離開後會自動清除）。' : undefined,
            })
            return
          }
        }
        setState({ view: 'entry' })
      } catch {
        if (alive) setState({ view: 'fatal', text: '無法連線到伺服器，請檢查網路後重新整理頁面。' })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const entered = useCallback((room: JoinResult) => {
    saveRoom({ code: room.code, nickname: room.nickname })
    setState({ view: 'room', room })
  }, [])

  const left = useCallback(() => {
    clearSavedRoom()
    setState({ view: 'entry' })
  }, [])

  const removed = useCallback(() => {
    clearSavedRoom()
    setState({ view: 'entry', notice: '你已離線超過 10 分鐘，或房間已被清除，請重新加入。' })
  }, [])

  switch (state.view) {
    case 'loading':
      return <p className="p-8 text-center text-slate-500">載入中…</p>
    case 'fatal':
      return <p className="mx-auto max-w-md p-8 text-center text-red-700">{state.text}</p>
    case 'entry':
      return <EntryPage onEntered={entered} notice={state.notice} />
    case 'room':
      return userId ? <RoomPage room={state.room} userId={userId} onLeft={left} onRemoved={removed} /> : null
  }
}
