import { test, expect, describe, afterEach } from "bun:test";
import { lookup } from "./index.ts";
import type { LookupApiResponse } from "./types";

// A body recorded verbatim from lookup.disclose.io (2026-07-05) — pins the contract.
const RECORDED: LookupApiResponse = {
  input: "cloudflare.com",
  assetType: "domain",
  status: "complete",
  requestId: "req_recorded",
  attribution: { confidence: "high", organization: "Cloudflare", jurisdiction: "US" },
  contacts: [
    { type: "bug_bounty", value: "https://www.cloudflare.com/disclosure/", confidence: "high", verified: true, label: "Cloudflare (Bounty)" },
    { type: "security_txt", value: "https://www.cloudflare.com/abuse/", confidence: "high", verified: true },
  ],
};

const sdk = { console: { log: () => {} } } as any;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function mockFetch(fn: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (url: any, init: any) => fn(String(url), init)) as any;
}

describe("backend lookup()", () => {
  test("empty / whitespace input short-circuits without a network call", async () => {
    let called = false;
    mockFetch(() => { called = true; return Response.json(RECORDED); });
    const r = await lookup(sdk, "   ");
    expect(called).toBe(false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no asset/i);
  });

  test("maps a successful response into ok:true with contacts + attribution", async () => {
    mockFetch(() => Response.json(RECORDED));
    const r = await lookup(sdk, "cloudflare.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input).toBe("cloudflare.com");
      expect(r.assetType).toBe("domain");
      expect(r.status).toBe("complete");
      expect(r.attribution.organization).toBe("Cloudflare");
      expect(r.contacts).toHaveLength(2);
      expect(r.contacts[0].verified).toBe(true);
    }
  });

  test("privacy: request body contains ONLY the input asset — nothing else", async () => {
    let sentBody: any = null;
    mockFetch((_url, init) => { sentBody = JSON.parse(String(init.body)); return Response.json(RECORDED); });
    await lookup(sdk, "github.com");
    expect(Object.keys(sentBody)).toEqual(["input"]);
    expect(sentBody.input).toBe("github.com");
  });

  test("non-2xx JSON response becomes a renderable ok:false", async () => {
    mockFetch(() => Response.json({ status: "rate_limited" }, { status: 429 }));
    const r = await lookup(sdk, "cloudflare.com");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("rate_limited");
      expect(r.error).toContain("429");
    }
  });

  test("non-JSON body becomes ok:false, not a thrown error", async () => {
    mockFetch(() => new Response("<html>oops</html>", { status: 200 }));
    const r = await lookup(sdk, "cloudflare.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/non-JSON/i);
  });

  test("network failure is caught and returned as ok:false", async () => {
    mockFetch(() => { throw new Error("ECONNREFUSED"); });
    const r = await lookup(sdk, "cloudflare.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/failed/i);
  });

  test("an AbortError surfaces as a timeout message", async () => {
    mockFetch(() => { const e = new Error("aborted"); e.name = "AbortError"; throw e; });
    const r = await lookup(sdk, "cloudflare.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/timed out/i);
  });

  test("missing contacts array degrades to []", async () => {
    mockFetch(() => Response.json({ status: "partial", attribution: {} }));
    const r = await lookup(sdk, "x.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contacts).toEqual([]);
  });
});
