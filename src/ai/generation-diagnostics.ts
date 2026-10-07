import type { z } from "zod";

export type GenerationTaskKind = "vocabulary" | "grammar" | "sections" | "exercises";

export type GenerationDiagnosticStage =
  | "generating-vocabulary"
  | "generating-grammar"
  | "generating-lesson"
  | "generating-exercises"
  | "validating-lesson";

export const SAFE_GENERATION_ISSUE_CODES = [
  "invalid_type",
  "invalid_value",
  "invalid_union",
  "invalid_key",
  "invalid_element",
  "too_small",
  "too_big",
  "invalid_format",
  "not_multiple_of",
  "unrecognized_keys",
  "custom",
] as const;

export type SafeGenerationIssueCode = (typeof SAFE_GENERATION_ISSUE_CODES)[number];

export type SafeGenerationIssue = {
  path: readonly (string | number)[];
  code: SafeGenerationIssueCode;
};

export type GenerationDiagnosticEvent = {
  stage: GenerationDiagnosticStage;
  kind:
    | `${GenerationTaskKind}:zod-invalid`
    | `${GenerationTaskKind}:provider-invalid-output`
    | "lesson:zod-invalid";
  issues: readonly SafeGenerationIssue[];
};

export type GenerationDiagnosticSink = (event: GenerationDiagnosticEvent) => void;

export const NOOP_GENERATION_DIAGNOSTIC_SINK: GenerationDiagnosticSink = () => undefined;

export const MAX_SAFE_GENERATION_ISSUES = 8;
export const MAX_SAFE_GENERATION_PATH_DEPTH = 5;

const SAFE_PATH_SEGMENTS = [
  "id",
  "lessonId",
  "videoId",
  "type",
  "question",
  "explanation",
  "difficulty",
  "sourceSegmentIds",
  "sourceSegmentId",
  "options",
  "correctAnswer",
  "sentence",
  "sourceText",
  "sourceLanguage",
  "targetLanguage",
  "expectedAnswer",
  "startTimeSeconds",
  "endTimeSeconds",
  "word",
  "meaning",
  "translation",
  "partOfSpeech",
  "pronunciation",
  "exampleSentence",
  "exampleTranslation",
  "title",
  "summary",
  "order",
  "examples",
  "pattern",
  "system",
  "value",
  "sections",
  "transcript",
  "vocabulary",
  "grammar",
  "exercises",
  "distribution",
  "total",
  "multiple-choice",
  "fill-blank",
  "listening",
  "dictation",
] as const;

const safePathSegments = new Set<string>(SAFE_PATH_SEGMENTS);
const safeIssueCodes = new Set<string>(SAFE_GENERATION_ISSUE_CODES);

type IssueLike = {
  path?: unknown;
  code?: unknown;
};

const sanitizePath = (value: unknown): Array<string | number> => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_SAFE_GENERATION_PATH_DEPTH).map((segment) => {
    if (typeof segment === "number") {
      return Number.isSafeInteger(segment) && segment >= 0 && segment <= 99
        ? segment
        : "index";
    }
    if (typeof segment === "string") {
      return safePathSegments.has(segment) ? segment : "field";
    }
    return "field";
  });
};

const sanitizeIssueLike = (issue: IssueLike): SafeGenerationIssue => ({
  path: sanitizePath(issue.path),
  code:
    typeof issue.code === "string" && safeIssueCodes.has(issue.code)
      ? (issue.code as SafeGenerationIssueCode)
      : "custom",
});

const canonicalizeIssues = (issues: readonly SafeGenerationIssue[]): SafeGenerationIssue[] => {
  const unique = new Map<string, SafeGenerationIssue>();
  for (const issue of issues) {
    const key = JSON.stringify([issue.path, issue.code]);
    unique.set(key, issue);
  }

  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_SAFE_GENERATION_ISSUES)
    .map(([, issue]) => issue);
};

export function sanitizeGenerationIssues(
  issues: readonly z.core.$ZodIssue[],
): SafeGenerationIssue[] {
  return canonicalizeIssues(issues.map((issue) => sanitizeIssueLike(issue)));
}

/** Revalidates internal repair context before it is serialized into a prompt. */
export function sanitizeRepairIssues(value: unknown): SafeGenerationIssue[] {
  if (!Array.isArray(value)) return [];

  const sanitized: SafeGenerationIssue[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    sanitized.push(sanitizeIssueLike(candidate as IssueLike));
  }
  return canonicalizeIssues(sanitized);
}

/** Diagnostics are optional and can never change generation behavior. */
export function emitGenerationDiagnostic(
  sink: GenerationDiagnosticSink,
  event: GenerationDiagnosticEvent,
): void {
  const safeEvent: GenerationDiagnosticEvent = {
    stage: event.stage,
    kind: event.kind,
    issues: sanitizeRepairIssues(event.issues),
  };

  try {
    const result = sink(safeEvent) as unknown;
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // Diagnostic sinks are best-effort and must never affect generation.
  }
}
