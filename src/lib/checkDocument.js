/**
 * Checking a text of any length against `/api/check`.
 *
 * The endpoint takes one text per request and answers only when the whole of
 * it is analysed. A thesis sent that way is a single request lasting minutes,
 * with nothing to show while it runs and everything lost if it fails. So the
 * text is cut into sections, checked a few at a time, and stitched back into
 * one response of the same shape the endpoint returns -- the rest of the app
 * never knows the difference.
 */

/** Roughly a page of prose: short enough to answer quickly, long enough to be few. */
const SECTION_WORDS = 300

/** Sections in flight at once. The backend analyses each on its own worker thread. */
const CONCURRENCY = 3

const WORD = /[ँ-हऽ-ॏ॑-॔क़-ॣ॰-ॿ]+/g

const countWords = (s) => s.match(WORD)?.length ?? 0

/**
 * Cut `text` into sections that concatenate back to exactly `text`.
 *
 * Cuts fall only after a daṇḍa or a line break, never inside a sentence: the
 * kāraka and agreement checks read a whole sentence at a time, and a sentence
 * split across two requests would lose its verb or its subject and be
 * misreported in both halves.
 */
export function splitSections(text, sectionWords = SECTION_WORDS) {
  // Each unit is one sentence or line with the punctuation and space after it.
  // The two alternatives between them cover every character, so nothing is lost.
  const units = text.match(/[^।॥\n]+[।॥]*\s*|[।॥\s]+/g) ?? []

  const sections = []
  let current = ''
  let words = 0
  for (const unit of units) {
    current += unit
    words += countWords(unit)
    if (words >= sectionWords) {
      sections.push(current)
      current = ''
      words = 0
    }
  }
  if (current) sections.push(current)
  return sections
}

async function checkOne(apiUrl, text, signal) {
  const res = await fetch(`${apiUrl}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || `Request failed (${res.status})`)
  }
  return res.json()
}

/** Stands in for a section with no words in it, which the endpoint would refuse. */
const emptyResult = (text) => ({
  input_text: text,
  tokens: [],
  syntax_issues: [],
  compounds: [],
  token_count: 0,
  error_count: 0,
  review_count: 0,
  sandhi_error_count: 0,
  syntax_error_count: 0,
})

/**
 * Check `text` section by section and return one merged response.
 *
 * `onProgress(done, total)` is called as each section comes back. Aborting
 * `signal` cancels the sections still waiting and rejects with an AbortError.
 */
export async function checkDocument(apiUrl, text, { onProgress, signal } = {}) {
  const sections = splitSections(text)
  const results = new Array(sections.length)
  let next = 0
  let done = 0
  onProgress?.(0, sections.length)

  const worker = async () => {
    while (next < sections.length) {
      const i = next
      next += 1
      // Trailing space is kept aside and restored on merge, so the stitched
      // page keeps the author's paragraph breaks even if the server trims.
      const body = sections[i].trimEnd()
      const tail = sections[i].slice(body.length)
      try {
        const result = countWords(body) ? await checkOne(apiUrl, body, signal) : emptyResult(body)
        results[i] = { result, tail }
      } catch (err) {
        if (err.name === 'AbortError') throw err
        throw new Error(
          sections.length > 1 ? `Section ${i + 1} of ${sections.length}: ${err.message}` : err.message,
        )
      }
      done += 1
      onProgress?.(done, sections.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sections.length) }, worker))
  return merge(results)
}

/**
 * One response from many, as if the whole text had been sent at once.
 *
 * Tokens are concatenated in order, which is all `locateTokens` needs to place
 * them. Syntax issues point at tokens by index, so each section's indices are
 * shifted by the number of tokens that came before it.
 */
function merge(parts) {
  const merged = emptyResult('')
  merged.input_text = ''
  for (const { result, tail } of parts) {
    const offset = merged.tokens.length
    merged.input_text += result.input_text + tail
    merged.tokens.push(...result.tokens)
    merged.compounds.push(...(result.compounds ?? []))
    merged.syntax_issues.push(
      ...(result.syntax_issues ?? []).map((issue) => ({
        ...issue,
        token_index: issue.token_index + offset,
      })),
    )
    merged.error_count += result.error_count ?? 0
    merged.review_count += result.review_count ?? 0
    merged.sandhi_error_count += result.sandhi_error_count ?? 0
    merged.syntax_error_count += result.syntax_error_count ?? 0
  }
  merged.token_count = merged.tokens.length
  return merged
}
