
import { useEffect, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STAGES = [
  {
    name: "Opening",
    purpose: "Reach the right person and say who you are.",
    examples: [
      "Who is calling?",
      "What is this about?",
      "I'm in a meeting right now.",
    ],
    actions: [
      "Reached the right person",
      "Assistant or switchboard answered",
      "Prospect is busy",
      "Wrong person or number",
    ],
  },
  {
    name: "Purpose",
    purpose: "Explain why you called in one or two clear sentences.",
    examples: [
      "What does your company do?",
      "Where did you get my number?",
      "Is this a sales call?",
    ],
    actions: [
      "Asked what we do",
      "Asked where we got the number",
      "Said it is a sales call",
      "Let me continue",
    ],
  },
  {
    name: "Permission",
    purpose: "Find out whether they are willing to talk now.",
    examples: [
      "Call me after two.",
      "Okay, go ahead.",
      "Send me something first.",
    ],
    actions: [
      "Agreed to talk",
      "Asked for a callback",
      "Asked for information first",
      "Declined to talk",
    ],
  },
  {
    name: "Their business",
    purpose: "Ask about their company and work before discussing yours.",
    examples: [
      "We are a small team.",
      "That's not the work our division does.",
      "Tell me about your company first.",
    ],
    actions: [
      "Explained their business",
      "Corrected my understanding",
      "Asked about our company",
      "Gave a short answer",
    ],
  },
  {
    name: "Their need, in their words",
    purpose: "Capture exactly what the prospect is trying to achieve or struggling with.",
    examples: [
      "We want to enter a new market.",
      "Everything is going well right now.",
      "What can you do for a company like ours?",
    ],
    actions: [
      "Identified a goal",
      "Described a problem",
      "Said there is no current need",
      "Asked what we can offer",
    ],
  },
  {
    name: "Objection",
    purpose: "Understand the reason for resistance without talking over the prospect.",
    examples: [
      "We already have an agency.",
      "You should speak to the owner.",
      "Send something in writing.",
    ],
    actions: [
      "Already has a provider",
      "Not the decision-maker",
      "Requested written information",
      "Not interested",
    ],
  },
  {
    name: "Next step",
    purpose: "Agree on one concrete action, time, or channel.",
    examples: [
      "Call me tomorrow morning.",
      "Send the document by email.",
      "Speak to my colleague instead.",
    ],
    actions: [
      "Meeting agreed",
      "Callback time agreed",
      "Send information",
      "Referral to a colleague",
    ],
  },
  {
    name: "Close",
    purpose: "End clearly and record the outcome and next step.",
    examples: [
      "Thanks, speak to you then.",
      "I'm not interested, thank you.",
      "The line has disconnected.",
    ],
    actions: [
      "Meeting arranged",
      "Callback arranged",
      "Information requested",
      "No interest",
      "Referred to someone else",
      "Disconnected or hung up",
      "Other outcome",
    ],
  },
];

function formatDate(value) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function App() {
  const [view, setView] = useState("call");
  const [call, setCall] = useState(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState("");
  const [prospectWords, setProspectWords] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const stage = STAGES[stageIndex];

  async function loadHistory() {
    try {
      const response = await fetch(`${API_URL}/calls`);

      if (!response.ok) {
        throw new Error("Could not load call history.");
      }

      const data = await response.json();
      setHistory(data.calls || []);
    } catch {
      setError("Could not connect to the backend. Is FastAPI running?");
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function startCall(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_name: prospectName.trim() || "Unnamed prospect",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not start the call.");
      }

      setCall(data.call);
      setStageIndex(0);
      setSelectedAction("");
      setProspectWords("");
      setProspectName("");
      setNotice("Call started. Your stage results will be saved as you progress.");
      await loadHistory();
    } catch (err) {
      setError(err.message || "Could not start the call.");
    } finally {
      setLoading(false);
    }
  }


async function saveCurrentStage() {
  if (!call) return false;

  const response = await fetch(
    `${API_URL}/calls/${call.id}/stages/${stageIndex + 1}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage_status: "completed",
        what_happened: selectedAction || null,
        prospect_words: prospectWords.trim() || null,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Could not save this stage.");
  }

  return true;
}

async function moveToStage(index) {
  if (!call || index < 0 || index > 7) return;

  setLoading(true);
  setError("");
  setNotice("");

  try {
    await saveCurrentStage();

    setStageIndex(index);
    setSelectedAction("");
    setProspectWords("");
    setNotice("Stage saved successfully.");
    await loadHistory();
  } catch (err) {
    setError(err.message || "Could not save stage.");
  } finally {
    setLoading(false);
  }
}

async function endLocalCall() {
  if (!call || loading) return;

  const outcome = window.prompt(
    "How did the call end? (e.g. Meeting arranged, Callback, No interest)"
  );

  if (!outcome || !outcome.trim()) return;

  const nextStep = window.prompt(
    "What is the agreed next step? Leave blank if none."
  );

  setLoading(true);
  setError("");
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/calls/${call.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_stage: stageIndex + 1,
        outcome: outcome.trim(),
        next_step: nextStep?.trim() || null,
        what_happened: selectedAction || null,
        prospect_words: prospectWords.trim() || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not close the call.");
    }

    setCall(null);
    setStageIndex(0);
    setSelectedAction("");
    setProspectWords("");
    setNotice("Call closed and saved successfully.");
    await loadHistory();
  } catch (err) {
    setError(err.message || "Could not close the call.");
  } finally {
    setLoading(false);
  }
}

async function generateAISummary() {
  if (!call?.id || summaryLoading) return;

  setSummaryLoading(true);
  setSummaryError("");
  setAiSummary("");

  try {
    const response = await fetch(
      `${API_URL}/calls/${call.id}/summary`,
      { method: "POST" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not generate summary.");
    }

    setAiSummary(data.summary);
    setNotice("AI summary generated and saved.");
    await loadHistory();
  } catch (err) {
    setSummaryError(err.message || "AI summary failed.");
  } finally {
    setSummaryLoading(false);
  }
}
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setView("call")}
          aria-label="Go to live call"
        >
          <span className="brand-mark">C</span>
          <span>CallPilot</span>
        </button>

        <nav className="nav-tabs" aria-label="Main navigation">
          <button
            className={view === "call" ? "nav-tab active" : "nav-tab"}
            onClick={() => setView("call")}
          >
            <span>◉</span> Live call
          </button>
          <button
            className={view === "history" ? "nav-tab active" : "nav-tab"}
            onClick={() => {
              setView("history");
              loadHistory();
            }}
          >
            <span>↺</span> Call history
          </button>
        </nav>

        <span className="connection-label">
          <span className="status-dot" />
          Local workspace
        </span>
      </header>

      <main className="main-content">
        {error && (
          <div className="message error-message" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="message info-message" role="status">
            {notice}
          </div>
        )}

        {view === "call" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">CALL WORKSPACE</p>
                <h1>Keep the conversation moving.</h1>
                <p className="subtitle">
                  Your call structure, one stage at a time.
                </p>
              </div>
              {call && (
                <span className="live-pill">
                  <span className="status-dot" /> Call in progress
                </span>
              )}
            </div>

            {!call ? (
              <section className="start-card">
                <div className="start-icon">↗</div>
                <h2>Start a new call</h2>
                <p>
                  Create a call record before you dial. You can leave the
                  prospect name blank if you prefer.
                </p>

                <form onSubmit={startCall} className="start-form">
                  <label htmlFor="prospect-name">Prospect or company</label>
                  <input
                    id="prospect-name"
                    value={prospectName}
                    onChange={(event) => setProspectName(event.target.value)}
                    placeholder="e.g. Acme Industries"
                    maxLength={200}
                  />
                  <button className="primary-button" disabled={loading}>
                    {loading ? "Starting..." : "Start call →"}
                  </button>
                </form>
              </section>
            ) : (
              <>
                <section className="call-context">
                  <div>
                    <p className="eyebrow">CURRENT PROSPECT</p>
                    <h2>{call.prospect_name}</h2>
                    <p className="context-meta">
                      Call started {formatDate(call.started_at)}
                    </p>
                  </div>
                  <button className="end-button" onClick={endLocalCall}>
                    End call
                  </button>
                </section>

                <section className="progress-card">
                  <div className="progress-top">
                    <span className="eyebrow">CALL PROGRESS</span>
                    <span className="progress-count">
                      Stage {stageIndex + 1} of 8
                    </span>
                  </div>
                  <div className="stage-track">
                    {STAGES.map((item, index) => (
                      <button
                        key={item.name}
                        className={[
                          "stage-step",
                          index === stageIndex ? "current" : "",
                          index < stageIndex ? "visited" : "",
                        ].join(" ")}
                        onClick={() => moveToStage(index)}
                        title={item.name}
                        aria-label={`Go to stage ${index + 1}: ${item.name}`}
                      >
                        <span className="stage-number">
                          {index < stageIndex ? "✓" : index + 1}
                        </span>
                        <span className="stage-name">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="workspace-grid">
                  <section className="stage-card">
                    <div className="stage-card-heading">
                      <div>
                        <p className="eyebrow">
                          STAGE {String(stageIndex + 1).padStart(2, "0")}
                        </p>
                        <h2>{stage.name}</h2>
                      </div>
                      <span className="stage-badge">
                        {stageIndex + 1}/8
                      </span>
                    </div>

                    <div className="purpose-panel">
                      <span className="panel-label">THE PURPOSE</span>
                      <p>{stage.purpose}</p>
                    </div>

                    <div className="examples-section">
                      <h3>What they may say</h3>
                      <p className="section-hint">
                        Reference examples — refine these using the transcripts.
                      </p>
                      <ul className="example-list">
                        {stage.examples.map((example) => (
                          <li key={example}>
                            <span className="quote-mark">“</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="actions-section">
                      <h3>What happened?</h3>
                      <p className="section-hint">
                        Choose the closest response.
                      </p>
                      <div className="action-grid">
                        {stage.actions.map((action) => (
                          <button
                            key={action}
                            className={
                              selectedAction === action
                                ? "action-button selected"
                                : "action-button"
                            }
                            onClick={() => setSelectedAction(action)}
                          >
                            <span className="action-check">
                              {selectedAction === action ? "✓" : "+"}
                            </span>
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="words-section">
                      <label htmlFor="prospect-words">
                        Prospect's words
                        <span className="optional-label">VERBATIM</span>
                      </label>
                      <textarea
                        id="prospect-words"
                        value={prospectWords}
                        onChange={(event) =>
                          setProspectWords(event.target.value)
                        }
                        placeholder="Capture their exact words, especially at the need stage..."
                        rows={3}
                      />
                      <p className="section-hint">
                        Preserve their wording instead of rewriting it.
                      </p>
                    </div>

                    <div className="stage-footer">
                      <button
                        className="secondary-button"
                        disabled={stageIndex === 0}
                        onClick={() => moveToStage(stageIndex - 1)}
                      >
                        ← Previous
                      </button>
                      {stageIndex < 7 ? (
                        <button
                          className="primary-button"
                          onClick={() => moveToStage(stageIndex + 1)}
                        >
                          Next: {STAGES[stageIndex + 1].name} →
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={endLocalCall}
                        >
                          Finish call
                        </button>
                      )}
                    </div>
                    
                    <div className="ai-summary-section">
                      <h3>AI Call Summary</h3>

                      <p>
                        Generate a concise summary of the saved prospect responses,
                        objections, outcome, and next step.
                      </p>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={generateAISummary}
                        disabled={summaryLoading || loading}
                      >
                        {summaryLoading ? "Generating..." : "Generate AI Summary"}
                      </button>

                      {summaryError && (
                        <p className="summary-error" role="alert">
                          {summaryError}
                        </p>
                      )}

                      {aiSummary && (
                        <div className="ai-summary-result">
                          <h4>Generated Summary</h4>
                          <p style={{ whiteSpace: "pre-wrap" }}>{aiSummary}</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <aside className="side-card">
                    <div className="side-icon">✳</div>
                    <h3>Stay present.</h3>
                    <p>
                      Listen first. Record what happened with one tap and
                      capture the prospect's words without interrupting
                      the conversation to fill out a form.
                    </p>
                    <div className="side-divider" />
                    <p className="side-label">UP NEXT</p>
                    <h4>
                      {stageIndex < 7
                        ? STAGES[stageIndex + 1].name
                        : "Record the outcome"}
                    </h4>
                    <p className="side-hint">
                      {stageIndex < 7
                        ? STAGES[stageIndex + 1].purpose
                        : "Record what happened before ending the call."}
                    </p>
                    <div className="side-divider" />
                    <p className="side-hint">
                      Stage results are not yet saved. We'll connect the
                      save and close actions to the backend in the next step.
                    </p>
                  </aside>
                </div>
              </>
            )}
          </>
        )}

        {view === "history" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR ACTIVITY</p>
                <h1>Call history</h1>
                <p className="subtitle">
                  Review calls saved in your database.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => setView("call")}
              >
                + New call
              </button>
            </div>

            <section className="history-card">
              <div className="history-heading">
                <h2>Previous calls</h2>
                <button className="text-button" onClick={loadHistory}>
                  ↻ Refresh
                </button>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  <div className="start-icon">↺</div>
                  <h3>No calls yet</h3>
                  <p>Start a call to see it appear here.</p>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((item) => (
                    <article className="history-row" key={item.id}>
                      <div className="history-avatar">
                        {(item.prospect_name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="history-details">
                        <h3>{item.prospect_name}</h3>
                        <p>{formatDate(item.started_at)}</p>
                      </div>
                      <div className="history-stage">
                        <span className="history-stage-number">
                          Stage {item.current_stage || 1} of 8
                        </span>
                        <span className="history-outcome">
                          {item.outcome || "Outcome not recorded"}
                        </span>
                      </div>
                      <span
                        className={
                          item.status === "completed"
                            ? "status-tag completed"
                            : "status-tag in-progress"
                        }
                      >
                        {item.status === "completed"
                          ? "Completed"
                          : "In progress"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>CallPilot · Cold-call guide</span>
        <span>Built for focused conversations.</span>
      </footer>
    </div>
  );
}

export default App;
