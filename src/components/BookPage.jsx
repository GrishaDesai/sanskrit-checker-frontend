import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildSegments, isFinding, kindOf } from '../lib/findings'
import { WordPopover } from './WordPopover'

/**
 * The sheet of paper, in either of its two states.
 *
 * Composing and proofing share one surface deliberately: the textarea is given
 * the same face, size, leading and margins as the proofed text, so running a
 * check reads as the page settling rather than as a jump to another screen.
 */
export function BookPage({
  text,
  mode,
  onTextChange,
  placements,
  syntaxIssues,
  selectedIndex,
  onSelectWord,
  onApply,
  onClose,
  runningHead,
}) {
  const bodyRef = useRef(null)
  const wordRefs = useRef(new Map())
  const [anchor, setAnchor] = useState(null)

  const selected =
    selectedIndex != null ? placements?.find((p) => p.index === selectedIndex) : null

  /** Word position in the body's own coordinates, plus the room around it. */
  const measure = useCallback(() => {
    const body = bodyRef.current
    const word = selectedIndex != null ? wordRefs.current.get(selectedIndex) : null
    if (!body || !word) {
      setAnchor(null)
      return
    }
    const w = word.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    setAnchor({
      left: w.left - b.left,
      top: w.top - b.top,
      bottom: w.bottom - b.top,
      width: w.width,
      spaceAbove: w.top,
      spaceBelow: window.innerHeight - w.bottom,
    })
  }, [selectedIndex])

  // `nearest` is a no-op when the word is already on screen, so selecting from
  // the margin scrolls to the word while clicking the word itself does not move
  // the page under the reader's hand.
  useLayoutEffect(() => {
    const word = selectedIndex != null ? wordRefs.current.get(selectedIndex) : null
    word?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [selectedIndex, measure])

  // The card is anchored in layout coordinates, so a reflow would strand it.
  useEffect(() => {
    if (selectedIndex == null) return undefined
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [selectedIndex, measure])

  const registerWord = useCallback((index, el) => {
    if (el) wordRefs.current.set(index, el)
    else wordRefs.current.delete(index)
  }, [])

  return (
    <div className="sheet">
      <div className="sheet-spine" aria-hidden />

      <header className="sheet-head">
        <span className="sheet-head-title">{runningHead.title}</span>
        <span className="sheet-head-count">{runningHead.detail}</span>
      </header>

      <div className="sheet-body" ref={bodyRef}>
        {mode === 'compose' ? (
          <textarea
            lang="sa"
            className="page-text page-input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            spellCheck={false}
            placeholder="Write or paste your Devanagari text here…"
          />
        ) : (
          <article lang="sa" className="page-text page-proof">
            {placements
              ? buildSegments(text, placements).map((seg) =>
                  seg.placement ? (
                    <Word
                      key={seg.key}
                      text={seg.text}
                      placement={seg.placement}
                      selected={seg.placement.index === selectedIndex}
                      onSelect={onSelectWord}
                      register={registerWord}
                    />
                  ) : (
                    <span key={seg.key}>{seg.text}</span>
                  ),
                )
              : text}
          </article>
        )}

        {mode === 'proof' && selected && anchor && (
          <WordPopover
            key={selected.index}
            anchor={anchor}
            token={selected.token}
            syntaxIssue={syntaxIssues.get(selected.index)}
            onApply={(replacement) => onApply(selected, replacement)}
            onClose={onClose}
          />
        )}
      </div>

      <footer className="sheet-foot" aria-hidden>
        <span className="ornament">❦</span>
      </footer>
    </div>
  )
}

/**
 * One word on the page.
 *
 * Clean words are marked in no way at all -- a proofread page that underlines
 * everything teaches the eye to ignore underlining -- but they stay clickable,
 * because an author asking "what case is this?" of a word that is *not* a
 * problem is a normal thing to want.
 */
function Word({ text, placement, selected, onSelect, register }) {
  const kind = kindOf(placement.token)
  const flagged = isFinding(placement.token)

  return (
    <button
      type="button"
      ref={(el) => register(placement.index, el)}
      className={`word word-${kind}${selected ? ' word-selected' : ''}`}
      onClick={() => onSelect(placement.index)}
      aria-label={flagged ? `${text}: ${kind} finding` : `${text}: analysis`}
    >
      {text}
    </button>
  )
}
