import { describe, expect, it } from "vitest";
import { ideaInputSchema, ideaPatchSchema } from "./validation";

describe("validation", () => {
  it("a patch keeps only the fields that were sent (regression: defaults cleared other fields)", () => {
    const { patch } = ideaPatchSchema.parse({ version: "v", patch: { status: "قيد التنفيذ" } });
    expect(patch).toEqual({ status: "قيد التنفيذ" });
  });

  it("a patch may clear a field explicitly", () => {
    expect(ideaPatchSchema.parse({ version: "v", patch: { owner: "" } }).patch).toEqual({ owner: "" });
  });

  it("rejects unknown patch keys and an empty title", () => {
    expect(() => ideaPatchSchema.parse({ version: "v", patch: { row: 3 } })).toThrow();
    expect(() => ideaPatchSchema.parse({ version: "v", patch: { title: "  " } })).toThrow();
  });

  it("create fills missing optional fields and validates links and dates", () => {
    expect(ideaInputSchema.parse({ title: "x" }).notes).toBe("");
    expect(() => ideaInputSchema.parse({ title: "x", referenceUrl: "javascript:alert(1)" })).toThrow();
    expect(() => ideaInputSchema.parse({ title: "x", targetDate: "20/11/2026" })).toThrow();
  });
});
