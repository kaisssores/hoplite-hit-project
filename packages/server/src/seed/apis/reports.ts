import { endpoint, official, path, query } from "../dsl.ts";

const exportJob = {
  id: "exp_8Bv3QmLd",
  type: "transactions",
  format: "csv",
  status: "complete",
  rows: 48210,
  download_url: "https://download.tether.dev/exports/exp_8Bv3QmLd.csv?sig=4e2a",
  created: 1793923200,
};

export const reports = official({
  id: "reports",
  name: "Reports",
  summary: "Scheduled and on-demand data exports",
  description:
    "Reports builds CSV and Parquet exports of transactions, balances and activity. Exports run in the background; poll the export until its status is complete, then download the file. This API is deprecated and will be replaced by Exports v2.",
  category: "Data",
  owner: "Data products",
  adapter: "rest",
  version: "1.1.0",
  stability: "deprecated",
  baseUrl: "https://api.tether.dev/reports",
  auth: "api_key",
  rateLimit: 60,
  registeredAt: "2024-02-27T12:00:00Z",
  scopes: [
    { name: "exports.read", description: "Read export status and download exports" },
    { name: "exports.write", description: "Start exports" },
  ],
  endpoints: [
    endpoint("reports.create-export", "POST", "/v1/exports", "Create an export", {
      description: "Starts a background export. Large ranges can take several minutes.",
      scope: "exports.write",
      body: { type: "transactions", format: "csv", from: "2026-10-01", to: "2026-10-31" },
      status: 201,
      response: { ...exportJob, status: "running", rows: 0, download_url: null, created: 1794268800 },
    }),
    endpoint("reports.get-export", "GET", "/v1/exports/{id}", "Retrieve an export", {
      description: "Returns an export and, once complete, a download URL valid for one hour.",
      scope: "exports.read",
      params: [path("id", "Export id, starting with exp_", "exp_8Bv3QmLd")],
      response: exportJob,
    }),
    endpoint("reports.list-exports", "GET", "/v1/exports", "List exports", {
      description: "Returns exports, newest first.",
      scope: "exports.read",
      params: [query("limit", "integer", "Number of exports to return", { example: "2" }), query("status", "string", "Only exports in this status", { example: "complete" })],
      response: {
        data: [exportJob, { ...exportJob, id: "exp_5Tn7KcWp", type: "balances", format: "parquet", rows: 1204, created: 1793318400 }],
        has_more: true,
        next_cursor: "cur_exp_5Tn7KcWp",
      },
    }),
  ],
  changelog: [
    { version: "1.1.0", date: "2026-08-11", note: "Deprecated in favour of Exports v2, which is due in the first quarter of 2027" },
    { version: "1.0.4", date: "2026-05-27", note: "Parquet exports include a schema version in the file metadata" },
    { version: "1.0.0", date: "2026-01-15", note: "Exports return a signed download_url once complete" },
  ],
});
