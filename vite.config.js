import { defineConfig, splitVendorChunkPlugin } from "vite";
import path from "path";

export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  build: {
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        viewBuild: path.resolve(__dirname, "viewBuild.html"),
        veto: path.resolve(__dirname, "veto.html"),
        tournament: path.resolve(__dirname, "tournament/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        manualChunks(id) {
          // External Libraries
          if (id.includes("node_modules")) {
            if (id.includes("firebase")) {
              if (id.includes("firebase-auth")) return "vendor-firebase-auth";
              if (id.includes("firebase-firestore"))
                return "vendor-firebase-firestore";
              if (id.includes("firebase-storage"))
                return "vendor-firebase-storage";
              return "vendor-firebase-core"; // firebase-app, etc.
            }
            if (id.includes("dompurify")) return "vendor-dompurify";
            if (id.includes("marked")) return "vendor-marked";
            return "vendor";
          }

          // App-Level Modules
          if (id.includes("src/js/modules/utils/notificationHelpers.js"))
            return "notificationHelpers";

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
