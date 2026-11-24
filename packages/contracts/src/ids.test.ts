import { describe, expect, it } from "vitest";
import { colorForId, identityColors } from "./identity";
import { idSchema, newId, slugSchema } from "./ids";

describe("ids", () => {
  it("generates valid, time-sortable UUIDv7s", () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_001);
    expect(idSchema.safeParse(a).success).toBe(true);
    expect(a[14]).toBe("7");
    expect(a < b).toBe(true);
    expect(newId()).not.toBe(newId());
  });

  it("accepts simple slugs only", () => {
    expect(slugSchema.safeParse("pr-review-2").success).toBe(true);
    for (const bad of ["", "Upper", "a--b", "-a", "a_b", "x".repeat(65)]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("gives every id a stable color from the palette", () => {
    const id = newId();
    expect(colorForId(id)).toBe(colorForId(id));
    expect(identityColors).toContain(colorForId(id));
  });
});
