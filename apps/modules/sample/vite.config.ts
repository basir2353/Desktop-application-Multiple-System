import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.SAMPLE_MODULE_PORT ?? process.env.PORT ?? 5001) || 5001;

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "sample",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
  server: {
    host: "127.0.0.1",
    port,
    // If 5001 is taken (e.g. another dev server), Vite picks the next free port — watch the terminal URL.
    strictPort: false,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        minifyInternalExports: false,
      },
    },
  },
});
