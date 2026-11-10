import { ChevronRight } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { Incident, Usage as UsageData, UsageModule, UsageRange } from "@tether/sdk";
import { fmtAgo, fmtClock, fmtCompact, fmtDayShort, fmtDelta, fmtInt, fmtMs, fmtPct } from "../state/format";
import { transition, vtName } from "../state/motion";
import { fetchUsage, go } from "../state/sync";
import { useStore } from "../state/store";
import { Modules } from "../shell/Rig";
import { Chart, Ranked } from "../ui/Chart";
import { useNow } from "../ui/hooks";
import { ICON, Segmented } from "../ui/primitives";

const memory = { range: "24h" as UsageRange };

const TITLES: Record<UsageModule, string> = {
  traffic: "Traffic",
  "by-api": "By API",
  quota: "Quota",
  "by-key": "By key",
  incidents: "Incidents",
};

const RANGE_WORDS: Record<UsageRange, string> = { "24h": "previous 24 h", "7d": "previous 7 d", "30d": "previous 30 d" };

const INCIDENT_STATE: Record<Incident["status"], string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
};

function IncidentRow({ incident, apiName, now }: { incident: Incident; apiName: string; now: number }) {
  const [open, setOpen] = useState(incident.status !== "resolved" && incident.status !== "scheduled");
  const live = incident.status !== "resolved";
  return (
    <li className="incident" data-open={open || undefined} data-flip style={{ "--vt": vtName("inc", incident.id) } as CSSProperties}>
      <button type="button" className="incident-head" aria-expanded={open} onClick={() => void transition("flip", () => setOpen(!open))}>
        <ChevronRight {...ICON} className="ep-chevron" />
        <span className="incident-title">{incident.title}</span>
        <span className="muted">{apiName}</span>
        <span className="incident-state" data-live={live || undefined} data-status={incident.status}>
          {INCIDENT_STATE[incident.status]}
        </span>
        <span className="muted num">{fmtAgo(incident.startedAt, now)}</span>
      </button>
      {open && (
        <ol className="incident-updates">
          {incident.updates
            .slice()
            .reverse()
            .map((update) => (
              <li key={update.at}>
                <span className="num muted">
                  {fmtDayShort(update.at)}, {fmtClock(update.at, false)}
                </span>
                <span>{update.text}</span>
              </li>
            ))}
        </ol>
      )}
    </li>
  );
}

export function Usage() {
  const apis = useStore((state) => state.apis);
  const keys = useStore((state) => state.keys);
  const incidents = useStore((state) => state.incidents);
  // Refetch when a request of ours finishes, so the figures include it.
  const finished = useStore((state) => state.exchanges.filter((exchange) => exchange.state !== "running").length);
  const [range, setRange] = useState(memory.range);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const now = useNow();

  useEffect(() => {
    memory.range = range;
    let stale = false;
    void fetchUsage(range).then((data) => {
      if (!stale) setUsage(data);
    });
    return () => {
      stale = true;
    };
  }, [range, finished]);

  const apiName = (id: string) => apis.find((api) => api.id === id)?.name ?? id;
  const formatX = (time: number) => (range === "24h" ? fmtClock(time, false) : fmtDayShort(time));
  const shown = usage?.range === range ? usage : null;
  // The newest bucket is still filling, so drawing it would look like a collapse in traffic.
  const settled = shown?.buckets.slice(0, -1) ?? [];
  const before = shown?.previous.slice(0, -1) ?? [];

  return (
    <div className="view view-usage">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Usage</h1>
          <p className="view-meta">Traffic signed by your keys across every API</p>
        </div>
        <Segmented
          label="Range"
          value={range}
          options={[
            { value: "24h", label: "24 h" },
            { value: "7d", label: "7 d" },
            { value: "30d", label: "30 d" },
          ]}
          onChange={setRange}
        />
      </header>

      {shown && (
        <>
          <dl className="figures figures-row enter" key={range}>
            <div>
              <dt>Requests</dt>
              <dd className="num">{fmtInt(shown.totals.requests)}</dd>
              <dd className="figure-note">
                <span className="num">{fmtDelta(shown.totals.requests, shown.totals.previousRequests)}</span> vs {RANGE_WORDS[range]}
              </dd>
            </div>
            <div>
              <dt>Error rate</dt>
              <dd className="num">{fmtPct(shown.totals.errors / Math.max(1, shown.totals.requests))}</dd>
              <dd className="figure-note">
                <span className="num">{fmtInt(shown.totals.errors)}</span> failed requests
              </dd>
            </div>
            <div>
              <dt>Median latency</dt>
              <dd className="num">{fmtMs(shown.totals.p50)}</dd>
              <dd className="figure-note">Across all APIs you call</dd>
            </div>
            <div>
              <dt>Quota used</dt>
              <dd className="num">{fmtPct(shown.quota.used / shown.quota.limit, 1)}</dd>
              <dd className="figure-note">
                Resets <span className="num">{fmtDayShort(shown.quota.resetsAt)}</span>
              </dd>
            </div>
          </dl>

          <Modules<UsageModule> page="usage" titles={TITLES}>
            {(module) => {
              if (module === "traffic") {
                return {
                  meta: (
                    <span className="legend">
                      <span data-tone="lead">This period</span>
                      <span data-tone="quiet">Previous</span>
                      <span data-tone="bar">Errors</span>
                    </span>
                  ),
                  body: (
                    <Chart
                      height={300}
                      times={settled.map((bucket) => bucket.t)}
                      lines={[
                        { id: "previous", label: "Previous", values: before.map((bucket) => bucket.requests), tone: "quiet", dashed: true },
                        { id: "current", label: "Requests", values: settled.map((bucket) => bucket.requests), tone: "lead" },
                      ]}
                      bars={{ label: "Errors", values: settled.map((bucket) => bucket.errors) }}
                      formatY={fmtCompact}
                      formatX={formatX}
                    />
                  ),
                };
              }
              if (module === "by-api") {
                return {
                  meta: "Requests, with the share that failed",
                  body: (
                    <Ranked
                      rows={shown.byApi.map((row, index) => ({
                        id: row.apiId,
                        label: apiName(row.apiId),
                        value: row.requests,
                        text: fmtInt(row.requests),
                        note: `${fmtPct(row.errors / Math.max(1, row.requests))} failed · ${fmtMs(row.p50)}`,
                        lead: index === 0,
                        onClick: () => go({ name: "api", id: row.apiId }),
                      }))}
                    />
                  ),
                };
              }
              if (module === "quota") {
                const ratio = shown.quota.used / shown.quota.limit;
                return {
                  meta: `Resets ${fmtDayShort(shown.quota.resetsAt)}`,
                  body: (
                    <div className="quota">
                      <p className="quota-figure">
                        <span className="num">{fmtInt(shown.quota.used)}</span>
                        <span className="muted">
                          of <span className="num">{fmtInt(shown.quota.limit)}</span> requests this month
                        </span>
                      </p>
                      <div className="quota-track" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <span className="quota-bar" style={{ transform: `scaleX(${Math.min(1, ratio)})` }} />
                      </div>
                    </div>
                  ),
                };
              }
              if (module === "by-key") {
                return {
                  body: (
                    <Ranked
                      rows={shown.byKey.map((row) => ({
                        id: row.keyId,
                        label: keys.find((key) => key.id === row.keyId)?.name ?? row.keyId,
                        value: row.requests,
                        text: fmtInt(row.requests),
                        onClick: () => go({ name: "keys" }),
                      }))}
                    />
                  ),
                };
              }
              return {
                meta: `${incidents.filter((incident) => incident.status !== "resolved").length} open`,
                body: (
                  <ul className="incidents">
                    {incidents.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} apiName={apiName(incident.apiId)} now={now} />
                    ))}
                  </ul>
                ),
              };
            }}
          </Modules>
        </>
      )}
    </div>
  );
}
