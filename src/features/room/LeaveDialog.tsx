import { useEffect } from 'react'

interface Props {
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LeaveDialog({ busy, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-6" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-labelledby="leave-title"
        aria-describedby="leave-desc"
        className="flex w-full max-w-sm flex-col gap-2.5 rounded-[1.25rem] border border-line bg-surface px-5 pb-4.5 pt-5.5 shadow-[0_20px_48px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-title" className="text-lg font-bold">
          確定要離開房間嗎？
        </h2>
        <p id="leave-desc" className="text-sm leading-relaxed text-ink3">
          離開後需要重新輸入代碼加入。如果你是最後一個離開的人，房間與所有內容會被清除。
        </p>
        <div className="mt-2.5 flex gap-2.5">
          <button
            onClick={onCancel}
            autoFocus
            className="h-12 flex-1 rounded-xl border border-line2 bg-surface2 text-base font-medium hover:bg-line"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="h-12 flex-1 rounded-xl bg-danger text-base font-bold text-[#2b0a0a] enabled:hover:brightness-110 disabled:opacity-50"
          >
            離開房間
          </button>
        </div>
      </div>
    </div>
  )
}
