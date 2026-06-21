import { resolve } from "path";

import { defineConfig } from "vite";

// Caido backend plugins run in the LLRT JavaScript runtime.
// The runtime provides `fetch` (via the `caido:http` module) and the
// `@caido/sdk-backend` types, so they are externalized — not bundled.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "caido-lookup-backend",
      fileName: () => "script.js",
      formats: ["es"],
    },
    outDir: "../../dist/backend",
    emptyOutDir: true,
    rollupOptions: {
      external: ["caido:http", "caido:runtime", "@caido/sdk-backend"],
      output: {
        manualChunks: undefined,
      },
    },
  },
});
