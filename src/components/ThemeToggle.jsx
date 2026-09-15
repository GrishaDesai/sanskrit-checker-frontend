import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'proofcheck-theme'

/** System first: most readers want the app to match everything else they run. */
const MODES = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

/**
 * Read the stored preference.
 *
 * Storage throws outright in some contexts (a locked-down private window, an
 * embedded webview with site data disabled), so every access is guarded and
 * failure simply means "follow the system".
 */
export function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return MODES.some((m) => m.id === value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Stamp the choice on the document root.
 *
 * `system` removes the attribute rather than writing a value, so the page falls
 * back to the `color-scheme: light dark` default and tracks the OS live --
 * including a change made while the tab is open.
 */
export function applyTheme(mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = mode
}

export function ThemeToggle() {
  const [mode, setMode] = useState(storedTheme)

  useEffect(() => {
    applyTheme(mode)
    try {
      if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* preference is not persisted; the session still honours it */
    }
  }, [mode])

  const choose = useCallback((id) => setMode(id), [])

  return (
    <div className="theme" role="radiogroup" aria-label="Colour theme">
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          aria-label={label}
          title={label}
          className={`theme-btn${mode === id ? ' theme-btn-on' : ''}`}
          onClick={() => choose(id)}
        >
          <ThemeIcon mode={id} />
        </button>
      ))}
    </div>
  )
}

function ThemeIcon({ mode }) {
  const common = { width: 15, height: 15, viewBox: '0 0 16 16', 'aria-hidden': true }

  if (mode === 'light') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1.2v1.6M8 13.2v1.6M14.8 8h-1.6M2.8 8H1.2M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1M12.8 12.8l-1.1-1.1M4.3 4.3 3.2 3.2" />
      </svg>
    )
  }

  if (mode === 'dark') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M13.4 10.1A5.9 5.9 0 0 1 5.9 2.6a5.9 5.9 0 1 0 7.5 7.5Z" />
      </svg>
    )
  }

  // "System": a disc lit on one side, the conventional auto mark.
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
