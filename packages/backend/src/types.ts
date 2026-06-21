// Shape of the lookup.disclose.io POST /api/lookup response that this plugin
// consumes. Source of truth: https://lookup.disclose.io/openapi.yaml and
// https://lookup.disclose.io/llms-full.txt. This is a deliberately partial
// view — only the fields the plugin renders are typed.

export type Confidence = "high" | "medium" | "low";

/** Engine statuses plus the server-added non-2xx statuses. */
export type LookupStatus =
  | "complete"
  | "partial"
  | "failed"
  | "rate_limited"
  | "not_found"
  | "error";

export interface Attribution {
  organization?: string;
  jurisdiction?: string;
  confidence?: Confidence;
  parentCompany?: string;
}

export interface Contact {
  type: string;
  value: string;
  confidence?: Confidence;
  source?: string;
  label?: string;
  verified?: boolean;
}

/** Raw API response (partial). */
export interface LookupApiResponse {
  input?: string;
  assetType?: string;
  status?: LookupStatus;
  requestId?: string;
  hasErrors?: boolean;
  attribution?: Attribution;
  contacts?: Contact[];
}

/**
 * Result returned by the backend RPC to the frontend.
 * `ok: true` carries the parsed lookup; `ok: false` carries a renderable error.
 */
export type LookupResult =
  | {
      ok: true;
      input: string;
      assetType: string | undefined;
      status: LookupStatus;
      requestId: string | undefined;
      attribution: Attribution;
      contacts: Contact[];
    }
  | {
      ok: false;
      input: string;
      error: string;
    };
