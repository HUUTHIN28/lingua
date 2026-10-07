import { describe, it, vi } from "vitest";
import { generatedLessonSchema } from "@/domain/lesson";
import {
  DEFAULT_LEARNING_FOCUS,
  learningFocusSchema,
  type LearningFocus,
} from "@/domain/language";
import type { ProcessingStatus } from "@/domain/job";
import type { YouTubeVideo } from "@/domain/video";
import {
  sanitizeRepairIssues,
  type GenerationDiagnosticEvent,
} from "@/ai/generation-diagnostics";
import {
  OpenRouterProvider,
  type OpenRouterProviderOptions,
} from "@/ai/providers/openrouter-provider";
import { parseOpenRouterFallbackModels } from "@/ai/providers/provider-factory";
import { MockTranscriptProvider } from "@/services/transcript/mock-transcript-provider";
import { LearningGenerationPipeline } from "./learning-generation-pipeline";

const liveFlagEnabled = process.env.OPENROUTER_FULL_PIPELINE_SMOKE === "1";
const liveSmokeEnabled =
  liveFlagEnabled && Boolean(process.env.OPENROUTER_API_KEY?.trim());
const liveIt = liveSmokeEnabled ? it : it.skip;
const LIVE_PIPELINE_TIMEOUT_MS = 8 * 60 * 1_000;
const MIN_LOGICAL_CALLS = 8;
const MAX_LOGICAL_CALLS = 24;

const expectedStages: ProcessingStatus[] = [
  "fetching-transcript",
  "analyzing",
  "generating-vocabulary",
  "generating-grammar",
  "generating-lesson",
  "generating-exercises",
];

function readFocus(): LearningFocus {
  const rawFocus = process.env.OPENROUTER_FULL_PIPELINE_FOCUS?.trim();
  const parsed = learningFocusSchema.safeParse(rawFocus || DEFAULT_LEARNING_FOCUS);
  if (!parsed.success) {
    throw new Error("OpenRouter full-pipeline focus configuration is invalid.");
  }
  return parsed.data;
}

function readTimeout(): number | undefined {
  const rawTimeout = process.env.OPENROUTER_TIMEOUT_MS?.trim();
  if (!rawTimeout) return undefined;
  if (!/^\d+$/.test(rawTimeout)) {
    throw new Error("OpenRouter full-pipeline timeout configuration is invalid.");
  }
  return Number(rawTimeout);
}

function buildProviderOptions(apiKey: string): OpenRouterProviderOptions {
  const model = process.env.OPENROUTER_MODEL?.trim();
  const fallbackModels = parseOpenRouterFallbackModels(
    process.env.OPENROUTER_FALLBACK_MODELS,
  );
  const timeoutMs = readTimeout();
  return {
    apiKey,
    ...(model ? { model } : {}),
    ...(fallbackModels === undefined ? {} : { fallbackModels }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function buildVideo(learningFocus: LearningFocus): YouTubeVideo {
  const timestamp = "2026-10-06T00:00:00.000Z";
  return {
    id: "openrouter-full-pipeline-video",
    youtubeVideoId: "NZxK3oIxI3Y",
    youtubeUrl: "https://www.youtube.com/watch?v=NZxK3oIxI3Y",
    title: "OpenRouter full-pipeline reproduction",
    description: null,
    thumbnailUrl: null,
    durationSeconds: null,
    detectedLanguage: "en",
    learningLanguage: "en",
    nativeLanguage: "vi",
    targetLevel: { system: "CEFR", value: "B1" },
    learningFocus,
    lessonId: null,
    status: "pending",
    processingProgress: 0,
    errorMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function safeDiagnosticCopy(event: GenerationDiagnosticEvent): GenerationDiagnosticEvent {
  return {
    stage: event.stage,
    kind: event.kind,
    issues: sanitizeRepairIssues(event.issues),
  };
}

describe("OpenRouter full-pipeline live smoke", () => {
  liveIt("generates one validated lesson through the complete pipeline", async () => {
    const learningFocus = readFocus();
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OpenRouter full-pipeline smoke configuration is missing.");
    }

    const diagnostics: GenerationDiagnosticEvent[] = [];
    const observedStages: ProcessingStatus[] = [];
    const provider = new OpenRouterProvider(buildProviderOptions(apiKey));
    if (provider.maxConcurrency !== 1) {
      throw new Error("OpenRouter full-pipeline provider concurrency is invalid.");
    }
    const generateStructured = vi.spyOn(provider, "generateStructured");
    const pipeline = new LearningGenerationPipeline(
      new MockTranscriptProvider(),
      provider,
      () => new Date("2026-10-06T00:00:00.000Z"),
      (event) => diagnostics.push(safeDiagnosticCopy(event)),
    );

    try {
      const result = await pipeline.generateLesson({
        video: buildVideo(learningFocus),
        processingKey: "openrouter-full-pipeline-processing",
        lessonId: "openrouter-full-pipeline-lesson",
        generationId: "openrouter-full-pipeline-generation",
        onStage: async (status) => {
          observedStages.push(status);
        },
      });

      const parsedLesson = generatedLessonSchema.safeParse(result.lesson);
      const logicalCalls = generateStructured.mock.calls.length;
      const stagesAreOrdered =
        observedStages.length === expectedStages.length &&
        observedStages.every((stage, index) => stage === expectedStages[index]);
      if (
        !parsedLesson.success ||
        parsedLesson.data.learningFocus !== learningFocus ||
        !stagesAreOrdered ||
        logicalCalls < MIN_LOGICAL_CALLS ||
        logicalCalls > MAX_LOGICAL_CALLS
      ) {
        throw new Error("OpenRouter full-pipeline validation failed.");
      }
    } catch {
      process.stderr.write(`${JSON.stringify(diagnostics)}\n`);
      throw new Error("OpenRouter full-pipeline generation failed.");
    }
  }, LIVE_PIPELINE_TIMEOUT_MS);
});
