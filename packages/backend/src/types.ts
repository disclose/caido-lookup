// Shape of the lookup.disclose.io POST /api/lookup response that this plugin
// consumes. Source of truth: https://lookup.disclose.io/openapi.yaml and
// https://lookup.disclose.io/llms-full.txt. This is a deliberately partial
// view — only the fields the plugin renders are typed.

export type Confidence = "high" | "medium" | "low";
export type ContactRouteClass =
  | "first_party"
  | "authorized_agent"
  | "responsible_operator"
  | "related_party"
  | "inferred"
  | "coordinator";

export type ContactEntityRelation =
  | "self"
  | "vendor"
  | "host"
  | "parent"
  | "subsidiary"
  | "maintainer"
  | "publisher"
  | "build_origin"
  | "identifier_assignee"
  | "disclosure_agent"
  | "coordinator";

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
  entity?: string;
  entityKey?: string;
  relation?: ContactEntityRelation;
  routeClass?: ContactRouteClass;
  deliveryAgent?: string;
  authoritative?: boolean;
}

export interface ContactGroup {
  entity: string;
  entityKey?: string;
  relation: ContactEntityRelation;
  routeClass: ContactRouteClass;
  scopeNote?: string;
  rationale?: string;
  contacts: Contact[];
}

export interface RouteSummary {
  routeClass: ContactRouteClass;
  headline: string;
  firstPartyFound: boolean;
  ownerRouteFound: boolean;
  coordinatorAvailable: boolean;
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
  contactGroups?: ContactGroup[];
  routeSummary?: RouteSummary;
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
      contactGroups: ContactGroup[];
      routeSummary: RouteSummary | undefined;
    }
  | {
      ok: false;
      input: string;
      error: string;
    };
