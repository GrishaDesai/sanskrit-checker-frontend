import { useRef } from 'react'
import { ACCEPTED_FILES } from '../lib/readDocument'

/**
 * Opens a manuscript from disk.
 *
 * The native file input is kept hidden and driven by an ordinary button, so the
 * control matches the rest of the bar instead of the browser's own chrome.
 */
export function AttachButton({ onFile, disabled }) {
  const inputRef = useRef(null)

  return (
    <>
      <button
        type="button"
        className="btn btn-quiet"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Open a .docx or .txt file"
      >
        Open file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILES}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so choosing the same file again, after editing it in Word,
          // still fires a change.
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}
