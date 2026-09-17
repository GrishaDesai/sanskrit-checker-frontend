import { useLayoutEffect, useRef, useState } from 'react'
import { KIND_META, kindOf, reviewReason } from '../lib/findings'

const GAP = 10 // breathing room between the word and the card
const EDGE = 12 // smallest gap the card may leave at the sheet's edge

/**
 * The card that opens over a clicked word.
 *
 * It is positioned inside the page body rather than the viewport, so it travels
 * with the text as the page scrolls instead of detaching from the word it is
 * describing. It flips above the line when there is not room beneath, and is
 * clamped horizontally so it never hangs off the paper.
 */
export function WordPopover({ anchor, token, syntaxIssue, onApply, onClose }) {
  const cardRef = useRef(null)
  const [placed, setPlaced] = useState(null)

  // Measured before paint, so the card is never seen at its pre-measurement
  // position. `placed` stays null for exactly one commit, during which the card
  // is rendered hidden.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return

    const { offsetHeight: height, offsetWidth: width } = card
    const limit = card.offsetParent?.clientWidth ?? width

    const above =
      anchor.spaceBelow < height + GAP + EDGE && anchor.spaceAbove > height + GAP

    const centered = anchor.left + anchor.width / 2 - width / 2
    const left = Math.max(EDGE, Math.min(centered, limit - width - EDGE))

    setPlaced({
      left,
      top: above ? anchor.top - height - GAP : anchor.bottom + GAP,
      above,
      arrow: Math.max(16, Math.min(anchor.left + anchor.width / 2 - left, width - 16)),
    })
  }, [anchor])

  const kind = kindOf(token)
  const meta = KIND_META[kind]
  // A review token is offered, never asserted -- but it is offered for one of
  // three unrelated reasons, and only one of them is "the lexicon does not
  // carry this word". Treating the tier as if it always meant that threw away
  // the sentence the backend had already written for the other two.
  const reason = kind === 'review' ? reviewReason(token) : null

  // The backend can attach two independent findings to one word: sandhi runs
  // first and marks the *first* word of a junction, which is very often the
  // same word an agreement issue then lands on. Only the higher-severity one
  // gets to set `status`, so the loser survives in its own field and would
  // otherwise never be seen at all. Show it, quietly, rather than drop it.
  //
  // `sandhi_issue` is preferred outright when the token's own status is the
  // sandhi one: a syntax issue can sit at the same index without having been
  // applied to the token, and letting its description win would describe a
  // finding the tier and title do not match.
  const primaryNote =
    (reason === 'sandhi' ? token.sandhi_issue : null) ||
    (reason === 'samasa' ? token.samasa_issue : null) ||
    syntaxIssue?.description ||
    token.karaka_issue ||
    token.sandhi_issue ||
    token.samasa_issue ||
    meta.note
  const secondaryNote =
    [token.sandhi_issue, token.samasa_issue].find((note) => note && note !== primaryNote) ?? null

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${meta.label}: ${token.text}`}
      className={`popover popover-${kind}${placed?.above ? ' popover-above' : ''}`}
      style={
        placed
          ? { left: `${placed.left}px`, top: `${placed.top}px`, '--arrow-x': `${placed.arrow}px` }
          : { left: 0, top: 0, visibility: 'hidden' }
      }
    >
      <span className="popover-arrow" aria-hidden />

      <div className="popover-head">
        <span lang="sa" className="popover-headword">
          {token.text}
        </span>
        <span className={`tier tier-${kind}`}>{meta.label}</span>
        <button type="button" className="popover-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="popover-body">
        {/* Name the finding first, explain it second -- an author skims the
            heading and reads the reasoning only if they disagree with it. */}
        {syntaxIssue?.title && (kind !== 'review' || reason === 'syntax') && (
          <p className="popover-title">{syntaxIssue.title}</p>
        )}

        {reason === 'lexicon' ? (
          <p className="popover-note">
            Not listed in the lexicon. Compounds, sandhi-fused pairs, proper nouns
            and technical terms are frequently absent, so this is offered for your
            judgement — it is <strong>not</strong> reported as an error.
          </p>
        ) : (
          <p className="popover-note">{primaryNote}</p>
        )}

        {secondaryNote && (
          <p className="popover-secondary">
            <span className="popover-key">Also</span> {secondaryNote}
          </p>
        )}

        {kind === 'review' && reason !== 'lexicon' && (
          <p className="popover-hedge">
            Offered for your judgement — it is <strong>not</strong> reported as an
            error.
          </p>
        )}

        {token.lemma && kind === 'ok' && (
          <p className="popover-meta">
            <span className="popover-key">Stem / root</span>
            <span lang="sa">{token.lemma}</span>
          </p>
        )}

        {token.suggestion && (
          <div className="suggestion">
            <span className="popover-key">Suggested</span>
            <span lang="sa" className="suggestion-text">
              {token.suggestion}
            </span>
            <button type="button" className="btn-apply" onClick={() => onApply(token.suggestion)}>
              Replace
            </button>
          </div>
        )}

        {token.rule && (
          <p className="popover-rule">
            <span className="popover-key">{kind === 'word' ? 'Note' : 'Sūtra'}</span>
            <code lang="sa">{token.rule}</code>
          </p>
        )}

        {token.analysis && (
          <details className="popover-analysis">
            <summary>Grammatical analysis · व्याकरण-विश्लेषणम्</summary>
            <pre>{token.analysis}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
