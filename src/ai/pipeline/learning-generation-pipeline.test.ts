import { describe, expect, it, vi } from "vitest";
import type { AIProvider, StructuredGenerationRequest } from "@/ai/providers/ai-provider";
import { AIProviderError } from "@/ai/providers/ai-provider";
import { MockAIProvider } from "@/ai/providers/mock-ai-provider";
import { EXERCISE_TRANSPORT_BUCKETS } from "@/ai/exercise-generation-contract";
import { FOCUS_EXERCISE_DISTRIBUTION } from "@/ai/prompts/generation-policy";
import { PROMPT_VERSION } from "@/ai/prompts/versions";
import type { ExerciseType } from "@/domain/exercise";
import type { LearningFocus, LearningLevel } from "@/domain/language";
import type { YouTubeVideo } from "@/domain/video";
import type { GenerationDiagnosticEvent } from "@/ai/generation-diagnostics";
import { MockTranscriptProvider } from "@/services/transcript/mock-transcript-provider";
import { LearningGenerationPipeline } from "./learning-generation-pipeline";

const videoFor = (
  learningFocus: LearningFocus,
  targetLevel: LearningLevel | null = { system: "CEFR", value: "B1" },
): YouTubeVideo => ({
  id: "video-1",
  youtubeVideoId: "dQw4w9WgXcQ",
  youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Pipeline fixture",
  description: null,
  thumbnailUrl: null,
  durationSeconds: 40,
  detectedLanguage: "en",
  learningLanguage: "en",
  nativeLanguage: "vi",
  targetLevel,
  learningFocus,
  lessonId: null,
  status: "pending",
  processingProgress: 0,
  errorMessage: null,
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
});

const requestFor = (focus: LearningFocus, targetLevel?: LearningLevel | null) => ({
  video: videoFor(focus, targetLevel),
  processingKey: `processing-${focus}`,
  lessonId: `lesson-${focus}`,
  generationId: `generation-${focus}`,
  onStage: vi.fn(async () => undefined),
});

const runWith = (
  provider: AIProvider,
  focus: LearningFocus = "comprehensive",
  targetLevel?: LearningLevel | null,
  diagnostics?: GenerationDiagnosticEvent[],
) => new LearningGenerationPipeline(
  new MockTranscriptProvider(),
  provider,
  () => new Date("2026-10-06T00:00:00.000Z"),
  diagnostics ? (event) => diagnostics.push(event) : undefined,
).generateLesson(requestFor(focus, targetLevel));

describe("LearningGenerationPipeline", () => {
  it.each([
    ["comprehensive", 42],
    ["speaking", 38],
    ["listening", 40],
    ["grammar", 35],
  ] as const)("generates the exact %s distribution in five batches (%i total)", async (focus, total) => {
    const provider = new MockAIProvider();
    const result = await runWith(provider, focus);
    const exerciseInputs = provider.inputs.filter(
      (input): input is Extract<typeof input, { kind: "exercises" }> => input.kind === "exercises",
    );

    expect(result.lesson.exercises).toHaveLength(total);
    expect(result.lesson.promptVersion).toBe(PROMPT_VERSION);
    expect(exerciseInputs).toHaveLength(5);
    expect(exerciseInputs.map((input) => input.batch.type)).toEqual(EXERCISE_TRANSPORT_BUCKETS);
    expect(exerciseInputs.map((input) => input.batch.count)).toEqual(
      EXERCISE_TRANSPORT_BUCKETS.map((type) => FOCUS_EXERCISE_DISTRIBUTION[focus][type]),
    );
    for (const type of EXERCISE_TRANSPORT_BUCKETS) {
      expect(result.lesson.exercises.filter((exercise) => exercise.type === type))
        .toHaveLength(FOCUS_EXERCISE_DISTRIBUTION[focus][type]);
    }
    expect(result.lesson.exercises.slice(0, 5).map((exercise) => exercise.type))
      .toEqual(EXERCISE_TRANSPORT_BUCKETS);
    expect(new Set(result.lesson.exercises.map((exercise) => exercise.id)).size).toBe(total);
    expect(provider.invocationCount).toBe(8);
    expect(result.lesson.title).toBe("Bài học theo ngữ cảnh");
    expect(result.lesson.transcriptSource).toBe("demo");
    expect(result.lesson.sections.map((section) => section.order)).toEqual([1, 2]);
    const multipleChoice = result.lesson.exercises.filter((exercise) => exercise.type === "multiple-choice");
    expect(multipleChoice.every((exercise) => !/[ăâđêôơư]/iu.test(`${exercise.question} ${exercise.options.join(" ")}`))).toBe(true);
    expect(multipleChoice.every((exercise) => /[\u00C0-\u024F\u1E00-\u1EFF]/u.test(exercise.explanation ?? ""))).toBe(true);
    const sourceById = new Map(result.lesson.transcript.map((segment) => [segment.id, segment.text]));
    const sourceFor = (ids: string[]) => ids.map((id) => sourceById.get(id)).filter(Boolean).join(" ").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    expect(result.lesson.exercises.filter((exercise) => exercise.type === "listening").every((exercise) => exercise.expectedAnswer.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() !== sourceFor(exercise.sourceSegmentIds))).toBe(true);
    expect(result.lesson.exercises.filter((exercise) => exercise.type === "dictation").every((exercise) => exercise.expectedAnswer.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() === sourceFor(exercise.sourceSegmentIds))).toBe(true);
  });

  it("retries only the failed batch and passes sanitized repair issues", async () => {
    const delegate = new MockAIProvider();
    const attempts = new Map<ExerciseType, number>();
    const repairIssues: Array<StructuredGenerationRequest<unknown>["repairIssues"]> = [];
    const provider: AIProvider = {
      cacheIdentity: "test:batch-retry",
      maxConcurrency: 1,
      async generateStructured(request) {
        if (request.input.kind !== "exercises") return delegate.generateStructured(request);
        const type = request.input.batch.type;
        attempts.set(type, (attempts.get(type) ?? 0) + 1);
        if (type === "fill-blank") repairIssues.push(request.repairIssues);
        if (type === "fill-blank" && attempts.get(type) === 1) return { exercises: [] };
        return delegate.generateStructured(request);
      },
    };

    const result = await runWith(provider, "comprehensive");
    expect(result.lesson.exercises).toHaveLength(42);
    expect(Object.fromEntries(attempts)).toEqual({
      "multiple-choice": 1,
      "fill-blank": 2,
      translation: 1,
      listening: 1,
      dictation: 1,
    });
    expect(repairIssues[0]).toBeUndefined();
    expect(repairIssues[1]).toEqual([
      { path: ["exercises"], code: "too_small" },
    ]);
  });

  it("fails after three attempts for one invalid batch without rerunning prior batches", async () => {
    const delegate = new MockAIProvider();
    const attempts = new Map<ExerciseType, number>();
    const provider: AIProvider = {
      cacheIdentity: "test:bounded-batch-retry",
      maxConcurrency: 1,
      async generateStructured(request) {
        if (request.input.kind !== "exercises") return delegate.generateStructured(request);
        const type = request.input.batch.type;
        attempts.set(type, (attempts.get(type) ?? 0) + 1);
        if (type === "translation") return { exercises: [] };
        return delegate.generateStructured(request);
      },
    };

    await expect(runWith(provider)).rejects.toMatchObject({
      code: "INVALID_GENERATED_CONTENT",
      status: 422,
    });
    expect(Object.fromEntries(attempts)).toEqual({
      "multiple-choice": 1,
      "fill-blank": 1,
      translation: 3,
    });
  });

  it("replaces duplicate model ids with deterministic server-owned ids", async () => {
    const delegate = new MockAIProvider();
    const provider: AIProvider = {
      cacheIdentity: "test:duplicate-model-ids",
      maxConcurrency: 2,
      async generateStructured(request) {
        const output = await delegate.generateStructured(request);
        if (request.input.kind !== "exercises") return output;
        const batch = structuredClone(output) as { exercises: Array<{ id: string }> };
        batch.exercises.forEach((exercise) => { exercise.id = "duplicate"; });
        return batch;
      },
    };
    const result = await runWith(provider, "listening");
    const ids = result.lesson.exercises.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(40);
    expect(ids.slice(0, 5)).toEqual(EXERCISE_TRANSPORT_BUCKETS.map(
      (type) => `generation-listening-${type}-1`,
    ));
  });

  it("normalizes invalid optional difficulty only for Auto level", async () => {
    const delegate = new MockAIProvider();
    const provider: AIProvider = {
      cacheIdentity: "test:auto-difficulty",
      maxConcurrency: 5,
      async generateStructured(request) {
        const output = await delegate.generateStructured(request);
        if (request.input.kind !== "exercises") return output;
        const batch = structuredClone(output) as { exercises: Array<{ difficulty?: unknown }> };
        batch.exercises.forEach((exercise) => {
          exercise.difficulty = { system: "AUTO", value: "Auto" };
        });
        return batch;
      },
    };
    const result = await runWith(provider, "grammar", null);
    expect(result.lesson.exercises).toHaveLength(35);
    expect(result.lesson.exercises.every((exercise) => exercise.difficulty === undefined)).toBe(true);
  });

  it("honors provider concurrency and preserves deterministic batch order", async () => {
    const delegate = new MockAIProvider();
    const calls: string[] = [];
    let active = 0;
    let peak = 0;
    const provider: AIProvider = {
      cacheIdentity: "test:serial",
      maxConcurrency: 1,
      async generateStructured(request) {
        active += 1;
        peak = Math.max(peak, active);
        calls.push(request.input.kind === "exercises"
          ? `exercises:${request.input.batch.type}`
          : request.input.kind);
        await Promise.resolve();
        const output = await delegate.generateStructured(request);
        active -= 1;
        return output;
      },
    };
    await runWith(provider);
    expect(peak).toBe(1);
    expect(calls.slice(-5)).toEqual(EXERCISE_TRANSPORT_BUCKETS.map((type) => `exercises:${type}`));
  });

  it("performs final traceability validation after all batches merge", async () => {
    const delegate = new MockAIProvider();
    const diagnostics: GenerationDiagnosticEvent[] = [];
    const provider: AIProvider = {
      cacheIdentity: "test:traceability",
      maxConcurrency: 5,
      async generateStructured(request) {
        const output = await delegate.generateStructured(request);
        if (request.input.kind !== "exercises" || request.input.batch.type !== "listening") return output;
        const batch = structuredClone(output) as { exercises: Array<{ sourceSegmentIds: string[] }> };
        batch.exercises[0].sourceSegmentIds = ["private-missing-source"];
        return batch;
      },
    };
    await expect(runWith(provider, "comprehensive", undefined, diagnostics)).rejects.toMatchObject({
      code: "INVALID_GENERATED_CONTENT",
      status: 422,
      message: "Nội dung tạo tự động không hợp lệ sau khi kiểm tra.",
    });
    expect(diagnostics).toContainEqual(expect.objectContaining({
      stage: "validating-lesson",
      kind: "lesson:zod-invalid",
    }));
    expect(JSON.stringify(diagnostics)).not.toContain("private-missing-source");
  });

  it("maps a non-retryable provider failure without making more exercise calls", async () => {
    const delegate = new MockAIProvider();
    let exerciseCalls = 0;
    const provider: AIProvider = {
      cacheIdentity: "test:quota",
      maxConcurrency: 1,
      async generateStructured(request) {
        if (request.input.kind === "exercises") {
          exerciseCalls += 1;
          throw new AIProviderError("quota", { status: 429 });
        }
        return delegate.generateStructured(request);
      },
    };
    await expect(runWith(provider)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      message: "Tài khoản dịch vụ AI đã hết hạn mức sử dụng. Vui lòng bổ sung hạn mức rồi thử lại.",
    });
    expect(exerciseCalls).toBe(1);
  });
});
