import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

const inputFile = process.env.INPUT ?? "mcp-app.html";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: resolve(__dirname, inputFile),
    },
  },
  publicDir: false,
});
