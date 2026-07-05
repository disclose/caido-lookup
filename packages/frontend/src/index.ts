import type {
  CommandContext,
  RequestFull,
  RequestDraft,
  RequestMeta,
} from "@caido/sdk-frontend";

import type { Contact, LookupResult } from "caido-lookup-backend";

import type { CaidoSDK } from "./types";

import "./styles/style.css";

const PAGE_PATH = "/disclosure-lookup" as const;
const COMMAND_ID = "caido-lookup.find-contact" as const;

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

// Module-scoped handles to the page body so the command handler can push
// results into it and navigate to the page.
let resultRoot: HTMLElement | undefined;
let inputField: HTMLInputElement | undefined;

const CONTACT_TYPE_LABELS: Record<string, string> = {
  security_txt: "security.txt",
  bug_bounty: "Bug Bounty",
  vdp: "VDP",
  email: "Email",
  abuse_contact: "Abuse Contact",
  cert: "CERT",
  psirt: "PSIRT",
  convention: "Convention (unverified)",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function renderContact(contact: Contact): string {
  const typeLabel =
    CONTACT_TYPE_LABELS[contact.type] ?? contact.type ?? "contact";
  const verifiedBadge = contact.verified
    ? `<span class="dlk-badge dlk-badge--verified" title="Derived from an authoritative source">verified</span>`
    : `<span class="dlk-badge dlk-badge--unverified" title="Heuristic guess — confirm before relying on it">unverified</span>`;
  const confidence = contact.confidence
    ? `<span class="dlk-confidence dlk-confidence--${escapeHtml(
        contact.confidence,
      )}">${escapeHtml(contact.confidence)}</span>`
    : "";

  const rawValue = contact.value ?? "";
  const value = isHttpUrl(rawValue)
    ? `<a class="dlk-link" href="${escapeHtml(
        rawValue,
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawValue)}</a>`
    : `<span class="dlk-value">${escapeHtml(rawValue)}</span>`;

  const note = contact.label ? `<div class="dlk-note">${escapeHtml(contact.label)}</div>` : "";

  return `
    <li class="dlk-contact">
      <div class="dlk-contact__head">
        <span class="dlk-type">${escapeHtml(typeLabel)}</span>
        ${verifiedBadge}
        ${confidence}
      </div>
      <div class="dlk-contact__value">${value}</div>
      ${note}
    </li>
  `;
}

export function renderResult(result: LookupResult): string {
  if (!result.ok) {
    return `
      <div class="dlk-error">
        <h3>No result for <code>${escapeHtml(result.input)}</code></h3>
        <p>${escapeHtml(result.error)}</p>
      </div>
    `;
  }

  const org = result.attribution.organization ?? "Unknown organization";
  const jurisdiction = result.attribution.jurisdiction
    ? ` · ${escapeHtml(result.attribution.jurisdiction)}`
    : "";
  const confidence = result.attribution.confidence
    ? `<span class="dlk-confidence dlk-confidence--${escapeHtml(
        result.attribution.confidence,
      )}">${escapeHtml(result.attribution.confidence)} confidence</span>`
    : "";

  const statusClass = `dlk-status--${escapeHtml(result.status)}`;

  const contactsHtml =
    result.contacts.length > 0
      ? `<ul class="dlk-contacts">${result.contacts
          .map(renderContact)
          .join("")}</ul>`
      : `<p class="dlk-empty">No disclosure contacts found for this asset.</p>`;

  return `
    <div class="dlk-result">
      <div class="dlk-result__header">
        <h2 class="dlk-org">${escapeHtml(org)}${jurisdiction}</h2>
        <div class="dlk-meta">
          ${confidence}
          <span class="dlk-status ${statusClass}">${escapeHtml(
            result.status,
          )}</span>
        </div>
        <div class="dlk-asset">
          <code>${escapeHtml(result.input)}</code>${
            result.assetType
              ? ` <span class="dlk-asset-type">${escapeHtml(
                  result.assetType,
                )}</span>`
              : ""
          }
        </div>
      </div>
      <h3 class="dlk-contacts__title">Disclosure contacts</h3>
      ${contactsHtml}
    </div>
  `;
}

function setState(html: string): void {
  if (resultRoot) {
    resultRoot.innerHTML = html;
  }
}

function setLoading(input: string): void {
  setState(
    `<div class="dlk-loading">Looking up <code>${escapeHtml(
      input,
    )}</code>…</div>`,
  );
}

async function runLookup(sdk: CaidoSDK, input: string): Promise<void> {
  const asset = input.trim();
  if (asset.length === 0) {
    sdk.window.showToast("Enter an asset to look up.", { variant: "warning" });
    return;
  }

  if (inputField) {
    inputField.value = asset;
  }

  sdk.navigation.goTo(PAGE_PATH);
  setLoading(asset);

  try {
    const result = await sdk.backend.lookup(asset);
    setState(renderResult(result));
    if (!result.ok) {
      sdk.window.showToast(`Lookup failed for ${asset}.`, { variant: "error" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState(
      `<div class="dlk-error"><h3>Lookup error</h3><p>${escapeHtml(
        message,
      )}</p></div>`,
    );
    sdk.window.showToast("Lookup failed — see the page for details.", {
      variant: "error",
    });
  }
}

function buildPage(sdk: CaidoSDK): HTMLElement {
  const body = document.createElement("div");
  body.className = "dlk-page";
  body.innerHTML = `
    <div class="dlk-toolbar">
      <h1 class="dlk-title">Disclosure Lookup</h1>
      <p class="dlk-subtitle">
        Find the security-disclosure contact for any host via
        <a class="dlk-link" href="https://lookup.disclose.io" target="_blank" rel="noopener noreferrer">lookup.disclose.io</a>.
        Right-click a request and choose <em>Find disclosure contact</em>, or look one up below.
      </p>
      <form class="dlk-form">
        <input
          class="dlk-input"
          type="text"
          name="asset"
          placeholder="domain, IP, URL, email, package…"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="dlk-button" type="submit">Look up</button>
      </form>
    </div>
    <div class="dlk-results">
      <div class="dlk-placeholder">
        Right-click a request in HTTP History or the Intercept pane and choose
        <strong>Find disclosure contact</strong>, or enter an asset above.
      </div>
    </div>
  `;

  const form = body.querySelector(".dlk-form") as HTMLFormElement;
  inputField = body.querySelector(".dlk-input") as HTMLInputElement;
  resultRoot = body.querySelector(".dlk-results") as HTMLElement;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runLookup(sdk, inputField?.value ?? "");
  });

  return body;
}

// ---------------------------------------------------------------------------
// Host extraction from the command context
// ---------------------------------------------------------------------------

function hostFromRequest(
  request: RequestFull | RequestDraft | RequestMeta,
): string | undefined {
  return request.host && request.host.length > 0 ? request.host : undefined;
}

function hostFromContext(context: CommandContext): string | undefined {
  switch (context.type) {
    case "RequestContext":
      return hostFromRequest(context.request);
    case "RequestRowContext": {
      const first = context.requests[0];
      return first ? hostFromRequest(first) : undefined;
    }
    case "ResponseContext":
      return hostFromRequest(context.request);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Plugin entrypoint
// ---------------------------------------------------------------------------

export function init(sdk: CaidoSDK): void {
  // Register the page and a sidebar entry to reach it.
  sdk.navigation.addPage(PAGE_PATH, { body: buildPage(sdk) });
  sdk.sidebar.registerItem("Disclosure Lookup", PAGE_PATH, {
    icon: "fas fa-shield-halved",
  });

  // Register the "Find disclosure contact" command. The handler pulls the host
  // out of whatever context invoked it (a request pane, a history row, or a
  // response pane) and runs the lookup.
  sdk.commands.register(COMMAND_ID, {
    name: "Find disclosure contact",
    group: "Disclosure Lookup",
    run: (context: CommandContext) => {
      const host = hostFromContext(context);
      if (!host) {
        sdk.window.showToast("Could not determine a host for this request.", {
          variant: "warning",
        });
        return;
      }
      void runLookup(sdk, host);
    },
  });

  // Make it reachable from the command palette and the right-click menus.
  sdk.commandPalette.register(COMMAND_ID);
  sdk.menu.registerItem({
    type: "Request",
    commandId: COMMAND_ID,
    leadingIcon: "fas fa-shield-halved",
  });
  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: COMMAND_ID,
    leadingIcon: "fas fa-shield-halved",
  });
}
