// 記住目前所在房間，供重新整理／斷線後重連。僅為便利功能，讀寫失敗時不影響使用。
const KEY = 'chat.current-room'

export interface SavedRoom {
  code: string
  nickname: string
}

export function loadSavedRoom(): SavedRoom | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return typeof v?.code === 'string' && typeof v?.nickname === 'string' ? v : null
  } catch {
    return null
  }
}

export function saveRoom(room: SavedRoom) {
  try {
    localStorage.setItem(KEY, JSON.stringify(room))
  } catch {
    /* ignore */
  }
}

export function clearSavedRoom() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
