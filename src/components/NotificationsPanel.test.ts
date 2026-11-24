import { describe, expect, it } from "vitest";
import { haceCuanto } from "./NotificationsPanel";

describe("haceCuanto", () => {
  const ahora = new Date("2026-11-24T12:00:00Z");
  it("da tiempos relativos cortos", () => {
    expect(haceCuanto("2026-11-24T11:59:40Z", ahora)).toBe("recién");
    expect(haceCuanto("2026-11-24T11:55:00Z", ahora)).toBe("hace 5 min");
    expect(haceCuanto("2026-11-24T09:00:00Z", ahora)).toBe("hace 3 h");
    expect(haceCuanto("2026-11-23T12:00:00Z", ahora)).toBe("ayer");
    expect(haceCuanto("2026-11-21T12:00:00Z", ahora)).toBe("hace 3 días");
  });
  it("con una fecha inválida no muestra nada", () => {
    expect(haceCuanto("no-es-fecha", ahora)).toBe("");
  });
});
