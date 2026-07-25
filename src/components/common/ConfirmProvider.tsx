import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// שימוש: const confirm = useConfirm(); if (!(await confirm('...?'))) return
// מחליף את window.confirm() בכל האפליקציה בדיאלוג אחיד בעיצוב המערכת (ראו Classes/Employees/Dashboard).
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm חייב לפעול בתוך ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<(value: boolean) => void>()

  const confirm = useCallback<ConfirmFn>((options) => {
    setPending(typeof options === 'string' ? { message: options } : options)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function handle(result: boolean) {
    setPending(null)
    resolveRef.current?.(result)
    resolveRef.current = undefined
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => handle(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-line bg-panel p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-[13.5px] leading-relaxed text-ink">{pending.message}</div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handle(false)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-[#f2f0ea]"
              >
                {pending.cancelLabel ?? 'ביטול'}
              </button>
              <button
                type="button"
                onClick={() => handle(true)}
                className="rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90"
              >
                {pending.confirmLabel ?? 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
