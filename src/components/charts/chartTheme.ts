import { useStore } from '../../state/store'

/** Categorical palette — colorblind-safe-ish and tuned for both themes. */
export const PALETTE = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48', '#0d9488', '#6366f1', '#ca8a04']

export function useChartTheme() {
  const dark = useStore((s) => s.theme === 'dark')
  return {
    dark,
    axis: dark ? '#64748b' : '#94a3b8',
    grid: dark ? '#1e293b' : '#e2e8f0',
    text: dark ? '#cbd5e1' : '#334155',
    muted: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? 'rgba(15,23,42,.96)' : 'rgba(255,255,255,.97)',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
  }
}
