import { describe, it, vi } from "vitest";
import { sanitizeRepairIssues, type GenerationDiagnosticEvent } from "@/ai/generation-diagnostics";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { generatedLessonSchema } from "@/domain/lesson";
import { FOCUS_EXERCISE_DISTRIBUTION } from "@/ai/prompts/generation-policy";
import {
  DEFAULT_LEARNING_FOCUS,
  learningFocusSchema,
  type LearningFocus,
} from "@/domain/language";
import type { ProcessingStatus } from "@/domain/job";
import type { YouTubeVideo } from "@/domain/video";
import { MockTranscriptProvider } from "@/services/transcript/mock-transcript-provider";
import { LearningGenerationPipeline } from "./learning-generation-pipeline";

const liveSmokeEnabled = process.env.GEMINI_FULL_PIPELINE_SMOKE === "1"
  && Boolean(process.env.GEMINI_API_KEY?.trim());
const liveIt = liveSmokeEnabled ? it : it.skip;
const LIVE_PIPELINE_TIMEOUT_MS = 8 * 60 * 1_000;
const expectedStages: ProcessingStatus[] = [
  "fetching-transcript",
  "analyzing",
  "generating-vocabulary",
  "generating-grammar",
  "generating-lesson",
  "generating-exercises",
];
const VIETNAMESE_DIACRITIC = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/u;
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();

const readFocus = (): LearningFocus => {
  const parsed = learningFocusSchema.safeParse(
    process.env.GEMINI_FULL_PIPELINE_FOCUS?.trim() || DEFAULT_LEARNING_FOCUS,
  );
  if (!parsed.success) throw new Error("Gemini full-pipeline focus configuration is invalid.");
  return parsed.data;
};

const readTimeout = (): number | undefined => {
  const value = process.env.GEMINI_TIMEOUT_MS?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error("Gemini full-pipeline timeout configuration is invalid.");
  }
  return Number(value);
};

const buildVideo = (learningFocus: LearningFocus): YouTubeVideo => ({
  id: "gemini-full-pipeline-video",
  youtubeVideoId: "NZxK3oIxI3Y",
  youtubeUrl: "https://www.youtube.com/watch?v=NZxK3oIxI3Y",
  title: "Gemini full-pipeline reproduction",
  description: null,
  thumbnailUrl: null,
  durationSeconds: null,
  detectedLanguage: "en",
  learningLanguage: "en",
  nativeLanguage: "vi",
  targetLevel: null,
  learningFocus,
  lessonId: null,
  status: "pending",
  processingProgress: 0,
  errorMessage: null,
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
});

describe("Gemini full-pipeline live smoke", () => {
  liveIt("generates one validated lesson through the complete pipeline", async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("Gemini full-pipeline smoke configuration is missing.");
    const learningFocus = readFocus();
    const diagnostics: GenerationDiagnosticEvent[] = [];
    const observedStages: ProcessingStatus[] = [];
    const provider = new GeminiProvider({
      apiKey,
      model: process.env.GEMINI_MODEL?.trim() || undefined,
      timeoutMs: readTimeout(),
    });
    const generateStructured = vi.spyOn(provider, "generateStructured");
    const pipeline = new LearningGenerationPipeline(
      new MockTranscriptProvider(),
      provider,
      () => new Date("2026-10-06T00:00:00.000Z"),
      (event) => diagnostics.push({
        stage: event.stage,
        kind: event.kind,
        issues: sanitizeRepairIssues(event.issues),
      }),
    );

    try {
      const result = await pipeline.generateLesson({
        video: buildVideo(learningFocus),
        processingKey: "gemini-full-pipeline-processing",
        lessonId: "gemini-full-pipeline-lesson",
        generationId: "gemini-full-pipeline-generation",
        onStage: async (stage) => { observedStages.push(stage); },
      });
      const lesson = generatedLessonSchema.safeParse(result.lesson);
      const logicalCalls = generateStructured.mock.calls.length;
      const exerciseCalls = generateStructured.mock.calls.filter(
        ([request]) => request.input.kind === "exercises",
      );
      const stagesAreOrdered = observedStages.length === expectedStages.length
        && observedStages.every((stage, index) => stage === expectedStages[index]);
      const parsedLesson = lesson.success ? lesson.data : null;
      const multipleChoice = parsedLesson?.exercises.filter((exercise) => exercise.type === "multiple-choice") ?? [];
      const listening = parsedLesson?.exercises.filter((exercise) => exercise.type === "listening") ?? [];
      const dictation = parsedLesson?.exercises.filter((exercise) => exercise.type === "dictation") ?? [];
      const sourceById = new Map(parsedLesson?.transcript.map((segment) => [segment.id, segment.text]) ?? []);
      const resolvedSource = (ids: string[]) => ids.map((id) => sourceById.get(id)).filter((value): value is string => Boolean(value)).join(" ");
      const distribution = FOCUS_EXERCISE_DISTRIBUTION[learningFocus];
      const languageAndPedagogyAreSafe = multipleChoice.length === distribution["multiple-choice"]
        && multipleChoice.every((exercise) => !VIETNAMESE_DIACRITIC.test(`${exercise.question} ${exercise.options.join(" ")}`)
          && Boolean(exercise.explanation && VIETNAMESE_DIACRITIC.test(exercise.explanation)))
        && listening.length === distribution.listening
        && listening.every((exercise) => normalize(exercise.expectedAnswer) !== normalize(resolvedSource(exercise.sourceSegmentIds)))
        && dictation.length === distribution.dictation
        && dictation.every((exercise) => normalize(exercise.expectedAnswer) === normalize(resolvedSource(exercise.sourceSegmentIds)));
      if (!lesson.success || lesson.data.learningFocus !== learningFocus || !stagesAreOrdered
        || logicalCalls < 12 || logicalCalls > 36
        || exerciseCalls.length < 5 || exerciseCalls.length > 15 || !languageAndPedagogyAreSafe) {
        throw new Error("Gemini full-pipeline validation failed.");
      }
    } catch {
      process.stderr.write(`${JSON.stringify(diagnostics)}\n`);
      throw new Error("Gemini full-pipeline generation failed.");
    }
  }, LIVE_PIPELINE_TIMEOUT_MS);
});
