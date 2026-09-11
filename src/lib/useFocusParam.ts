import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Reads the `?focus=<id>` deep-link param (set by the command palette) and
 * lets the page clear it when the detail view closes.
 */
export function useFocusParam(): [string | null, () => void] {
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  const clear = useCallback(() => {
    if (!params.has('focus')) return
    const next = new URLSearchParams(params)
    next.delete('focus')
    setParams(next, { replace: true })
  }, [params, setParams])
  return [focus, clear]
}
