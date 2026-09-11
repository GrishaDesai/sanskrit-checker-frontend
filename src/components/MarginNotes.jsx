import { KIND_META, kindOf, summarize } from '../lib/findings'

/**
 * The proofreader's margin.
 *
 * Findings appear in reading order, not grouped by kind, so that working down
 * the list walks the author through their own text from beginning to end.
 */
export function MarginNotes({ findings, selectedIndex, onSelect, onStep, tallies }) {
  const position = findings.findIndex((f) => f.index === selectedIndex)

  return (
    <aside className="margin">
      <div className="margin-head">
        <h2>Margin notes</h2>
        <div className="margin-nav">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={findings.length === 0}
            aria-label="Previous finding"
          >
            ‹
          </button>
          {/* Before anything is opened there is no "current" finding, so the
              rail shows the total rather than a position of zero. */}
          <span className="margin-count">
            {position < 0 ? findings.length : `${position + 1}/${findings.length}`}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={findings.length === 0}
            aria-label="Next finding"
          >
            ›
          </button>
        </div>
      </div>

      {tallies.length > 0 && (
        <ul className="tallies">
          {tallies.map(({ kind, count }) => (
            <li key={kind} className={`tally tally-${kind}`}>
              <span className="tally-count">{count}</span>
              <span className="tally-label">{KIND_META[kind].label}</span>
            </li>
          ))}
        </ul>
      )}

      {findings.length === 0 ? (
        <p className="margin-empty">
          Nothing is marked on this page. Click any word to see how it parses.
        </p>
      ) : (
        <ul className="notes">
          {findings.map(({ token, index }) => {
            const kind = kindOf(token)
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`note note-${kind}${index === selectedIndex ? ' note-selected' : ''}`}
                  onClick={() => onSelect(index)}
                >
                  <span className="note-top">
                    <span lang="sa" className="note-word">
                      {token.text}
                    </span>
                    <span className={`tier tier-${kind}`}>{KIND_META[kind].label}</span>
                  </span>
                  <span className="note-line">{summarize(token)}</span>
                  {token.suggestion && (
                    <span className="note-fix">
                      → <span lang="sa">{token.suggestion}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
