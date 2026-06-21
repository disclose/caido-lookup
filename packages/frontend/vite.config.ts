import { resolve } from "path";

import { defineConfig } from "vite";

// Caido frontend plugins are bundled to a single ES module + a stylesheet.
// `@caido/sdk-frontend` is provided by the Caido runtime, so it is externalized.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "caido-lookup-frontend",
      fileName: () => "script.js",
      formats: ["es"],
    },
    outDir: "../../dist/frontend",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      external: ["@caido/sdk-frontend"],
      output: {
        manualChunks: undefined,
        // Caido expects the stylesheet at frontend/style.css
        assetFileNames: "style.css",
      },
    },
  },
});
