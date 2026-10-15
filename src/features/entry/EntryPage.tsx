import { useRef, useState } from 'react'
import { ApiError, createRoom, errorText, joinRoom } from '../../lib/api'
import { MAX_NICKNAME, normalizeCode } from '../../lib/format'
import type { JoinResult } from '../../lib/types'

type Problem =
  | { kind: 'not-found'; code: string }
  | { kind: 'nickname-taken'; code: string; suggestion: string }
  | { kind: 'error'; text: string }

export function EntryPage({ onEntered, notice }: { onEntered: (r: JoinResult) => void; notice?: string }) {
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const nick = nickname.trim()
  const nickOk = nick.length >= 1 && nick.length <= MAX_NICKNAME

  async function run(fn: () => Promise<JoinResult>, onFail?: (e: ApiError) => Problem | null) {
    setBusy(true)
    setProblem(null)
    try {
      onEntered(await fn())
    } catch (e) {
      const api = e instanceof ApiError ? e : null
      setProblem((api && onFail?.(api)) || { kind: 'error', text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const create = () => run(() => createRoom(nick))

  const join = (useNick = nick, useCode = normalizeCode(code)) =>
    run(
      () => joinRoom(useCode, useNick),
      (e) => {
        if (e.code === 'ROOM_NOT_FOUND') return { kind: 'not-found', code: useCode }
        if (e.code === 'NICKNAME_TAKEN' && e.hint)
          return { kind: 'nickname-taken', code: useCode, suggestion: e.hint }
        return null
      },
    )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">匿名聊天室</h1>
        <p className="mt-2 text-sm text-slate-500">不用註冊。所有人離開後，房間與內容會全部清除。</p>
      </header>

      {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">你的暱稱</span>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value)
              setProblem(null)
            }}
            maxLength={MAX_NICKNAME}
            placeholder="例如：小明"
            className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            autoFocus
          />
        </label>

        <button
          onClick={create}
          disabled={!nickOk || busy}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition enabled:hover:bg-indigo-700 disabled:opacity-40"
        >
          建立新房間
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          或輸入代碼加入
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (nickOk && code.trim()) void join()
          }}
        >
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setProblem(null)
            }}
            placeholder="房間代碼"
            maxLength={12}
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-base tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!nickOk || !code.trim() || busy}
            className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white enabled:hover:bg-slate-900 disabled:opacity-40"
          >
            加入
          </button>
        </form>

        {problem?.kind === 'error' && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {problem.text}
          </p>
        )}

        {problem?.kind === 'not-found' && (
          <div className="flex flex-col gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p>找不到房間「{problem.code}」。要怎麼做？</p>
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={!nickOk || busy}
                className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-40"
              >
                另外開一間
              </button>
              <button
                onClick={() => {
                  setProblem(null)
                  setCode('')
                  codeRef.current?.focus()
                }}
                className="flex-1 rounded-md bg-white px-3 py-1.5 ring-1 ring-slate-300"
              >
                重新輸入
              </button>
            </div>
          </div>
        )}

        {problem?.kind === 'nickname-taken' && (
          <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p>
              這個房間已有人使用「{nick}」。建議改用「<b>{problem.suggestion}</b>」。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNickname(problem.suggestion)
                  void join(problem.suggestion, problem.code)
                }}
                disabled={busy}
                className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-40"
              >
                使用「{problem.suggestion}」
              </button>
              <button
                onClick={() => setProblem(null)}
                className="flex-1 rounded-md bg-white px-3 py-1.5 ring-1 ring-slate-300"
              >
                自己改名
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
