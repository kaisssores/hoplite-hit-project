import { CirclePlus, KeyRound, PanelsTopLeft, Plus, RotateCw, Trash2, Ban, Flag } from "lucide-react";
import { useMemo } from "react";
import type { Activity, Exchange } from "@tether/sdk";
import { HOP_LABEL, fmtClock, fmtMs } from "../state/format";
import { go, newSession, openSession, recall } from "../state/sync";
import { useStore } from "../state/store";
import { vtName } from "../state/motion";
import { useElapsed } from "../ui/hooks";
import { TensionGlyph } from "../ui/Line";
import { ICON, IconButton, MethodTag, Select } from "../ui/primitives";
import { RegionTag } from "./Rig";

const KIND_ICON: Record<string, typeof KeyRound> = {
  "session.started": Flag,
  "key.created": KeyRound,
  "key.rotated": RotateCw,
  "key.revoked": Ban,
  "api.registered": CirclePlus,
  "api.removed": Trash2,
  "layout.saved": PanelsTopLeft,
};

export function exchangeTone(exchange: Exchange): "running" | "ok" | "warn" | "bad" {
  if (exchange.state === "running") return "running";
  if (exchange.state === "failed") return "bad";
  const status = exchange.response?.status ?? 0;
  return status >= 500 ? "bad" : status >= 400 ? "warn" : "ok";
}

function Running({ exchange }: { exchange: Exchange }) {
  const elapsed = useElapsed(true);
  const hop = exchange.phases[exchange.phases.length - 1]?.hop ?? "queue";
  return (
    <>
      {HOP_LABEL[hop]} <span className="num">{fmtMs(elapsed)}</span>
    </>
  );
}

function ExchangeRow({ entry, exchange, fresh }: { entry: Activity; exchange: Exchange; fresh: boolean }) {
  const active = useStore((state) => state.activeExchangeId === exchange.id);
  const tone = exchangeTone(exchange);
  return (
    <li className="act" data-flip style={{ "--vt": vtName("act", entry.id) } as React.CSSProperties} data-fresh={fresh || undefined}>
      <button
        type="button"
        className="act-row"
        data-active={active || undefined}
        onClick={() => {
          recall(exchange);
          go({ name: "playground" });
        }}
      >
        <span className="act-time num">{fmtClock(entry.at)}</span>
        <span className="act-glyph" data-tone={tone}>
          <TensionGlyph tension={exchange.state === "failed" ? "snapped" : "taut"} />
        </span>
        <span className="act-title">
          <MethodTag method={exchange.request.method} /> <span className="mono">{exchange.request.path}</span>
        </span>
        <span className="act-detail" data-tone={tone}>
          {exchange.state === "running" ? (
            <Running exchange={exchange} />
          ) : exchange.state === "failed" ? (
            <>No response · {exchange.error?.code.replace(/_/g, " ")}</>
          ) : (
            <>
              <span className="num">{exchange.response?.status}</span> · <span className="num">{fmtMs(exchange.ms)}</span> · {entry.detail}
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function PlainRow({ entry, fresh }: { entry: Activity; fresh: boolean }) {
  const Icon = KIND_ICON[entry.kind] ?? Flag;
  return (
    <li className="act" data-flip style={{ "--vt": vtName("act", entry.id) } as React.CSSProperties} data-fresh={fresh || undefined}>
      <div className="act-row">
        <span className="act-time num">{fmtClock(entry.at)}</span>
        <span className="act-glyph">
          <Icon {...ICON} />
        </span>
        <span className="act-title">{entry.title}</span>
        {entry.detail && <span className="act-detail">{entry.detail}</span>}
      </div>
    </li>
  );
}

/** The session's activity, as it happens. Every row arrives over the event stream. */
export function Dock() {
  const activity = useStore((state) => state.activity);
  const exchanges = useStore((state) => state.exchanges);
  const sessions = useStore((state) => state.sessions);
  const sessionId = useStore((state) => state.sessionId);
  const bootedAt = useStore((state) => state.bootedAt);
  const rig = useStore((state) => state.rig);
  const byId = useMemo(() => new Map(exchanges.map((exchange) => [exchange.id, exchange])), [exchanges]);
  const rows = useMemo(() => activity.slice().reverse(), [activity]);

  return (
    <aside className="dock" aria-label="Session activity">
      <header className="dock-head">
        <Select
          className="dock-session"
          label="Session"
          value={sessionId}
          options={sessions.map((session) => ({
            value: session.id,
            label: session.title,
            meta: <span className="num">{session.exchanges}</span>,
          }))}
          onChange={(id) => void openSession(id)}
        />
        <IconButton label="New session" onClick={() => void newSession()}>
          <Plus {...ICON} />
        </IconButton>
      </header>
      <ol className="dock-list">
        {rows.map((entry) => {
          const exchange = entry.ref?.type === "exchange" ? byId.get(entry.ref.id) : undefined;
          const fresh = entry.at > bootedAt;
          return exchange ? (
            <ExchangeRow key={entry.id} entry={entry} exchange={exchange} fresh={fresh} />
          ) : (
            <PlainRow key={entry.id} entry={entry} fresh={fresh} />
          );
        })}
      </ol>
      {rig && <RegionTag region="dock" label="Dock" />}
    </aside>
  );
}
