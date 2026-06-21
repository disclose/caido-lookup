/// <reference types="@caido/sdk-backend" />
import type { DefineAPI, SDK } from "caido:plugin";

import type {
  Contact,
  LookupApiResponse,
  LookupResult,
  LookupStatus,
} from "./types";

const LOOKUP_ENDPOINT = "https://lookup.disclose.io/api/lookup";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Calls the lookup.disclose.io attribution API for a single asset.
 *
 * Runs in the Caido backend (LLRT) runtime, which provides a global `fetch`.
 * The lookup API is free, CORS-open and unauthenticated, so no key is sent.
 * All failure modes are caught and returned as a renderable `{ ok: false }`
 * result rather than thrown, so the frontend never sees an unhandled error.
 */
async function lookup(sdk: SDK, input: string): Promise<LookupResult> {
  const asset = (input ?? "").trim();

  if (asset.length === 0) {
    return { ok: false, input: asset, error: "No asset provided to look up." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(LOOKUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ input: asset }),
      signal: controller.signal,
    });

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
      return {
        ok: false,
        input: asset,
        error: `Lookup failed (${status}, HTTP ${response.status}).`,
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
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const message = aborted
      ? `Lookup timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
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
  LookupResult,
  LookupStatus,
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
