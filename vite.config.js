// vite.config.js
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".", // Root of the project
  base: "/", // Public path (important for Firebase Hosting)
  build: {
    outDir: "dist", // Where the built files go (Firebase deploys this)
    emptyOutDir: true, // Clears dist before build
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
