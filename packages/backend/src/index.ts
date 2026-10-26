/// <reference types="@caido/sdk-backend" />
import type { DefineAPI, SDK } from "caido:plugin";

import type {
  Contact,
  LookupApiResponse,
  LookupResult,
  LookupStatus,
} from "./types";

const LOOKUP_ENDPOINT = "https://lookup.disclose.io/api/lookup";
// A first-time (uncached) lookup for a large organization can take 30 to 40s
// server-side, so the client deadline must sit comfortably above that.
const REQUEST_TIMEOUT_MS = 60_000;
// The service sheds load with 503 + Retry-After when every lookup slot is busy.
// Retry once after the advertised delay (capped) before reporting failure.
const BUSY_RETRY_MAX_WAIT_S = 15;
const CLIENT_ID = "caido-lookup/0.2.1";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the lookup.disclose.io attribution API for a single asset.
 *
 * Runs in the Caido backend (LLRT) runtime, which provides a global `fetch`.
 * The lookup API is free, CORS-open and unauthenticated, so no key is sent.
 * All failure modes are caught and returned as a renderable `{ ok: false }`
 * result rather than thrown, so the frontend never sees an unhandled error.
 */
export async function lookup(sdk: SDK, input: string): Promise<LookupResult> {
  const asset = (input ?? "").trim();

  if (asset.length === 0) {
    return { ok: false, input: asset, error: "No asset provided to look up." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const send = () => fetch(LOOKUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `${CLIENT_ID} (+https://github.com/disclose/caido-lookup)`,
        "X-Lookup-Client": CLIENT_ID,
      },
      body: JSON.stringify({ input: asset }),
      signal: controller.signal,
    });

    let response = await send();
    if (response.status === 503) {
      const advertised = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
      const waitS = Number.isFinite(advertised) && advertised > 0
        ? Math.min(advertised, BUSY_RETRY_MAX_WAIT_S)
        : 5;
      sdk.console.log(`[caido-lookup] ${asset} -> service busy, retrying in ${waitS}s`);
      await sleep(waitS * 1000);
      response = await send();
    }

    let data: LookupApiResponse;
    try {
      data = (await response.json()) as LookupApiResponse;
    } catch {
      return {
        ok: false,
        input: asset,
        error: `Lookup returned a non-JSON response (HTTP ${response.status}).`,
      };
    }

    // Non-2xx responses are JSON ErrorEnvelopes that still carry a `status`.
    if (!response.ok) {
      const status = data.status ?? "error";
      const retryAfter = response.headers.get("retry-after");
      const limit = response.headers.get("ratelimit-limit");
      const rateDetail = response.status === 429
        ? ` Limit${limit ? ` ${limit}` : ""}${retryAfter ? `; retry after ${retryAfter}s` : ""}.`
        : response.status === 503
          ? ` The service is busy${retryAfter ? `; try again in ${retryAfter}s` : "; try again shortly"}.`
          : "";
      return {
        ok: false,
        input: asset,
        error: `Lookup failed (${status}, HTTP ${response.status}).${rateDetail}`,
      };
    }

    const status: LookupStatus = data.status ?? "complete";
    const contacts: Contact[] = Array.isArray(data.contacts)
      ? data.contacts
      : [];

    sdk.console.log(
      `[caido-lookup] ${asset} -> status=${status}, contacts=${contacts.length}`,
    );

    return {
      ok: true,
      input: asset,
      assetType: data.assetType,
      status,
      requestId: data.requestId,
      attribution: data.attribution ?? {},
      contacts,
      contactGroups: Array.isArray(data.contactGroups) ? data.contactGroups : [],
      routeSummary: data.routeSummary,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const message = aborted
      ? `Lookup timed out after ${REQUEST_TIMEOUT_MS / 1000}s. First-time lookups for large organizations can be slow; try again.`
      : `Lookup request failed: ${
          err instanceof Error ? err.message : String(err)
        }`;
    return { ok: false, input: asset, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// Re-export the result/contact types so the frontend can render typed results.
export type {
  Attribution,
  Confidence,
  Contact,
  ContactEntityRelation,
  ContactGroup,
  ContactRouteClass,
  LookupResult,
  LookupStatus,
  RouteSummary,
} from "./types";

// The backend API surface exposed over the RPC bridge.
// `DefineAPI` maps each name to a `(input) => ...` signature for the frontend;
// the registered callback additionally receives `sdk` as its first argument.
export type API = DefineAPI<{
  lookup: typeof lookup;
}>;

export function init(sdk: SDK<API>) {
  sdk.api.register("lookup", lookup);
}
