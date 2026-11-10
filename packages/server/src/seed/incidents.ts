import type { Incident } from "@tether/contract";
import { DAY, HOUR, MINUTE } from "../util.ts";

/** Newest first, like the route returns them. */
export function buildIncidents(now: number): Incident[] {
  return [
    {
      id: "inc_messaging_sms",
      apiId: "messaging",
      title: "Elevated latency on SMS delivery",
      status: "identified",
      startedAt: now - 3 * HOUR,
      resolvedAt: null,
      updates: [
        { at: now - 3 * HOUR, text: "We are investigating slow SMS delivery. Email and push are not affected." },
        { at: now - 2 * HOUR - 10 * MINUTE, text: "The slowdown comes from one upstream carrier route. Messages are still delivered, with delays of up to a minute." },
        { at: now - 35 * MINUTE, text: "Traffic is being moved to a second carrier. Latency should recover over the next hour." },
      ],
    },
    {
      id: "inc_reports_maintenance",
      apiId: "reports",
      title: "Scheduled maintenance for Reports",
      status: "scheduled",
      startedAt: now - 20 * MINUTE,
      resolvedAt: null,
      updates: [
        { at: now - 2 * DAY, text: "Reports will be unavailable while we migrate export storage. Running exports finish before the window opens." },
        { at: now - 20 * MINUTE, text: "Maintenance has started and is expected to finish at 19:00 UTC." },
      ],
    },
    {
      id: "inc_search_index_lag",
      apiId: "search",
      title: "Delayed visibility of newly indexed documents",
      status: "resolved",
      startedAt: now - 9 * DAY - 4 * HOUR,
      resolvedAt: now - 9 * DAY - HOUR,
      updates: [
        { at: now - 9 * DAY - 4 * HOUR, text: "New documents are taking up to two minutes to appear in search results." },
        { at: now - 9 * DAY - 2 * HOUR, text: "A stuck indexing worker was replaced and the backlog is draining." },
        { at: now - 9 * DAY - HOUR, text: "The backlog is clear and documents are searchable within a second again." },
      ],
    },
    {
      id: "inc_payments_declines",
      apiId: "payments",
      title: "Card declines from one issuer network",
      status: "resolved",
      startedAt: now - 17 * DAY - 6 * HOUR,
      resolvedAt: now - 17 * DAY - 3 * HOUR,
      updates: [
        { at: now - 17 * DAY - 6 * HOUR, text: "Some card payments are being declined with issuer_unavailable. Wallet payments are not affected." },
        { at: now - 17 * DAY - 4 * HOUR, text: "The issuer network confirmed a fault on their side and is working on a fix." },
        { at: now - 17 * DAY - 3 * HOUR, text: "The issuer network has recovered. Declined payments can be retried." },
      ],
    },
  ];
}
