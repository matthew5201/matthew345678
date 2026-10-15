import { useRef, useState } from 'react'
import { AlertIcon, ChatIcon, PlusIcon } from '../../components/icons'
import { ApiError, createRoom, errorText, joinRoom } from '../../lib/api'
import { MAX_NICKNAME, normalizeCode } from '../../lib/format'
import type { JoinResult } from '../../lib/types'

type Problem =
  | { kind: 'not-found'; code: string }
  | { kind: 'nickname-taken'; code: string; suggestion: string }
  | { kind: 'error'; text: string }

const inputBase =
  'h-12 rounded-xl border bg-bg px-3.5 text-base text-ink outline-none placeholder:text-muted/70'

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

  const codeBad = problem?.kind === 'not-found' || (problem?.kind === 'error' && problem.text.includes('已滿'))
  const nickBad = problem?.kind === 'nickname-taken'

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_60%_at_50%_0%,#3a1630_0%,#160c14_62%)]">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 py-10">
        <header className="flex flex-col items-center gap-2 pt-4 text-center">
          <span className="text-rose">
            <ChatIcon />
          </span>
          <h1 className="text-[2rem] font-bold tracking-wide">匿名聊天室</h1>
          <p className="text-sm leading-relaxed text-muted">不用註冊。所有人離開後，房間與內容會全部清除。</p>
        </header>

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-warn-line bg-warn-bg px-3.5 py-3 text-sm leading-normal text-warn"
          >
            <span className="mt-0.5">
              <AlertIcon />
            </span>
            <span>{notice}</span>
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-[1.25rem] border border-line bg-surface p-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="nick" className="text-sm font-medium text-ink2">
              你的暱稱
            </label>
            <div
              className={`flex items-center rounded-xl border bg-bg px-3.5 focus-within:border-rose focus-within:ring-[3px] focus-within:ring-rose/20 ${
                nickBad ? 'border-warn' : 'border-line'
              }`}
            >
              <input
                id="nick"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value)
                  setProblem(null)
                }}
                maxLength={MAX_NICKNAME}
                placeholder="例如：小明"
                autoFocus
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/70"
              />
              <span className="text-xs text-muted">
                {nick.length}/{MAX_NICKNAME}
              </span>
            </div>
          </div>

          <button
            onClick={create}
            disabled={!nickOk || busy}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-rose text-base font-bold text-rose-ink transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            <PlusIcon />
            建立新房間
          </button>

          <div className="flex items-center gap-3 text-[0.8125rem] text-muted">
            <span className="h-px flex-1 bg-line" />
            或輸入代碼加入
            <span className="h-px flex-1 bg-line" />
          </div>

          <form
            className="flex gap-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (nickOk && code.trim()) void join()
            }}
          >
            <label htmlFor="code" className="sr-only">
              房間代碼
            </label>
            <input
              id="code"
              ref={codeRef}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setProblem(null)
              }}
              placeholder="房間代碼"
              maxLength={12}
              autoCapitalize="characters"
              className={`${inputBase} min-w-0 flex-1 font-mono text-lg tracking-[0.18em] focus:border-rose focus:ring-[3px] focus:ring-rose/20 ${
                codeBad ? 'border-danger' : 'border-line'
              }`}
            />
            <button
              type="submit"
              disabled={!nickOk || !code.trim() || busy}
              className="h-12 rounded-xl border border-line2 bg-surface2 px-5 text-base font-bold text-ink enabled:hover:bg-line disabled:opacity-40"
            >
              加入
            </button>
          </form>

          {problem?.kind === 'error' && (
            <p
              role="alert"
              className="rounded-xl border border-danger-line bg-danger-bg px-3.5 py-3 text-sm leading-normal text-danger-ink"
            >
              {problem.text}
            </p>
          )}

          {problem?.kind === 'not-found' && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-danger-line bg-danger-bg p-3.5 text-sm leading-normal text-danger-ink"
            >
              <p>找不到房間「{problem.code}」。要怎麼做？</p>
              <div className="flex gap-2.5">
                <button
                  onClick={create}
                  disabled={!nickOk || busy}
                  className="h-11 flex-1 rounded-[0.625rem] bg-rose text-[0.9375rem] font-bold text-rose-ink disabled:opacity-40"
                >
                  另外開一間
                </button>
                <button
                  onClick={() => {
                    setProblem(null)
                    setCode('')
                    codeRef.current?.focus()
                  }}
                  className="h-11 flex-1 rounded-[0.625rem] border border-danger-line text-[0.9375rem] font-medium text-[#ffd0cb]"
                >
                  重新輸入
                </button>
              </div>
            </div>
          )}

          {problem?.kind === 'nickname-taken' && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-bg p-3.5 text-sm leading-normal text-warn"
            >
              <p>
                這個房間已有人使用「{nick}」。建議改用「<b>{problem.suggestion}</b>」。
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setNickname(problem.suggestion)
                    void join(problem.suggestion, problem.code)
                  }}
                  disabled={busy}
                  className="h-11 flex-1 rounded-[0.625rem] bg-rose text-[0.9375rem] font-bold text-rose-ink disabled:opacity-40"
                >
                  使用「{problem.suggestion}」
                </button>
                <button
                  onClick={() => setProblem(null)}
                  className="h-11 flex-1 rounded-[0.625rem] border border-warn-line text-[0.9375rem] font-medium text-[#fbe6a6]"
                >
                  自己改名
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="mt-auto pt-2 text-center text-xs leading-relaxed text-muted">
          房間最多 20 人 · 單檔上限 20MB
          <br />
          訊息由伺服器保存到房間清除為止，並未端對端加密
        </p>
      </main>
    </div>
  )
}
