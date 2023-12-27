import { defineConfig } from "vite";

export default defineConfig({
  base: "/text-optimization/",
  build: { target: "esnext" },
  optimizeDeps: { exclude: ["rose"] },
});
