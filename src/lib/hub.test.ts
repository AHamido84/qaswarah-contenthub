import { beforeEach, describe, expect, it } from "vitest";

process.env.DATA_SOURCE = "demo";
process.env.SHEET_CACHE_TTL = "0";

const hub = await import("./hub");
const actor = { email: "test@example.com" };
const HOLDING = 1387480453;
const REAL_ESTATE = 61667299;

const blank = { title: "", description: "", referenceUrl: "", platform: "", priority: "", status: "", owner: "", targetDate: "", notes: "" };

beforeEach(() => {
  delete (globalThis as { __qchDemo?: unknown }).__qchDemo;
  delete (globalThis as { __qchHub?: unknown }).__qchHub;
});

describe("hub (demo gateway)", () => {
  it("lists both companies and flags K–N duplicates only on the real-estate tab", async () => {
    const wb = await hub.loadWorkbook({ fresh: true });
    expect(wb.companies.map((c) => c.name)).toEqual(["قسورة القابضة", "قسورة العقارية"]);
    const re = wb.companies.find((c) => c.id === REAL_ESTATE)!;
    expect(re.layout.duplicates).toHaveLength(4);
    expect(re.issues.find((i) => i.code === "duplicate-columns")?.title).toContain("K–N");
    expect(wb.companies[0]!.layout.duplicates).toHaveLength(0);
    expect(re.options.status.source).toBe("validation");
  });

  it("creates an idea in the first placeholder row and round-trips the date", async () => {
    const before = await hub.loadWorkbook({ fresh: true });
    const company = before.companies[0]!;
    const lastRow = Math.max(...company.ideas.map((i) => i.row));
    const idea = await hub.createIdea(HOLDING, { ...blank, title: "فكرة جديدة", status: "قيد التنفيذ", targetDate: "2026-12-05" }, actor);
    expect(idea.row).toBe(lastRow + 1);
    expect(idea.targetDateIso).toBe("2026-12-05");
    const after = await hub.loadWorkbook({ fresh: true });
    expect(after.companies[0]!.ideas).toHaveLength(company.ideas.length + 1);
  });

  it("rejects values outside a strict dropdown", async () => {
    await expect(hub.createIdea(HOLDING, { ...blank, title: "x", priority: "قصوى" }, actor)).rejects.toMatchObject({ code: "invalid-option" });
  });

  it("guards against formula injection", () => {
    expect(hub.toCellValue("title", "=IMPORTXML(1)")).toBe("'=IMPORTXML(1)");
    expect(hub.toCellValue("notes", "- نقطة")).toBe("'- نقطة");
    expect(hub.toCellValue("title", "1/2")).toBe("'1/2");
    expect(hub.toCellValue("title", "فكرة عادية")).toBe("فكرة عادية");
    expect(hub.toCellValue("targetDate", "2026-01-01")).toBe("2026-01-01");
  });

  it("updates with optimistic concurrency", async () => {
    const wb = await hub.loadWorkbook({ fresh: true });
    const idea = wb.companies[0]!.ideas[0]!;
    const updated = await hub.updateIdea(HOLDING, idea.row, idea.version, { status: "تم النشر" }, actor);
    expect(updated.status).toBe("تم النشر");
    await expect(hub.updateIdea(HOLDING, idea.row, idea.version, { status: "مؤجلة" }, actor)).rejects.toMatchObject({ status: 409 });
  });

  it("deletes by clearing values only", async () => {
    const wb = await hub.loadWorkbook({ fresh: true });
    const idea = wb.companies[0]!.ideas[0]!;
    await hub.deleteIdea(HOLDING, idea.row, idea.version, actor);
    const after = await hub.loadWorkbook({ fresh: true });
    expect(after.companies[0]!.ideas.find((i) => i.row === idea.row)).toBeUndefined();
    // the next create reuses the cleared row
    const created = await hub.createIdea(HOLDING, { ...blank, title: "بديل" }, actor);
    expect(created.row).toBe(idea.row);
  });

  it("creates a company tab from a healthy template", async () => {
    const res = await hub.createCompany("قسورة كابيتال", actor);
    expect(res.from).toBe("قسورة القابضة");
    const wb = await hub.loadWorkbook({ fresh: true });
    const c = wb.companies.find((x) => x.id === res.id)!;
    expect(c.ideas).toHaveLength(0);
    expect(c.options.status.source).toBe("validation");
    await expect(hub.createCompany("قسورة كابيتال", actor)).rejects.toMatchObject({ code: "exists" });
    await expect(hub.createCompany("bad/name", actor)).rejects.toMatchObject({ code: "invalid-name" });
  });

  it("fixes duplicates only with confirmation, after a backup, without losing values", async () => {
    const plan = await hub.previewDuplicateFix(REAL_ESTATE);
    expect(plan.moves.length + plan.conflicts.length).toBeGreaterThan(0);
    const hash = hub.planHash(plan);
    await expect(hub.applyDuplicateFix(REAL_ESTATE, "اسم خطأ", hash, actor)).rejects.toMatchObject({ code: "confirm-mismatch" });
    await expect(hub.applyDuplicateFix(REAL_ESTATE, "قسورة العقارية", "stale", actor)).rejects.toMatchObject({ code: "plan-changed" });

    const res = await hub.applyDuplicateFix(REAL_ESTATE, "قسورة العقارية", hash, actor);
    expect(res.backupTab).toContain("نسخة احتياطية");

    const wb = await hub.loadWorkbook({ fresh: true });
    const re = wb.companies.find((c) => c.id === REAL_ESTATE)!;
    expect(re.layout.duplicates).toHaveLength(0);
    for (const m of plan.moves) {
      const idea = re.ideas.find((i) => i.row === m.row)!;
      expect(idea[m.field]).toBe(m.value);
    }
    for (const cf of plan.conflicts) {
      const idea = re.ideas.find((i) => i.row === cf.row)!;
      expect(idea.notes).toContain(cf.duplicate);
    }
    // backup tab is hidden and not listed as a company
    expect(wb.companies.some((c) => c.name.includes("نسخة"))).toBe(false);
  });
});
