---
project: caido-lookup
task: Build a Caido plugin that looks up security-disclosure contacts via lookup.disclose.io
effort: E3
phase: observe
progress: 0/34
mode: build
started: 2026-06-21T07:40:00Z
updated: 2026-06-21T07:40:00Z
---

# caido-lookup — Caido plugin for lookup.disclose.io

## Problem

A security researcher testing a host in [Caido](https://caido.io) has no in-tool way to find *who* to report a vulnerability to. They have to leave Caido, open a browser, and manually hunt for a `security.txt`, a bug-bounty program, or a VDP. [lookup.disclose.io](https://lookup.disclose.io) already solves that attribution problem over a free, CORS-open, unauthenticated API — but nothing wires it into the testing workflow at the moment a researcher actually has the target in hand.

## Vision

A researcher right-clicks a request (or a row in HTTP History) in Caido, picks **"Find disclosure contact"**, and the plugin's sidebar page instantly shows the owning organization, jurisdiction, attribution confidence, and a ranked, verified-vs-unverified list of reporting channels (security.txt, bug bounty, VDP email, CERT) for that host — without ever leaving Caido. The "where do I report this?" friction collapses to one click.

## Out of Scope

- No automatic submission/filing of vulnerability reports — this only finds the contact, the human decides.
- No persistence/history of lookups beyond the current session (no DB, no storage of results).
- No bundled API key or authenticated requests — anonymous CORS-open access only (a key would only raise rate limits; not needed for v1).
- No support for non-host inputs in v1 UX (the API supports 16 asset types; the plugin's right-click path targets a request's host specifically). The sidebar's manual input box may accept any input string the API accepts, but no special asset-type UI.
- No Ed25519 signing or store submission performed in this task — the repo is prepared for it and the steps are documented, but signing/PR are explicitly deferred to the user's confirmation.
- No publishing of the GitHub release / CI workflow secrets in this task.

## Principles

- **Verify the SDK against live docs, never guess.** The Caido plugin SDK is the substrate; its real contract (method names, context shapes, manifest fields) is sourced from `caido/doc-developer` + the published `@caido/sdk-frontend` types, not from memory.
- **Idiomatic over clever.** Follow the official starterkit shape (vite + `vite-plugin-zip-pack`, `manifest.json`, `init(sdk)`) so a Caido maintainer recognizes it instantly.
- **The network call belongs in the backend.** Caido's architecture separates frontend (UI, no arbitrary egress) from backend (LLRT runtime with `fetch`). The lookup HTTP call goes in the backend plugin; the frontend calls it over the RPC bridge.
- **Source hygiene is non-negotiable.** Build artifacts and dependencies never enter version control.

## Constraints

- Frontend uses `@caido/sdk-frontend`; backend uses `@caido/sdk-backend`. Both pinned to current published versions.
- Backend outbound HTTP uses the LLRT global `fetch` (available in the `javascript` runtime) — not Node `http`, not a bundled axios.
- Frontend registers a command via `sdk.commands.register`, exposes it on the context menu via `sdk.menu.registerItem({ type, commandId })`, and a page via `sdk.navigation.addPage` + `sdk.sidebar.registerItem`.
- The command handler reads the host from the Caido command context: `RequestRow` → `context.requests[].host`, `Request` → `context.request.host` (verified fields on `RequestMeta`/`RequestFull`/`RequestDraft`).
- The frontend↔backend bridge: backend `sdk.api.register("name", fn)` typed by an exported `API` type; frontend calls `sdk.backend.name(args)` returning a Promise.
- `manifest.json` declares both a `frontend` plugin (with `backend` reference) and a `backend` plugin (`runtime: "javascript"`).
- Build tooling is vite (per official starterkit); package manager runnable with npm OR pnpm. Build must emit a loadable plugin package zip.
- `.gitignore` MUST exclude `node_modules/`, `dist/`, and `*.zip` BEFORE the first `git add`.
- Commit author: name `Aurora`, email `aurora@tallpoppygroup.com`. LICENSE: MIT, copyright `disclose.io`.
- Repo: `disclose/caido-lookup`, public, created via `gh repo create`.

## Goal

Ship a buildable, idiomatic, frontend+backend Caido plugin in `~/Projects/caido-lookup/` that adds a "Find disclosure contact" right-click action and a sidebar page which resolve a host's security-disclosure contacts via lookup.disclose.io, build it to a loadable plugin package zip, and push only source (no artifacts) to a new public `disclose/caido-lookup` GitHub repo — with the Caido-store submission steps documented but not executed.

## Criteria

- [ ] ISC-1: `~/Projects/caido-lookup/manifest.json` exists and declares one `frontend` plugin (with `backend` reference) and one `backend` plugin with `runtime: "javascript"`.
- [ ] ISC-2: `manifest.json` is valid JSON (parses with `node -e`/`jq`).
- [ ] ISC-3: Frontend source registers a command with id for "Find disclosure contact" via `sdk.commands.register`.
- [ ] ISC-4: Frontend source registers that command on the context menu via `sdk.menu.registerItem` for both `Request` and `RequestRow` types.
- [ ] ISC-5: Frontend source registers a sidebar page via `sdk.navigation.addPage` + `sdk.sidebar.registerItem`.
- [ ] ISC-6: The command handler extracts host from `context.request.host` (Request) and `context.requests[].host` (RequestRow) — verified by grep of those field accesses.
- [ ] ISC-7: Frontend calls the backend over the RPC bridge (`sdk.backend.<fn>(...)`), not a direct `fetch` from the frontend.
- [ ] ISC-8: Backend source registers an RPC function via `sdk.api.register("...", ...)`.
- [ ] ISC-9: Backend performs the lookup with a `fetch` POST to `https://lookup.disclose.io/api/lookup` with JSON body `{ input }` and `Content-Type: application/json`.
- [ ] ISC-10: Backend parses and returns the documented shape: `status`, `attribution { organization, jurisdiction, confidence }`, `contacts[] { type, value, confidence, verified, label }`.
- [ ] ISC-11: Backend exports an `API` type and frontend imports it to type `sdk.backend`.
- [ ] ISC-12: Backend handles non-2xx / network errors without throwing an unhandled error (returns an error-shaped result the UI can render).
- [ ] ISC-13: Sidebar page renders organization, jurisdiction, confidence, and the contacts list (verified vs unverified distinguished) from the result.
- [ ] ISC-14: Sidebar page has a manual input field so a user can look up an arbitrary asset, not only via right-click.
- [ ] ISC-15: `package.json` (frontend) declares `@caido/sdk-frontend` dependency and a `build` script.
- [ ] ISC-16: `package.json` (backend) declares `@caido/sdk-backend` dependency and a `build` script.
- [ ] ISC-17: Build tooling (vite config) for frontend emits `dist/frontend/script.js` and copies `manifest.json`, producing a plugin package zip.
- [ ] ISC-18: Build tooling for backend emits `dist/backend/script.js`.
- [ ] ISC-19: A top-level build orchestration (root `package.json` script or workspace) builds both frontend and backend and assembles one installable plugin package zip containing `manifest.json` + `frontend/` + `backend/`.
- [ ] ISC-20: `README.md` exists with install instructions (build → load the plugin package zip in Caido) and usage.
- [ ] ISC-21: `README.md` documents the Caido-store submission steps (Ed25519 key-pair via openssl, GitHub release, PR to `caido/store` `plugin_packages.json`).
- [ ] ISC-22: `LICENSE` is MIT with copyright holder `disclose.io`.
- [ ] ISC-23: `.gitignore` excludes `node_modules`, `dist`, and `*.zip` (and `.DS_Store`).
- [ ] ISC-24: Dependency install (`npm install` or `pnpm install`) completes successfully.
- [ ] ISC-25: The build command runs and produces the plugin package zip artifact on disk (path captured) — OR, if the build genuinely cannot run in this environment, the blocker is captured explicitly and the criterion is `[DEFERRED-VERIFY]` with the reason.
- [ ] ISC-26: TypeScript typechecks (no type errors) for both frontend and backend sources.
- [ ] ISC-27: `git init` done and first commit authored by `Aurora <aurora@tallpoppygroup.com>` (verified via `git log --format='%an <%ae>'`).
- [ ] ISC-28: `git ls-files` contains ONLY source — no `node_modules`, no `dist`, no `*.zip`.
- [ ] ISC-29: Public repo `disclose/caido-lookup` created and pushed via `gh repo create ... --push` (verified via `gh repo view`).
- [ ] ISC-30: Pushed repo's tracked files match `git ls-files` (remote contains only source).
- [ ] ISC-31: Repo description and homepage (`https://lookup.disclose.io`) set as specified (verified via `gh repo view --json`).
- [ ] ISC-32: Anti: the committed/pushed tree contains NO `node_modules/`, `dist/`, or `*.zip` entries.
- [ ] ISC-33: Anti: the frontend does NOT call `lookup.disclose.io` directly via `fetch` (the egress is backend-only).
- [ ] ISC-34: Anti: NO Ed25519 signing or store PR is performed in this task (only documented) — no private key generated/committed, no PR opened against `caido/store`.

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1,2 | structure | manifest declares fe+be, parses | both plugins present | Read + node -e JSON.parse |
| ISC-3..7,33 | code | grep frontend for SDK calls + host fields + no direct lookup fetch | all present, anti absent | Grep |
| ISC-8..12 | code | grep backend for api.register, fetch POST url, error handling | all present | Grep + Read |
| ISC-13,14 | code | grep page render + input field | present | Grep |
| ISC-15..19 | build-config | package.json scripts + vite configs + zip output target | present | Read |
| ISC-20..23 | docs/license | README sections, LICENSE text, .gitignore entries | present | Read + Grep |
| ISC-24 | command | install exits 0 | exit 0 | Bash npm/pnpm install |
| ISC-25 | artifact | build produces zip on disk | file exists OR deferred w/ reason | Bash build + ls |
| ISC-26 | command | tsc --noEmit clean | 0 errors | Bash tsc |
| ISC-27 | command | git log author | Aurora <aurora@tallpoppygroup.com> | Bash git log |
| ISC-28,32 | command | git ls-files has no artifacts | grep -c == 0 | Bash git ls-files |
| ISC-29,30,31 | live | gh repo view shows public repo + tree + description | exists, matches | Bash gh |
| ISC-34 | anti | no private.pem committed, no store PR | absent | Bash git ls-files + reasoning |

## Features

| name | description | satisfies | depends_on | parallelizable |
|------|-------------|-----------|------------|----------------|
| scaffold | dir layout, manifest.json, root+fe+be package.json, tsconfig, vite configs, .gitignore, LICENSE | ISC-1,2,15,16,17,18,19,22,23 | - | no |
| backend | api.register + fetch POST to lookup API + error handling + API type export | ISC-8,9,10,11,12 | scaffold | yes |
| frontend | command + context menu + sidebar page + RPC call + host extraction + render + input | ISC-3,4,5,6,7,13,14,33 | scaffold,backend | yes |
| docs | README install/usage + store submission steps | ISC-20,21 | scaffold | yes |
| build | install, typecheck, vite build, assemble plugin zip | ISC-24,25,26 | backend,frontend,scaffold | no |
| repo | gitignore-first, git init, Aurora commit, gh repo create+push, verify tree | ISC-27,28,29,30,31,32,34 | build | no |

## Decisions

- 2026-06-21: Effort E3 (auto) — multi-file frontend+backend plugin, external API, public repo creation. Substantial but bounded.
- 2026-06-21: SDK contract sourced live from `caido/doc-developer` markdown + `npm pack @caido/sdk-frontend@latest` types (v0.56.2 fe / 0.57.0 be) — NOT from memory. Verified: command context `RequestRow→requests[]:RequestMeta`, `Request→request:RequestDraft|RequestFull`; all three request types have plain `host: string`. Backend uses LLRT global `fetch`. RPC bridge: backend `sdk.api.register` typed by exported `API`; frontend `sdk.backend.fn()` returns Promise.
- 2026-06-21: Network call placed in backend (not frontend) per Caido architecture + Principle "network call belongs in backend." Frontend reaches it via RPC — also satisfies anti-criterion ISC-33.
- 2026-06-21: Delegation — Forge (GPT-5.4) auto-included at E3 to produce the plugin source idiomatically; Cato opt-in at VERIFY (security-adjacent: a tool used by security researchers, public repo). ISA + Forge + Cato = delegation floor E3≥2 met.
- 2026-06-21: Monorepo layout with npm workspaces (packages/frontend, packages/backend) mirrors community plugins (csp-auditor, ParamFinder) and keeps one buildable tree; root script assembles the final zip.

## Verification

(pending EXECUTE/VERIFY)
