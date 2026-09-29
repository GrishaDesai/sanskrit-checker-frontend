/**
 * Turning an attached file into the plain text the checker reads.
 *
 * Everything happens in the browser: the manuscript is never uploaded as a
 * file, only its text is sent to `/api/check`, exactly as if it had been typed.
 */

/** What the file picker offers. Kept beside the readers so the two cannot drift. */
export const ACCEPTED_FILES = '.txt,.md,.docx'

/** Large enough for a full thesis in Word, small enough to refuse a stray video. */
const MAX_BYTES = 50 * 1024 * 1024

const extensionOf = (name) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

/**
 * Read `file` to a string, or throw an Error whose message can be shown as-is.
 *
 * PDF is refused rather than attempted. Devanagari in a PDF is stored as font
 * glyph ids, not characters, and most PDFs have no usable mapping back -- the
 * extracted text comes out with conjuncts broken and mātrās reordered, and
 * every one of those would be reported as a spelling error in the thesis.
 */
export async function readDocument(file) {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is larger than 50 MB.`)
  }

  switch (extensionOf(file.name)) {
    case 'txt':
    case 'md':
      return normalize(await file.text())

    case 'docx': {
      // Loaded on demand: most sessions never open a Word file, and the
      // reader is heavier than the rest of the app put together.
      const { default: mammoth } = await import('mammoth')
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      return normalize(value)
    }

    case 'pdf':
      throw new Error(
        'PDF text cannot be read reliably for Devanagari. Open the thesis in Word and ' +
          'attach the .docx, or save it as plain text (.txt, UTF-8).',
      )

    case 'doc':
      throw new Error('Older .doc files are not supported. Save the thesis as .docx and attach that.')

    default:
      throw new Error(`${file.name} is not a supported file. Attach a .docx or .txt file.`)
  }
}

/**
 * Line endings unified and Unicode composed.
 *
 * NFC matters: Word and some input methods store nukta and certain vowel
 * signs decomposed, and the lexicon only knows the composed forms, so an
 * unnormalized file would be flagged in places the author typed correctly.
 */
function normalize(text) {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .trim()
}
