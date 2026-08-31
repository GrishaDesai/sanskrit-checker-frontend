import { useState } from "react";
import "./App.css";

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

export default function App() {
  const [text, setText] = useState("भगवान् भक्तानाम् रक्षति।");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck(textToCheck = text) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToCheck }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong reaching the API.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSample(sampleText) {
    setText(sampleText);
    handleCheck(sampleText);
  }

  const getTokenClass = (status) => {
    if (status === "valid") return "valid";
    if (status === "sandhi_error") return "sandhi-issue";
    if (status === "karaka_error" || status === "upapada_error") return "karaka-issue";
    if (status === "agreement_error") return "agreement-issue";
    return "invalid";
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "valid": return "✓ Valid";
      case "sandhi_error": return "⚠ Sandhi Issue";
      case "karaka_error": return "⚠ Kāraka Error";
      case "upapada_error": return "⚠ Upapada Error";
      case "agreement_error": return "⚠ Agreement Error";
      default: return "✗ Invalid Form";
    }
  };

  const totalIssues = result
    ? result.error_count
    : 0;

  return (
    <div className="page">
      <header>
        <h1>Sanskrit Proof-Checker (संस्कृत-शोधकः)</h1>
        <p className="subtitle">
          Phase 1 & 2: Word Validity · Sandhi · Orthography &nbsp;|&nbsp; Phase 3: Kāraka · Agreement · Samāsa
        </p>
      </header>

      <div className="sample-bar">
        <span className="sample-label">Examples:</span>
        <div className="sample-buttons">
          {SAMPLE_TEXTS.map((sample, idx) => (
            <button
              key={idx}
              className={`sample-btn ${sample.tag ? `sample-${sample.tag}` : ""}`}
              onClick={() => handleSelectSample(sample.text)}
            >
              {sample.label}
              {sample.tag && <span className="sample-tag">{TAG_LABELS[sample.tag]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="split">
        {/* LEFT: input */}
        <section className="pane">
          <h2>Input Sanskrit Text (Devanagari)</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Type Devanagari Sanskrit here, e.g. भगवान् भक्तान् रक्षति।"
          />
          <button
            className="check-btn"
            onClick={() => handleCheck()}
            disabled={loading || !text.trim()}
          >
            {loading ? "Checking…" : "Check Sanskrit Text"}
          </button>
          {error && <div className="error-box">⚠ {error}</div>}
        </section>

        {/* RIGHT: results */}
        <section className="pane">
          <h2>Diagnostics</h2>
          {!result && !loading && (
            <p className="placeholder">Click <strong>Check Sanskrit Text</strong> or pick an example.</p>
          )}
          {loading && <p className="placeholder">Checking Pāṇinian rules…</p>}

          {result && (
            <>
              {/* Summary badges */}
              <div className="summary">
                <span className="badge total">{result.token_count} tokens</span>
                {totalIssues === 0 ? (
                  <span className="badge good">✓ All checks passed</span>
                ) : (
                  <>
                    {result.sandhi_error_count > 0 && (
                      <span className="badge warning">{result.sandhi_error_count} sandhi</span>
                    )}
                    {result.syntax_error_count > 0 && (
                      <span className="badge karaka">{result.syntax_error_count} syntax</span>
                    )}
                    {(result.error_count - result.sandhi_error_count - result.syntax_error_count) > 0 && (
                      <span className="badge bad">
                        {result.error_count - result.sandhi_error_count - result.syntax_error_count} word error(s)
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Token list */}
              <ul className="token-list">
                {result.tokens.map((t, i) => {
                  const cls = getTokenClass(t.status);
                  return (
                    <li key={i} className={cls}>
                      <div className="token-header">
                        <span className="token-text">{t.text}</span>
                        <span className={`status-tag ${cls}`}>{getStatusLabel(t.status)}</span>
                      </div>

                      <div className="token-detail">
                        {t.status === "valid" && (
                          <>
                            {t.lemma && (
                              <div className="meta-line">
                                <strong>Stem/Root:</strong> {t.lemma}
                              </div>
                            )}
                            {t.analysis && (
                              <details>
                                <summary>Grammatical Analysis (व्याकरण-विश्लेषणम्)</summary>
                                <pre>{t.analysis}</pre>
                              </details>
                            )}
                          </>
                        )}

                        {t.status === "sandhi_error" && (
                          <div className="diag-box sandhi-box">
                            {t.suggestion && (
                              <div className="sug-line">
                                <strong>Correct Sandhi Form:</strong>{" "}
                                <span className="highlight-text">{t.suggestion}</span>
                              </div>
                            )}
                            {t.rule && <div className="rule-line"><strong>Sutra:</strong> <code>{t.rule}</code></div>}
                            {t.sandhi_issue && <div className="issue-desc">{t.sandhi_issue}</div>}
                          </div>
                        )}

                        {(t.status === "karaka_error" || t.status === "upapada_error") && (
                          <div className="diag-box karaka-box">
                            {t.suggestion && (
                              <div className="sug-line">
                                <strong>Correct Case Form:</strong>{" "}
                                <span className="highlight-text">{t.suggestion}</span>
                              </div>
                            )}
                            {t.rule && <div className="rule-line"><strong>Sutra:</strong> <code>{t.rule}</code></div>}
                            {t.karaka_issue && <div className="issue-desc">{t.karaka_issue}</div>}
                          </div>
                        )}

                        {t.status === "agreement_error" && (
                          <div className="diag-box agreement-box">
                            {t.suggestion && (
                              <div className="sug-line">
                                <strong>Correct Verb Form:</strong>{" "}
                                <span className="highlight-text">{t.suggestion}</span>
                              </div>
                            )}
                            {t.rule && <div className="rule-line"><strong>Sutra:</strong> <code>{t.rule}</code></div>}
                            {t.karaka_issue && <div className="issue-desc">{t.karaka_issue}</div>}
                          </div>
                        )}

                        {t.status === "invalid" && (
                          <div className="diag-box invalid-box">
                            <div className="error-desc">Not found in Sanskrit lexicon (अशुद्धं पदम्)</div>
                            {t.suggestion && (
                              <div className="sug-line">
                                <strong>Suggested Form:</strong>{" "}
                                <span className="highlight-text">{t.suggestion}</span>
                              </div>
                            )}
                            {t.rule && <div className="rule-line"><strong>Note:</strong> <code>{t.rule}</code></div>}
                            {t.analysis && <div className="issue-desc">{t.analysis}</div>}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Compound (Samāsa) Analysis */}
              {result.compounds && result.compounds.length > 0 && (
                <div className="compounds-section">
                  <h3>Samāsa Analysis (समास-विश्लेषणम्)</h3>
                  {result.compounds.map((c, i) => (
                    <div key={i} className="compound-card">
                      <div className="compound-header">
                        <span className="compound-text">{c.compound_text}</span>
                        <span className="compound-type-tag">{c.compound_type.split(" ")[0]}</span>
                      </div>
                      <div className="compound-body">
                        <div><strong>Type:</strong> {c.compound_type}</div>
                        <div><strong>Vigraha Vākya:</strong> <em>{c.vigraha_vakya}</em></div>
                        <div><strong>Components:</strong> {c.components.join(" + ")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Syntax Issues Summary */}
              {result.syntax_issues && result.syntax_issues.length > 0 && (
                <div className="syntax-summary">
                  <h3>Syntax Issues (वाक्य-दोष-सारांशः)</h3>
                  {result.syntax_issues.map((issue, i) => (
                    <div key={i} className={`syntax-issue-card ${issue.issue_type}`}>
                      <div className="syntax-issue-title">{issue.title}</div>
                      <div className="syntax-issue-token">Token: <strong>{issue.token_text}</strong></div>
                      {issue.suggested_text && (
                        <div className="syntax-issue-sug">
                          Suggested: <span className="highlight-text">{issue.suggested_text}</span>
                        </div>
                      )}
                      {issue.rule_sutra && (
                        <div className="syntax-issue-rule">Sutra: <code>{issue.rule_sutra}</code></div>
                      )}
                      <div className="syntax-issue-desc">{issue.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
