import { useMemo, type ReactNode } from "react";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function highlightJson(line: string, key: number): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const at = match.index;
    if (at > last) parts.push(line.slice(last, at));
    if (match[1] && match[2]) {
      parts.push(
        <span key={at} className="tok-key">
          {match[1]}
        </span>,
        match[2],
      );
    } else if (match[1]) {
      parts.push(
        <span key={at} className="tok-str">
          {match[1]}
        </span>,
      );
    } else {
      parts.push(
        <span key={at} className="tok-num">
          {match[0]}
        </span>,
      );
    }
    last = at + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <span key={key}>{parts}</span>;
}

/** A read-only block of code with a line gutter. JSON is tokenized; anything else is plain. */
export function Code({ text, json = false, gutter = true, className = "" }: { text: string; json?: boolean; gutter?: boolean; className?: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  return (
    <pre className={`code ${gutter ? "code-gutter" : ""} ${className}`}>
      <code>
        {lines.map((line, index) => (
          <span className="code-line" key={index}>
            {json ? highlightJson(line, index) : line}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}

export function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
