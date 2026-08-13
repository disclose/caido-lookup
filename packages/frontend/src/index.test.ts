import { test, expect, describe } from "bun:test";
import { escapeHtml, isHttpUrl, renderContact, renderContactGroup, renderResult } from "./index.ts";
import type { Contact, LookupResult } from "caido-lookup-backend";

describe("escapeHtml", () => {
  test("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#039;");
  });
  test("leaves plain text untouched", () => {
    expect(escapeHtml("cloudflare.com")).toBe("cloudflare.com");
  });
});

describe("isHttpUrl", () => {
  test("true for http/https", () => {
    expect(isHttpUrl("https://x.com")).toBe(true);
    expect(isHttpUrl("http://x.com")).toBe(true);
  });
  test("false for mailto / bare email / other schemes", () => {
    expect(isHttpUrl("security@x.com")).toBe(false);
    expect(isHttpUrl("mailto:security@x.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("renderContact", () => {
  const base: Contact = { type: "security_txt", value: "https://x.com/.well-known/security.txt", confidence: "high", verified: true };

  test("renders a verified badge and confidence, and links http values", () => {
    const html = renderContact(base);
    expect(html).toContain("security.txt");
    expect(html).toContain("dlk-badge--verified");
    expect(html).toContain("dlk-confidence--high");
    expect(html).toContain(`href="https://x.com/.well-known/security.txt"`);
  });

  test("unverified contacts get the unverified badge", () => {
    const html = renderContact({ ...base, verified: false });
    expect(html).toContain("dlk-badge--unverified");
  });

  test("non-URL values are rendered as plain text, not links", () => {
    const html = renderContact({ type: "email", value: "security@x.com", confidence: "low" });
    expect(html).not.toContain("<a ");
    expect(html).toContain("security@x.com");
  });

  test("XSS in a contact value is HTML-escaped", () => {
    const html = renderContact({ type: "email", value: `<img src=x onerror=alert(1)>`, confidence: "low" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

describe("renderResult", () => {
  const ok: LookupResult = {
    ok: true, input: "cloudflare.com", assetType: "domain", status: "complete", requestId: "r",
    attribution: { organization: "Cloudflare", jurisdiction: "US", confidence: "high" },
    contacts: [{ type: "bug_bounty", value: "https://x/y", confidence: "high", verified: true }],
    contactGroups: [],
    routeSummary: undefined,
  };

  test("renders org, jurisdiction, status and the contact list", () => {
    const html = renderResult(ok);
    expect(html).toContain("Cloudflare");
    expect(html).toContain("US");
    expect(html).toContain("dlk-status--complete");
    expect(html).toContain("Disclosure contacts");
  });

  test("an empty contacts list shows the 'no contacts' message", () => {
    const html = renderResult({ ...ok, contacts: [] });
    expect(html).toContain("No disclosure contacts found");
  });

  test("ok:false renders the error block with the escaped input", () => {
    const html = renderResult({ ok: false, input: "<b>x</b>", error: "boom" });
    expect(html).toContain("dlk-error");
    expect(html).toContain("boom");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  test("XSS in the organization name is escaped", () => {
    const html = renderResult({ ...ok, attribution: { organization: `<script>alert(1)</script>` } });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("renders server groups in server order and shows the route headline", () => {
    const html = renderResult({
      ...ok,
      routeSummary: {
        routeClass: "first_party",
        headline: "First-party reporting route found",
        firstPartyFound: true,
        ownerRouteFound: true,
        coordinatorAvailable: true,
      },
      contactGroups: [
        { entity: "Owner", relation: "self", routeClass: "first_party", contacts: [] },
        { entity: "CERT/CC", relation: "coordinator", routeClass: "coordinator", contacts: [] },
      ],
    });
    expect(html.indexOf("Owner")).toBeLessThan(html.indexOf("CERT/CC"));
    expect(html).toContain("First-party reporting route found");
  });
});

describe("renderContactGroup", () => {
  test("escapes route metadata and renders delivery-agent context", () => {
    const html = renderContactGroup({
      entity: `<img src=x onerror=alert(1)>`,
      relation: "disclosure_agent",
      routeClass: "authorized_agent",
      rationale: `<script>alert(1)</script>`,
      contacts: [{ type: "bug_bounty", value: "https://x.test", deliveryAgent: "HackerOne" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("Delivered by HackerOne");
  });
});
