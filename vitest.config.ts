import { defineConfig } from "vitest/config";

// Los tests son de lógica pura (lib/ y data/): no hace falta React ni
// Tailwind, así que no se cargan los plugins del build.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
