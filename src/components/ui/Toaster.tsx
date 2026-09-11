import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useStore } from '../../state/store'
import { cn } from '../../lib/cn'
import type { Toast } from '../../state/store'

const ICONS: Record<Toast['kind'], typeof Info> = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
}
const ACCENT: Record<Toast['kind'], string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-sky-600 dark:text-sky-400',
  error: 'text-rose-600 dark:text-rose-400',
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className="card pointer-events-auto flex w-full items-start gap-2.5 px-3.5 py-3 text-left shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENT[t.kind])} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{t.title}</span>
              {t.body && <span className="muted mt-0.5 block text-[11px] leading-snug">{t.body}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
