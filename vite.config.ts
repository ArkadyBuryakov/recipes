import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: "./server/app.ts" },
      },
    },
  },
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  server: {
    // compose syncs files into the container; inotify works there, but be explicit
    watch: { ignored: ["**/recipes/**", "**/build/**"] },
  },
});
