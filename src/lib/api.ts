import { supabase } from './supabase'
import type { JoinResult } from './types'

export type ApiErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NICKNAME_TAKEN'
  | 'INVALID_NICKNAME'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'EMPTY_MESSAGE'
  | 'UNKNOWN'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public hint?: string,
    public raw?: string,
  ) {
    super(code)
  }
}

const KNOWN: ApiErrorCode[] = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NICKNAME_TAKEN',
  'INVALID_NICKNAME',
  'RATE_LIMITED',
  'FORBIDDEN',
  'EMPTY_MESSAGE',
]

function toApiError(e: { message?: string; hint?: string | null }): ApiError {
  const code = KNOWN.find((c) => e.message?.includes(c)) ?? 'UNKNOWN'
  return new ApiError(code, e.hint ?? undefined, e.message)
}

export async function createRoom(nickname: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('create_room', { p_nickname: nickname })
  if (error) throw toApiError(error)
  return data as JoinResult
}

export async function joinRoom(code: string, nickname: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_room', { p_code: code, p_nickname: nickname })
  if (error) throw toApiError(error)
  return data as JoinResult
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_room', { p_room: roomId })
  if (error) throw toApiError(error)
}

/** 回傳 false：自己已不在房間（逾時被移除或房間已關閉） */
export async function heartbeat(roomId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('heartbeat', { p_room: roomId })
  if (error) throw toApiError(error)
  return data === true
}

export async function editMessage(id: string, content: string): Promise<void> {
  const { error } = await supabase.rpc('edit_message', { p_id: id, p_content: content })
  if (error) throw toApiError(error)
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'ROOM_NOT_FOUND':
        return '找不到房間'
      case 'ROOM_FULL':
        return '房間已滿（最多 20 人）'
      case 'INVALID_NICKNAME':
        return '暱稱需為 1–20 個字'
      case 'RATE_LIMITED':
        return '操作太頻繁，請稍後再試'
      case 'FORBIDDEN':
        return '沒有權限執行這個動作'
      case 'EMPTY_MESSAGE':
        return '訊息不能是空的'
    }
  }
  return '發生錯誤，請稍後再試'
}
