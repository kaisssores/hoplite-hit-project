import type { Api } from "@tether/contract";
import { files } from "./apis/files.ts";
import { geo } from "./apis/geo.ts";
import { identity } from "./apis/identity.ts";
import { ledger } from "./apis/ledger.ts";
import { MESSAGING_BATCH_ENDPOINT, messaging } from "./apis/messaging.ts";
import { payments } from "./apis/payments.ts";
import { reports } from "./apis/reports.ts";
import { search } from "./apis/search.ts";
import { storefront } from "./apis/storefront.ts";
import { webhooks } from "./apis/webhooks.ts";

/** Official catalog in display order. Always rebuilt from code, never read from the data file. */
export const OFFICIAL_APIS: Api[] = [identity, payments, ledger, messaging, files, search, storefront, geo, reports, webhooks];

/** Endpoints that never answer, so the playground can show a failed upstream hop on demand. */
export const TIMEOUT_ENDPOINTS: ReadonlySet<string> = new Set([MESSAGING_BATCH_ENDPOINT]);
