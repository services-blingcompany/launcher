import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" es imprescindible: en el empaquetado el renderer se sirve
// desde file:// y las rutas absolutas (/assets/...) no resolverían.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
