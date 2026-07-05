# Disclosure Lookup — a Caido plugin

Look up the **security-disclosure contact for any host** without leaving [Caido](https://caido.io).

Right-click a request (or a row in HTTP History) and choose **Find disclosure contact**. The plugin queries [lookup.disclose.io](https://lookup.disclose.io) and shows you the owning organization, jurisdiction, attribution confidence, and a ranked list of where to report a vulnerability — `security.txt`, bug-bounty programs, VDP emails, PSIRT directories, and national CERTs — with each contact marked **verified** or **unverified**.

> A [disclose.io](https://disclose.io) project. The lookup API is free, CORS-open, and unauthenticated — no key or account required.

---

## What it does

- **Context-menu action** — right-click in a request pane or on a request row → **Find disclosure contact**. The plugin resolves the request's host.
- **Sidebar page** — a dedicated *Disclosure Lookup* page that renders the result and also lets you look up any asset manually (domain, IP, URL, email, package, …).
- **Command palette** — the action is also available via the command palette.

The network call runs in the plugin's **backend** (Caido's sandboxed JavaScript runtime), which keeps the egress out of the Caido UI process. The frontend talks to the backend over Caido's typed RPC bridge.

## Architecture

```
caido-lookup/
├── manifest.json              # declares the frontend + backend plugins
├── packages/
│   ├── backend/               # calls lookup.disclose.io, returns parsed result
│   │   └── src/
│   │       ├── index.ts       # sdk.api.register("lookup", …) + fetch POST
│   │       └── types.ts       # API response + result types
│   └── frontend/              # command, context menu, sidebar page, rendering
│       └── src/
│           ├── index.ts       # sdk.commands / sdk.menu / sdk.navigation / sdk.sidebar
│           ├── types.ts       # CaidoSDK typed with the backend API
│           └── styles/style.css
└── scripts/package.mjs        # assembles the installable plugin package zip
```

| Concern | Where | Caido SDK surface |
| --- | --- | --- |
| Right-click action | frontend | `sdk.commands.register`, `sdk.menu.registerItem({ type: "Request" \| "RequestRow" })` |
| Host extraction | frontend | command `CommandContext` → `request.host` / `requests[].host` |
| Sidebar page | frontend | `sdk.navigation.addPage`, `sdk.sidebar.registerItem` |
| Outbound HTTP | backend | global `fetch` (LLRT runtime) → `POST https://lookup.disclose.io/api/lookup` |
| Frontend ↔ backend | both | backend `sdk.api.register` typed by `API`; frontend `sdk.backend.lookup(host)` |

## Build

The plugin is built with [Vite](https://vitejs.dev/), the build tool used by the official Caido starter kit. You need Node 18+ and `npm` (or `pnpm`).

```bash
# install dependencies
npm install

# typecheck (optional)
npm run typecheck

# build both packages and assemble the plugin package
npm run build
```

This produces:

- `dist/frontend/script.js` + `dist/frontend/style.css`
- `dist/backend/script.js`
- `dist/manifest.json`
- **`caido-lookup.zip`** ← the installable plugin package (root of the repo)

## Install in Caido

1. Download `caido-lookup.zip` from the [latest release](https://github.com/disclose/caido-lookup/releases/latest) — or build it yourself with `npm install && npm run build`.
2. In Caido, open **Plugins** → **Installed** → **Install Package**.
3. Select `caido-lookup.zip`.
4. Caido loads the frontend and backend plugins. A **Disclosure Lookup** entry appears in the left sidebar.

> Plugins installed from a local package (rather than the official store) are unsigned. Caido will prompt you to confirm the install. See *Publishing to the Caido store* below for the signed-distribution path.

## Usage

- **From a request:** right-click in a request pane, or on a row in **HTTP History**, and choose **Find disclosure contact**. The Disclosure Lookup page opens with the result for that host.
- **Manually:** open the **Disclosure Lookup** sidebar page and type any asset (domain, IP, URL, email, package, repository, …) into the input box.

Each contact is tagged:

- **verified** — derived from an authoritative source (`security.txt`, `SECURITY.md`, DioDB, PSIRT directories).
- **unverified** — a heuristic guess (e.g. the `security@` / `abuse@` convention). Confirm before relying on it.

## Publishing to the Caido store (not yet done)

The official store registry is the GitHub repository [`caido/store`](https://github.com/caido/store). Plugins are distributed as **Ed25519-signed** GitHub releases. To submit this plugin:

1. **Generate an Ed25519 key-pair** (one key-pair per plugin):

   ```bash
   openssl genpkey -algorithm ed25519 -out private.pem
   openssl pkey -in private.pem -pubout -out public.pem
   ```

   Keep `private.pem` secret — store it as a GitHub Actions secret named `PRIVATE_KEY`. **Never commit it** (`.gitignore` already excludes `*.pem`).

2. **Enable immutable releases** on the GitHub repo (Settings → General → Releases).

3. **Create a signed release** — a release workflow signs the built plugin package with the private key and attaches the `.sig` file to the GitHub release.

4. **Open a PR to `caido/store`** adding an entry to [`plugin_packages.json`](https://github.com/caido/store/blob/main/plugin_packages.json):

   ```json
   {
     "id": "caido-lookup",
     "name": "Disclosure Lookup",
     "license": "MIT",
     "description": "Look up the security-disclosure contact for any host via lookup.disclose.io.",
     "author": {
       "name": "disclose.io",
       "email": "hello@disclose.io",
       "url": "https://disclose.io"
     },
     "public_key": "<BASE64 BODY OF public.pem, no BEGIN/END lines>",
     "repository": "disclose/caido-lookup"
   }
   ```

5. Sign the [Contributor License Agreement](https://cla-assistant.io/caido/store) when the bot prompts, then wait for the Caido team's review.

Full reference: the Caido [*Submit to Store*](https://developer.caido.io/guides/distribution/store.html) and [*Set Up Repository*](https://developer.caido.io/guides/distribution/repository.html) guides.

## License

[MIT](./LICENSE) © disclose.io
