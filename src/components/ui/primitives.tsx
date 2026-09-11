import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------ Card ------------------------------ */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  noPad,
  info,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  noPad?: boolean
  info?: string
}) {
  return (
    <section className={cn('card flex min-w-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
              {title}
              {info && (
                <span
                  title={info}
                  className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold text-slate-400 dark:border-slate-600 dark:text-slate-500"
                >
                  i
                </span>
              )}
            </h3>
            {subtitle && <p className="muted mt-0.5 truncate text-xs">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', !noPad && 'px-4 pb-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ----------------------------- Buttons ---------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'sm', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-45',
        size === 'xs' && 'px-2 py-1 text-[11px]',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        variant === 'primary' &&
          'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
        variant === 'secondary' &&
          'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800',
        variant === 'danger' && 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        className,
      )}
      {...rest}
    />
  )
}

/* ------------------------------ Form ------------------------------ */

export function Select({
  label,
  options,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  const select = (
    <select
      className={cn(
        'h-8 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2 pr-6 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600',
        className,
      )}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  if (!label) return select
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">{label}</span>
      {select}
    </label>
  )
}

export function TextInput({
  icon,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      {icon && <span className="pointer-events-none absolute left-2.5 text-slate-400">{icon}</span>}
      <input
        className={cn(
          'h-8 w-full rounded-lg border border-slate-300 bg-white text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          icon ? 'pr-2 pl-8' : 'px-2.5',
        )}
        {...rest}
      />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'xs' | 'sm'
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-slate-300/80 bg-slate-50 p-0.5 shadow-inner dark:border-slate-700 dark:bg-slate-800/60',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-medium transition-colors',
            size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-xs font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-slate-300"
    >
      <span
        className={cn(
          'relative h-4.5 w-8 rounded-full transition-colors',
          checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-3.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

/* ------------------------------ Badges ----------------------------- */

export type Tone = 'neutral' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
}

const DOT_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  slate: 'bg-slate-400',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])} />}
      {children}
    </span>
  )
}

/* --------------------------- Skeleton/Empty ------------------------ */

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19V10m6 9V5m6 14v-7" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="muted max-w-sm text-xs">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, max = 100, tone = 'emerald', className }: { value: number; max?: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700', className)}>
      <div className={cn('h-full rounded-full transition-all', DOT_CLASS[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300/80 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 shadow-[0_1px_0_rgb(0_0_0/0.05)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
      {children}
    </kbd>
  )
}

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-50', DOT_CLASS[tone])} />}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT_CLASS[tone])} />
    </span>
  )
}
