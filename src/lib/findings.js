/**
 * Turning the API's flat token list into something a page can paint.
 *
 * The API reports tokens by their text only -- there are no character offsets
 * in the response -- so the positions are recovered here instead.
 */

/**
 * The backend's word tokenizer, character for character.
 *
 * `app/sanskrit_engine.py:WORD_PATTERN`, kept as an escape-for-escape copy.
 * It matches runs of Devanagari letters
 * and marks while deliberately excluding dandas, digits, nukta and every kind
 * of punctuation and whitespace. Because it cannot match whitespace, running it
 * over the raw text yields exactly the matches the server got from the stripped
 * text, in the same order -- which is what makes offset recovery safe.
 */
const WORD_PATTERN_SOURCE =
  '[\u0901-\u0939\u093d-\u094f\u0951-\u0954\u0958-\u0963\u0970-\u097f]+'

/** A fresh matcher each time, so no `lastIndex` is ever carried between scans. */
const wordMatcher = () => new RegExp(WORD_PATTERN_SOURCE, 'g')

/**
 * Pair every token the server returned with its span in `text`.
 *
 * Returns `null` if the client-side scan disagrees with the server about how
 * many words there are, or about what any one of them says. A mismatch means
 * the two tokenizers have drifted apart, and a highlight painted on a guessed
 * span would accuse the wrong word -- so the caller falls back to unmarked
 * text rather than showing something it cannot stand behind.
 */
export function locateTokens(text, tokens) {
  const spans = [...text.matchAll(wordMatcher())].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }))

  if (spans.length !== tokens.length) return null

  const placements = []
  for (let i = 0; i < tokens.length; i += 1) {
    const { start, end } = spans[i]
    if (text.slice(start, end) !== tokens[i].text) return null
    placements.push({ token: tokens[i], index: i, start, end })
  }
  return placements
}

/**
 * Which of the five visual tiers a token belongs to.
 *
 * `review` is checked before any specific error status on purpose. The backend
 * uses `severity` to say whether it is *asserting* a defect or merely offering
 * one for a human to judge, and an offered item must never be painted in the
 * language of an error -- an unrecognised word is far more often a proper noun,
 * a compound or a technical term than a mistake.
 */
const SYNTAX_STATUSES = new Set(['karaka_error', 'upapada_error', 'agreement_error'])

export function kindOf(token) {
  if (token.status === 'valid') return 'ok'
  if (token.severity === 'review') return 'review'
  if (token.status === 'sandhi_error') return 'sandhi'
  if (SYNTAX_STATUSES.has(token.status)) return 'syntax'
  return 'word'
}

export const isFinding = (token) => kindOf(token) !== 'ok'

/**
 * Why a `review` token was offered, which is *not* what tier it belongs to.
 *
 * Collapsing every review-severity token into one tier is deliberate (see
 * `kindOf`) -- all of them are offered rather than asserted, and they must look
 * alike. But they are offered for unrelated reasons, and `severity` alone
 * cannot tell them apart: a word the lexicon does not carry, a junction left
 * unfused, a compound whose form breaks a samāsa rule, and a syntactic reading
 * the backend is not certain enough to assert. Reading the tier as if it meant
 * only the first silently discards the sentence the backend already wrote for
 * the others.
 */
export function reviewReason(token) {
  if (SYNTAX_STATUSES.has(token.status)) return 'syntax'
  if (token.status === 'sandhi_error') return 'sandhi'
  if (token.status === 'samasa_error') return 'samasa'
  return 'lexicon'
}

/** How each tier introduces itself, in the margin and at the popover's head. */
export const KIND_META = {
  word: { label: 'Word error', note: 'Not found in the Sanskrit lexicon' },
  sandhi: { label: 'Sandhi', note: 'Sandhi is not applied as written' },
  syntax: { label: 'Grammar', note: 'Case or agreement does not fit the sentence' },
  review: { label: 'For review', note: 'Offered for your judgement, not reported as an error' },
  ok: { label: 'Analysis', note: 'This word parses cleanly' },
}

/** The one line a finding gets in the margin, before anything is opened. */
export function summarize(token) {
  const kind = kindOf(token)
  if (kind === 'ok') return token.lemma ? `Stem ${token.lemma}` : 'Valid form'
  if (kind === 'review') {
    // The backend's own sentence says what it noticed, which is more use in the
    // margin than a generic line repeated down the column.
    switch (reviewReason(token)) {
      case 'sandhi':
        return token.sandhi_issue || 'Sandhi left unapplied — often a deliberate choice'
      case 'syntax':
        return token.karaka_issue || KIND_META.syntax.note
      case 'samasa':
        // The backend's sentence is written for the popover and runs long; the
        // margin only needs the rule's outcome. It names no compound type:
        // several rules share this status, and each may not apply if the
        // compound is of another type -- the popover says which.
        return token.suggestion
          ? `Compound form: possibly ${token.suggestion}`
          : token.samasa_issue || 'Compound form may not follow its samāsa rule'
      default:
        return 'Not in the lexicon; may be a name or technical term'
    }
  }
  return (
    token.sandhi_issue ||
    token.karaka_issue ||
    KIND_META[kind].note
  )
}

/**
 * Split `text` into runs for rendering, each carrying its token if it has one.
 *
 * Spans never overlap -- they come from a single non-overlapping regex scan --
 * so this is a simple walk rather than the priority resolution an overlapping
 * issue model would need.
 */
export function buildSegments(text, placements) {
  const segments = []
  let cursor = 0

  for (const placement of placements) {
    if (placement.start > cursor) {
      segments.push({ key: `t${cursor}`, text: text.slice(cursor, placement.start) })
    }
    segments.push({
      key: `w${placement.index}`,
      text: text.slice(placement.start, placement.end),
      placement,
    })
    cursor = placement.end
  }

  if (cursor < text.length) {
    segments.push({ key: `t${cursor}`, text: text.slice(cursor) })
  }
  return segments
}

/**
 * Attach each syntax issue to the token it concerns.
 *
 * The token already carries a terse `karaka_issue`; the issue record adds the
 * titled, fully written explanation. Merging them here means the popover can
 * show the better copy without the page rendering the same finding twice.
 */
export function indexSyntaxIssues(issues) {
  const byToken = new Map()
  for (const issue of issues ?? []) byToken.set(issue.token_index, issue)
  return byToken
}
