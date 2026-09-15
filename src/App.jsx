import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { BookPage } from "./components/BookPage";
import { ExamplesMenu } from "./components/ExamplesMenu";
import { MarginNotes } from "./components/MarginNotes";
import { ThemeToggle } from "./components/ThemeToggle";
import { indexSyntaxIssues, isFinding, kindOf, locateTokens } from "./lib/findings";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SAMPLE_TEXTS = [
  { label: "रामो वनं गच्छति।", text: "रामो वनं गच्छति।", tag: "" },
  { label: "रामः वनं गच्छति।", text: "रामः वनं गच्छति।", tag: "sandhi" },
  { label: "राम वनं गच्छति।", text: "राम वनं गच्छति।", tag: "sandhi" },
  { label: "बालिका जलम् पिबति।", text: "बालिका जलम् पिबति।", tag: "" },
  { label: "विध्यार्थी पठति।", text: "विध्यार्थी पठति।", tag: "spelling" },
  { label: "रामो गच्छति गमति।", text: "रामो गच्छति गमति।", tag: "verb" },
  { label: "भगवान् भक्तानाम् रक्षति।", text: "भगवान् भक्तानाम् रक्षति।", tag: "karaka" },
  { label: "भगवान् भक्तान् रक्षति।", text: "भगवान् भक्तान् रक्षति।", tag: "" },
  { label: "अहम् पुस्तकम् पठति।", text: "अहम् पुस्तकम् पठति।", tag: "agreement" },
  { label: "बालकाः पुस्तकम् पठति।", text: "बालकाः पुस्तकम् पठति।", tag: "agreement" },
  { label: "देवस्य नमः।", text: "देवस्य नमः।", tag: "upapada" },
  { label: "देवाय नमः।", text: "देवाय नमः।", tag: "" },
  { label: "राजपुरुषः वनम् गच्छति।", text: "राजपुरुषः वनम् गच्छति।", tag: "compound" },
];

const TAG_LABELS = {
  sandhi: "Sandhi",
  spelling: "Spelling",
  verb: "Verb",
  karaka: "Kāraka",
  agreement: "Agreement",
  upapada: "Upapada",
  compound: "Compound",
};

/** Loudest first, so the margin's tally reads as a triage order. */
const KIND_ORDER = ["word", "syntax", "sandhi", "review"];

export default function App() {
  const [text, setText] = useState("भगवान् भक्तानाम् रक्षति।");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // The proofed page shows the text the *server* saw. Editing after a check
  // would slide every offset, so any edit drops back to composing rather than
  // leaving marks sitting on the wrong words.
  const mode = result ? "proof" : "compose";

  const runCheck = useCallback(
    async (textToCheck) => {
      const body = textToCheck ?? text;
      if (!body.trim()) return;
      setLoading(true);
      setError(null);
      setSelectedIndex(null);
      try {
        const res = await fetch(`${API_URL}/api/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `Request failed (${res.status})`);
        }
        setResult(await res.json());
      } catch (err) {
        setError(err.message || "Something went wrong reaching the API.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [text],
  );

  const editText = useCallback((next) => {
    setText(next);
    setResult(null);
    setSelectedIndex(null);
  }, []);

  const pickSample = useCallback(
    (sampleText) => {
      setText(sampleText);
      void runCheck(sampleText);
    },
    [runCheck],
  );

  const placements = useMemo(() => {
    if (!result) return null;
    return locateTokens(result.input_text, result.tokens);
  }, [result]);

  const syntaxIssues = useMemo(() => indexSyntaxIssues(result?.syntax_issues), [result]);

  const findings = useMemo(
    () => (placements ?? []).filter((p) => isFinding(p.token)),
    [placements],
  );

  const tallies = useMemo(() => {
    const counts = new Map();
    for (const { token } of findings) {
      const kind = kindOf(token);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return KIND_ORDER.filter((k) => counts.has(k)).map((kind) => ({
      kind,
      count: counts.get(kind),
    }));
  }, [findings]);

  const step = useCallback(
    (delta) => {
      if (findings.length === 0) return;
      const at = findings.findIndex((f) => f.index === selectedIndex);
      const next = (at + delta + findings.length) % findings.length;
      setSelectedIndex(findings[next].index);
    },
    [findings, selectedIndex],
  );

  /**
   * Swap a suggested form into the text and check the result.
   *
   * Every suggestion the API produces replaces exactly one token -- a sandhi
   * fix rewrites the first word of the junction, never the pair -- so splicing
   * at that token's span is the whole edit. The re-check is what keeps the page
   * in proof mode instead of throwing the author back to a blank editor.
   */
  const applySuggestion = useCallback(
    (placement, replacement) => {
      const next =
        result.input_text.slice(0, placement.start) +
        replacement +
        result.input_text.slice(placement.end);
      setText(next);
      void runCheck(next);
    },
    [result, runCheck],
  );

  // Clicking off the page, or pressing Escape, puts the card away.
  useEffect(() => {
    if (selectedIndex == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.(".popover, .word, .note")) setSelectedIndex(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedIndex(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [selectedIndex]);

  const runningHead = useMemo(() => {
    if (mode === "compose") return { title: "Draft", detail: "Not yet checked" };
    const words = result.token_count;
    const n = findings.length;
    return {
      title: "Proofed",
      detail: `${words} word${words === 1 ? "" : "s"} · ${
        n === 0 ? "nothing marked" : `${n} marked`
      }`,
    };
  }, [mode, result, findings]);

  return (
    <div className="desk">
      {/*
        The bar carries identity and settings only. The things that act on the
        manuscript live on the manuscript, at the foot of the sheet.
      */}
      <header className="deskbar">
        <div className="brand">
          <span lang="sa" className="brand-mark">
            सं
          </span>
          <span className="brand-text">
            <strong lang="sa">संस्कृतपरीक्षक</strong>
            <span>Sanskrit proof-checker</span>
          </span>
        </div>

        <div className="deskbar-actions">
          <ExamplesMenu samples={SAMPLE_TEXTS} tagLabels={TAG_LABELS} onPick={pickSample} />
          <ThemeToggle />
        </div>
      </header>

      {error && <div className="banner banner-error">⚠ {error}</div>}

      {mode === "proof" && placements === null && (
        <div className="banner banner-warn">
          The words could not be located in the text, so nothing is marked on the page.
          The findings are listed in the margin instead.
        </div>
      )}

      <main className="spread">
        <BookPage
          text={mode === "proof" ? result.input_text : text}
          mode={mode}
          onTextChange={editText}
          placements={placements}
          syntaxIssues={syntaxIssues}
          selectedIndex={selectedIndex}
          onSelectWord={setSelectedIndex}
          onApply={applySuggestion}
          onClose={() => setSelectedIndex(null)}
          onCheck={() => void runCheck()}
          onEdit={() => setResult(null)}
          loading={loading}
          canCheck={Boolean(text.trim())}
          runningHead={runningHead}
        />

        {mode === "proof" ? (
          <MarginNotes
            findings={findings}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onStep={step}
            tallies={tallies}
          />
        ) : (
          <aside className="margin margin-idle">
            <h2>Margin notes</h2>
            <p className="margin-empty">
              Write your text on the page, then press <strong>Check</strong>. Anything
              worth your attention will be marked in the text and listed here.
            </p>
            <ul className="legend">
              <li className="legend-word">Word not in the lexicon</li>
              <li className="legend-sandhi">Sandhi not applied</li>
              <li className="legend-syntax">Case or agreement</li>
              <li className="legend-review">Offered for review, not an error</li>
            </ul>
          </aside>
        )}
      </main>

      {mode === "proof" && result.compounds?.length > 0 && (
        <section className="endnotes">
          <h2>Samāsa · समास-विश्लेषणम्</h2>
          <div className="endnote-grid">
            {result.compounds.map((c, i) => (
              <article key={i} className="endnote">
                <header>
                  <span lang="sa" className="endnote-word">
                    {c.compound_text}
                  </span>
                  <span className="endnote-type">{c.compound_type.split(" ")[0]}</span>
                </header>
                <p>
                  <span className="popover-key">Type</span> {c.compound_type}
                </p>
                <p>
                  <span className="popover-key">Vigraha</span>
                  <em lang="sa">{c.vigraha_vakya}</em>
                </p>
                <p>
                  <span className="popover-key">Parts</span>
                  <span lang="sa">{c.components.join(" + ")}</span>
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
