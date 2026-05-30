// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("framer-motion")) return "framer";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod"))
              return "forms";
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "date";
            if (
              id.includes("embla-carousel") ||
              id.includes("vaul") ||
              id.includes("cmdk") ||
              id.includes("input-otp") ||
              id.includes("sonner")
            )
              return "ui-extra";
            if (
              id.includes("@tanstack/react-router") ||
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/react-start")
            )
              return "tanstack";
            if (id.includes("react-dom") || id.includes("react/") || id.includes("react\\")) {
              return "react";
            }
          },
        },
      },
    },
  },
});
