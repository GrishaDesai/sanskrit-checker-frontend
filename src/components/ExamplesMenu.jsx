import { useEffect, useRef, useState } from 'react'

/**
 * The sample sentences, folded away.
 *
 * They were thirteen buttons across the top of the old screen. They are useful
 * for demonstrating what the checker catches, and clutter for an author working
 * on their own book, so they live behind one control.
 */
export function ExamplesMenu({ samples, tagLabels, onPick }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="examples" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-quiet"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Examples <span className="caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="examples-menu" role="menu">
          <p className="examples-hint">
            Each line demonstrates one kind of finding.
          </p>
          {samples.map((sample, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="examples-item"
              onClick={() => {
                setOpen(false)
                onPick(sample.text)
              }}
            >
              <span lang="sa">{sample.label}</span>
              {sample.tag && <span className="examples-tag">{tagLabels[sample.tag]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
