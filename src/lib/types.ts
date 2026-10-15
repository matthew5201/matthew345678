export interface Message {
  id: string
  room_id: string
  user_id: string | null
  nickname: string
  kind: 'text' | 'image' | 'file' | 'system'
  content: string
  file_path: string | null
  file_name: string | null
  file_size: number | null
  file_mime: string | null
  created_at: string
  edited_at: string | null
}

export interface Member {
  user_id: string
  nickname: string
  joined_at: string
}

export interface MessageEdit {
  id: string
  content: string
  replaced_at: string
}

export interface JoinResult {
  room_id: string
  code: string
  nickname: string
  rejoined: boolean
}
