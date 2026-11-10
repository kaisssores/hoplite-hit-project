import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Session } from "@tether/sdk";
import { fmtAgo, fmtClock, fmtMs } from "../state/format";
import { vtName } from "../state/motion";
import { go, newSession, openSession, recall, removeSession, renameSession } from "../state/sync";
import { useStore } from "../state/store";
import { exchangeTone } from "../shell/Dock";
import { useNow } from "../ui/hooks";
import { Button, Empty, ICON, IconButton, MethodTag } from "../ui/primitives";

function SessionRow({ session, current, now }: { session: Session; current: boolean; now: number }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const save = () => {
    setEditing(false);
    if (title.trim() && title.trim() !== session.title) void renameSession(session.id, title.trim());
    else setTitle(session.title);
  };
  return (
    <li className="session" data-current={current || undefined} data-flip style={{ "--vt": vtName("ses", session.id) } as CSSProperties}>
      {editing ? (
        <form
          className="session-edit"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <input className="input" autoFocus value={title} aria-label="Session title" onChange={(event) => setTitle(event.target.value)} onBlur={save} />
        </form>
      ) : (
        <span className="session-title">{session.title}</span>
      )}
      <span className="muted">
        <span className="num">{session.exchanges}</span> {session.exchanges === 1 ? "request" : "requests"}
      </span>
      <span className="muted">{fmtAgo(session.updatedAt, now)}</span>
      <span className="session-actions">
        {current ? (
          <span className="session-here">
            <Check {...ICON} />
            Open here
          </span>
        ) : (
          <Button size="sm" onClick={() => void openSession(session.id)}>
            Resume
          </Button>
        )}
        <IconButton label="Rename" onClick={() => setEditing(true)}>
          <Pencil {...ICON} />
        </IconButton>
        <IconButton label="Delete session" onClick={() => void removeSession(session.id)}>
          <Trash2 {...ICON} />
        </IconButton>
      </span>
    </li>
  );
}

export function Sessions() {
  const sessions = useStore((state) => state.sessions);
  const sessionId = useStore((state) => state.sessionId);
  const exchanges = useStore((state) => state.exchanges);
  const apis = useStore((state) => state.apis);
  const now = useNow();
  const current = sessions.find((session) => session.id === sessionId);
  const history = exchanges.slice().reverse();

  return (
    <div className="view view-sessions">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Sessions</h1>
          <p className="view-meta">The server keeps every session, so work resumes from any window</p>
        </div>
        <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => void newSession()}>
          New session
        </Button>
      </header>

      <ul className="sessions enter">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} current={session.id === sessionId} now={now} />
        ))}
      </ul>

      <section className="module enter" data-flip style={{ "--vt": "ses-history" } as CSSProperties}>
        <header className="module-head">
          <h2 className="module-title">Requests in {current?.title ?? "this session"}</h2>
          <div className="module-meta num">{history.length}</div>
        </header>
        <div className="module-body">
        {history.length === 0 ? (
          <Empty
            title="Nothing sent in this session"
            action={
              <Button size="sm" onClick={() => go({ name: "playground" })}>
                Open the playground
              </Button>
            }
          />
        ) : (
          <table className="history">
            <thead>
              <tr>
                <th>Time</th>
                <th>Request</th>
                <th>API</th>
                <th>Result</th>
                <th className="right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {history.map((exchange) => {
                const tone = exchangeTone(exchange);
                return (
                  <tr
                    key={exchange.id}
                    tabIndex={0}
                    onClick={() => {
                      recall(exchange);
                      go({ name: "playground" });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        recall(exchange);
                        go({ name: "playground" });
                      }
                    }}
                  >
                    <td className="num muted">{fmtClock(exchange.startedAt)}</td>
                    <td>
                      <MethodTag method={exchange.request.method} /> <span className="mono">{exchange.request.path}</span>
                    </td>
                    <td className="muted">{apis.find((api) => api.id === exchange.request.apiId)?.name ?? exchange.request.apiId}</td>
                    <td data-tone={tone} className="history-result">
                      {exchange.state === "running" ? "In flight" : exchange.state === "failed" ? `No response · ${exchange.error?.code.replace(/_/g, " ")}` : (
                        <>
                          <span className="num">{exchange.response?.status}</span> {exchange.response?.statusText}
                        </>
                      )}
                    </td>
                    <td className="num right">{fmtMs(exchange.ms)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      </section>
    </div>
  );
}
