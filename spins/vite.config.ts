import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// SPINS_BASE lets you host under a sub-path (e.g. GitHub Pages: /repo-name/).
export default defineConfig({
  base: process.env.SPINS_BASE ?? "/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
