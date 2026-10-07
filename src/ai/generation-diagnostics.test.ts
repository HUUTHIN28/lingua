import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import {
  emitGenerationDiagnostic,
  MAX_SAFE_GENERATION_ISSUES,
  MAX_SAFE_GENERATION_PATH_DEPTH,
  NOOP_GENERATION_DIAGNOSTIC_SINK,
  sanitizeGenerationIssues,
  sanitizeRepairIssues,
  type GenerationDiagnosticSink,
} from "./generation-diagnostics";

const PRIVATE_SENTINELS = [
  "sk-private-credential",
  "raw model output",
  "transcript secret sentence",
  "NZxK3oIxI3Y",
  "processing-private-key",
];

const asIssues = (issues: unknown[]): readonly z.core.$ZodIssue[] =>
  issues as readonly z.core.$ZodIssue[];

describe("generation diagnostic sanitizer", () => {
  it("retains only allowlisted paths and codes", () => {
    const issues = sanitizeGenerationIssues(asIssues([
      {
        code: "invalid_type",
        path: ["exercises", 2, "correctAnswer"],
        message: PRIVATE_SENTINELS[0],
        input: PRIVATE_SENTINELS[1],
      },
      {
        code: "unknown_provider_code",
        path: [PRIVATE_SENTINELS[2], 1000, Symbol(PRIVATE_SENTINELS[3])],
        message: PRIVATE_SENTINELS[4],
      },
    ]));

    expect(issues).toEqual([
      { path: ["exercises", 2, "correctAnswer"], code: "invalid_type" },
      { path: ["field", "index", "field"], code: "custom" },
    ]);

    const serialized = JSON.stringify(issues);
    for (const sentinel of PRIVATE_SENTINELS) expect(serialized).not.toContain(sentinel);
    expect(Object.keys(issues[0]).sort()).toEqual(["code", "path"]);
  });

  it("caps depth and count, bounds indices, and removes duplicates", () => {
    const excessive = Array.from({ length: 20 }, (_, index) => ({
      code: index % 2 === 0 ? "too_small" : "too_big",
      path: ["exercises", index, "options", 101, "value", "summary", PRIVATE_SENTINELS[0]],
      message: PRIVATE_SENTINELS[1],
    }));
    excessive.push({ ...excessive[0] });

    const issues = sanitizeGenerationIssues(asIssues(excessive));
    expect(issues).toHaveLength(MAX_SAFE_GENERATION_ISSUES);
    expect(issues.every((issue) => issue.path.length <= MAX_SAFE_GENERATION_PATH_DEPTH)).toBe(true);
    expect(issues.some((issue) => issue.path.includes("index"))).toBe(true);
    expect(new Set(issues.map((issue) => JSON.stringify(issue))).size).toBe(issues.length);
    expect(JSON.stringify(issues)).not.toContain(PRIVATE_SENTINELS[0]);
  });

  it("canonicalizes issue order and revalidates repair data", () => {
    const raw = [
      { path: ["distribution", "listening"], code: "custom", extra: PRIVATE_SENTINELS[0] },
      { path: ["exercises", 0, "type"], code: "invalid_value" },
      { path: [PRIVATE_SENTINELS[1]], code: PRIVATE_SENTINELS[2] },
      { path: ["distribution", "listening"], code: "custom" },
      null,
    ];

    const forward = sanitizeRepairIssues(raw);
    const reverse = sanitizeRepairIssues([...raw].reverse());
    expect(forward).toEqual(reverse);
    expect(forward).toEqual([
      { path: ["distribution", "listening"], code: "custom" },
      { path: ["exercises", 0, "type"], code: "invalid_value" },
      { path: ["field"], code: "custom" },
    ]);
    expect(sanitizeRepairIssues("not-an-array")).toEqual([]);

    const serialized = JSON.stringify(forward);
    for (const sentinel of PRIVATE_SENTINELS) expect(serialized).not.toContain(sentinel);
  });
});

describe("generation diagnostic sink", () => {
  const event = {
    stage: "generating-exercises" as const,
    kind: "exercises:zod-invalid" as const,
    issues: [{ path: ["distribution", "total"], code: "custom" as const }],
  };

  it("provides a silent default sink", () => {
    expect(() => NOOP_GENERATION_DIAGNOSTIC_SINK(event)).not.toThrow();
  });

  it("isolates synchronous and asynchronous sink failures", async () => {
    const syncSink: GenerationDiagnosticSink = () => {
      throw new Error(PRIVATE_SENTINELS[0]);
    };
    const asyncSink = vi.fn(async () => {
      throw new Error(PRIVATE_SENTINELS[1]);
    }) as GenerationDiagnosticSink;

    expect(() => emitGenerationDiagnostic(syncSink, event)).not.toThrow();
    expect(() => emitGenerationDiagnostic(asyncSink, event)).not.toThrow();
    await Promise.resolve();
    expect(asyncSink).toHaveBeenCalledOnce();
  });
});
