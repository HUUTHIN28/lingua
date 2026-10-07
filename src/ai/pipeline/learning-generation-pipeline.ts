import { z } from "zod";
import {
  grammarPointSchema,
  learningSectionSchema,
  vocabularyItemSchema,
  type GeneratedLesson,
} from "@/domain/lesson";
import type { ProcessingStatus } from "@/domain/job";
import type { YouTubeVideo } from "@/domain/video";
import type { TranscriptChunk, TranscriptSegment } from "@/domain/transcript";
import type { LearningFocus } from "@/domain/language";
import {
  isAIProviderError,
  type AIProvider,
  type AIProviderFailureKind,
  type AIProviderInput,
} from "@/ai/providers/ai-provider";
import {
  assignServerOwnedExerciseIds,
  EXERCISE_TRANSPORT_BUCKETS,
  exerciseBatchTransportSchema,
  exerciseListSchemaForFocus,
  interleaveExerciseBatches,
  normalizeAutoLevelExerciseDifficulty,
} from "@/ai/exercise-generation-contract";
import { FOCUS_EXERCISE_DISTRIBUTION, allocateContentTargets, contentTargets } from "@/ai/prompts/generation-policy";
import type { Exercise, ExerciseType } from "@/domain/exercise";
import type { TranscriptProvider } from "@/services/transcript/transcript-provider";
import { PROMPT_VERSION } from "@/ai/prompts/versions";
import { normalizeTranscript } from "./normalize-transcript";
import { chunkTranscript } from "./chunk-transcript";
import {
  assignServerOwnedChunkIds,
  mergeGrammar,
  mergeVocabulary,
} from "./merge-results";
import { validateLessonTraceability } from "./validate-traceability";
import { ApplicationError } from "@/services/learning/errors";
import {
  NOOP_GENERATION_DIAGNOSTIC_SINK,
  emitGenerationDiagnostic,
  sanitizeGenerationIssues,
  type GenerationDiagnosticSink,
  type GenerationDiagnosticStage,
  type GenerationTaskKind,
  type SafeGenerationIssue,
} from "@/ai/generation-diagnostics";

const vocabularyListSchema = z.array(vocabularyItemSchema).min(1).max(12);
const grammarListSchema = z.array(grammarPointSchema).min(1).max(8);
const sectionListSchema = z.array(learningSectionSchema).min(1);
const MAX_GENERATION_TRANSCRIPT_BYTES = 220_000;
const referencesOnlyChunk = (
  items: Array<{ sourceSegmentIds: string[] }>,
  sourceIds: Set<string>,
) => items.every((item) => {
  const examples = (item as { examples?: Array<{ sourceSegmentId: string }> }).examples;
  return item.sourceSegmentIds.every((id) => sourceIds.has(id))
    && (!Array.isArray(examples) || examples.every((example) => sourceIds.has(example.sourceSegmentId)));
});
const diagnosticStageByTask: Record<GenerationTaskKind, GenerationDiagnosticStage> = {
  vocabulary: "generating-vocabulary",
  grammar: "generating-grammar",
  sections: "generating-lesson",
  exercises: "generating-exercises",
};

const providerFailureMessages: Record<
  Exclude<AIProviderFailureKind, "invalid-output">,
  string
> = {
  authentication: "Không thể xác thực với dịch vụ AI. Vui lòng kiểm tra API key.",
  quota: "Tài khoản dịch vụ AI đã hết hạn mức sử dụng. Vui lòng bổ sung hạn mức rồi thử lại.",
  "rate-limit": "Dịch vụ AI đang giới hạn yêu cầu. Vui lòng thử lại sau khi hạn mức được làm mới.",
  timeout: "Dịch vụ AI phản hồi quá chậm. Vui lòng thử lại sau.",
  capability: "Mô hình AI đã chọn không hỗ trợ định dạng tạo bài học. Vui lòng chọn mô hình tương thích.",
  upstream: "Dịch vụ AI đang tạm thời gặp sự cố. Vui lòng thử lại sau.",
};

const lessonCopy: Record<LearningFocus, { description: string; summary: string }> = {
  speaking: {
    description: "Bài học luyện tạo lượt đáp: nói câu trả lời thành tiếng rồi nhập lại để nhận phản hồi về nội dung văn bản.",
    summary: "Tập các mẫu hội thoại và câu trả lời có thể tái sử dụng, với trọng số cao hơn cho điền từ và diễn đạt.",
  },
  listening: {
    description: "Bài học luyện liên hệ câu nghe theo mốc thời gian với ý nghĩa và văn bản nguồn.",
    summary: "Nghe lại câu gốc, nhận diện chi tiết và luyện chính tả với trọng số cao hơn.",
  },
  grammar: {
    description: "Bài học phân tích dạng cấu trúc, cách dùng và ví dụ được dẫn từ transcript.",
    summary: "Quan sát mẫu câu trong ngữ cảnh rồi luyện nhận diện cấu trúc và điền dạng phù hợp.",
  },
  comprehensive: {
    description: "Bài học hội thoại cân bằng với nội dung nguồn và mốc thời gian có thể kiểm chứng.",
    summary: "Kết hợp nghe, từ vựng, ngữ pháp và diễn đạt qua năm dạng bài tập.",
  },
};

async function mapInOrderWithConcurrency<TInput, TOutput>(
  inputs: readonly TInput[],
  maxConcurrency: number,
  mapper: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new ApplicationError(
      "GENERATION_FAILED",
      "Cấu hình dịch vụ AI không hợp lệ.",
      500,
    );
  }
  if (inputs.length === 0) return [];

  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  const worker = async () => {
    while (!failed) {
      const index = nextIndex;
      if (index >= inputs.length) return;
      nextIndex += 1;
      try {
        results[index] = await mapper(inputs[index], index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(maxConcurrency, inputs.length) },
      () => worker(),
    ),
  );
  if (failed) throw failure;
  return results;
}

export type GenerationStageListener = (status: ProcessingStatus, progress: number) => Promise<void>;

export type GenerateLessonRequest = {
  video: YouTubeVideo;
  processingKey: string;
  lessonId: string;
  generationId: string;
  onStage: GenerationStageListener;
};

export type PipelineResult = {
  transcript: TranscriptSegment[];
  lesson: GeneratedLesson;
};

export class LearningGenerationPipeline {
  constructor(
    private readonly transcriptProvider: TranscriptProvider,
    private readonly aiProvider: AIProvider,
    private readonly now: () => Date = () => new Date(),
    private readonly diagnosticSink: GenerationDiagnosticSink = NOOP_GENERATION_DIAGNOSTIC_SINK,
  ) {}

  private async generateValid<T>(
    schema: z.ZodType<T>,
    input: AIProviderInput,
    normalizeOutput: (output: unknown) => unknown = (output) => output,
  ): Promise<T> {
    const task = input.kind;
    const stage = diagnosticStageByTask[task];
    let repairIssues: readonly SafeGenerationIssue[] | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const output = await this.aiProvider.generateStructured({
          schema,
          promptVersion: PROMPT_VERSION,
          input,
          ...(repairIssues && repairIssues.length > 0 ? { repairIssues } : {}),
        });
        const parsed = schema.safeParse(normalizeOutput(output));
        if (parsed.success) return parsed.data;
        repairIssues = sanitizeGenerationIssues(parsed.error.issues);
        emitGenerationDiagnostic(this.diagnosticSink, {
          stage,
          kind: `${task}:zod-invalid`,
          issues: repairIssues,
        });
      } catch (error) {
        if (isAIProviderError(error)) {
          if (error.kind === "invalid-output") {
            repairIssues = undefined;
            emitGenerationDiagnostic(this.diagnosticSink, {
              stage,
              kind: `${task}:provider-invalid-output`,
              issues: [],
            });
            continue;
          }
          throw new ApplicationError(
            "GENERATION_FAILED",
            providerFailureMessages[error.kind],
            500,
          );
        }
        throw error;
      }
    }
    throw new ApplicationError(
      "INVALID_GENERATED_CONTENT",
      "AI không thể tạo nội dung hợp lệ sau 3 lần thử.",
      422,
    );
  }

  private validateLesson(input: unknown): GeneratedLesson {
    return validateLessonTraceability(input, (issues) => {
      emitGenerationDiagnostic(this.diagnosticSink, {
        stage: "validating-lesson",
        kind: "lesson:zod-invalid",
        issues: sanitizeGenerationIssues(issues),
      });
    });
  }

  private async generateExercises(
    input: Omit<Extract<AIProviderInput, { kind: "exercises" }>, "batch">,
    focus: LearningFocus,
  ) {
    const distribution = FOCUS_EXERCISE_DISTRIBUTION[focus];
    const generated = await mapInOrderWithConcurrency(
      EXERCISE_TRANSPORT_BUCKETS,
      this.aiProvider.maxConcurrency,
      async (type) => {
        const batchInput: Extract<AIProviderInput, { kind: "exercises" }> = {
          ...input,
          batch: { type, count: distribution[type] },
        };
        const result = await this.generateValid(
          exerciseBatchTransportSchema(type, distribution[type], input.transcript),
          batchInput,
          (output) => normalizeAutoLevelExerciseDifficulty(output, input.targetLevel),
        );
        return assignServerOwnedExerciseIds(input.generationId, type, result.exercises);
      },
    );
    const batches = Object.fromEntries(
      EXERCISE_TRANSPORT_BUCKETS.map((type, index) => [type, generated[index]]),
    ) as Record<ExerciseType, Exercise[]>;
    const exercises = interleaveExerciseBatches(batches);
    const parsed = exerciseListSchemaForFocus(focus).safeParse(exercises);
    if (parsed.success) return parsed.data;

    emitGenerationDiagnostic(this.diagnosticSink, {
      stage: "generating-exercises",
      kind: "exercises:zod-invalid",
      issues: sanitizeGenerationIssues(parsed.error.issues),
    });
    throw new ApplicationError(
      "INVALID_GENERATED_CONTENT",
      "AI không thể tạo nội dung hợp lệ sau 3 lần thử.",
      422,
    );
  }

  private commonInput(request: GenerateLessonRequest) {
    const { video, processingKey, lessonId } = request;
    return {
      processingKey,
      generationId: request.generationId,
      youtubeVideoId: video.youtubeVideoId,
      lessonId,
      learningLanguage: video.learningLanguage,
      nativeLanguage: video.nativeLanguage,
      targetLevel: video.targetLevel,
      learningFocus: video.learningFocus,
    };
  }

  private async generateChunkContent<T extends { id: string; sourceSegmentIds: string[] }>(
    kind: "vocabulary" | "grammar",
    chunks: TranscriptChunk[],
    targets: number[],
    common: ReturnType<LearningGenerationPipeline["commonInput"]>,
    schema: z.ZodType<T[]>,
  ): Promise<T[][]> {
    const selected = chunks.flatMap((chunk, index) => targets[index] > 0
      ? [{ chunk, index, targetCount: targets[index] }]
      : []);
    return mapInOrderWithConcurrency(selected, this.aiProvider.maxConcurrency, async ({ chunk, index, targetCount }) => {
      const sourceIds = new Set(chunk.segments.map((segment) => segment.id));
      const localSchema = schema.refine(
        (items) => referencesOnlyChunk(items, sourceIds),
        { message: "Nội dung phải dẫn nguồn từ chính đoạn đang phân tích." },
      );
      return assignServerOwnedChunkIds(kind, index, await this.generateValid(localSchema, {
        ...common, kind, chunk, targetCount,
      }));
    });
  }

  private async completeContent<T extends { id: string; sourceSegmentIds: string[] }>(
    kind: "vocabulary" | "grammar",
    current: T[],
    target: number,
    chunks: TranscriptChunk[],
    common: ReturnType<LearningGenerationPipeline["commonInput"]>,
    schema: z.ZodType<T[]>,
    merge: (groups: T[][]) => T[],
    label: (item: T) => string,
    isDemo: boolean,
  ): Promise<T[]> {
    const minimum = Math.max(1, Math.ceil(target * 0.75));
    if (isDemo || current.length >= minimum) return current;
    const repairIndex = chunks.reduce((best, chunk, index) =>
      chunk.segments.reduce((sum, segment) => sum + segment.text.length, 0)
      > chunks[best].segments.reduce((sum, segment) => sum + segment.text.length, 0)
        ? index : best, 0);
    const chunk = chunks[repairIndex];
    const sourceIds = new Set(chunk.segments.map((segment) => segment.id));
    const localSchema = schema.refine(
      (items) => referencesOnlyChunk(items, sourceIds),
      { message: "Nội dung bổ sung phải dẫn nguồn từ đoạn đang phân tích." },
    );
    const extra = assignServerOwnedChunkIds(kind, chunks.length, await this.generateValid(localSchema, {
      ...common,
      kind,
      chunk,
      targetCount: Math.min(8, target - current.length),
      excludeTerms: current.map(label),
    }));
    const merged = merge([current, extra]);
    if (merged.length < minimum) {
      throw new ApplicationError(
        "INVALID_GENERATED_CONTENT",
        "AI chưa tạo đủ từ vựng hoặc ngữ pháp có dẫn chứng từ video. Vui lòng thử lại.",
        422,
      );
    }
    return merged;
  }

  async generateLesson(request: GenerateLessonRequest): Promise<PipelineResult> {
    await request.onStage("fetching-transcript", 10);
    const fetched = await this.transcriptProvider.fetchTranscript({
      videoId: request.video.id,
      youtubeVideoId: request.video.youtubeVideoId,
      learningLanguage: request.video.learningLanguage,
      nativeLanguage: request.video.nativeLanguage,
    });

    await request.onStage("analyzing", 30);
    const transcript = normalizeTranscript(fetched.segments);
    if (JSON.stringify(transcript).length > MAX_GENERATION_TRANSCRIPT_BYTES) {
      throw new ApplicationError(
        "TRANSCRIPT_UNAVAILABLE",
        "Transcript quá dài cho một bài học. Vui lòng chọn video ngắn hơn.",
        422,
      );
    }
    let chunks: TranscriptChunk[];
    try {
      chunks = chunkTranscript(transcript);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new ApplicationError(
        "TRANSCRIPT_UNAVAILABLE",
        "Có đoạn transcript quá dài để phân tích thành bài học.",
        422,
      );
    }
    const common = this.commonInput(request);
    const targets = contentTargets(transcript);
    const vocabularyTargets = allocateContentTargets(chunks, targets.vocabulary);
    const grammarTargets = allocateContentTargets(chunks, targets.grammar);

    await request.onStage("generating-vocabulary", 45);
    const vocabulary = await this.completeContent(
      "vocabulary",
      mergeVocabulary(await this.generateChunkContent(
        "vocabulary", chunks, vocabularyTargets, common, vocabularyListSchema,
      )),
      targets.vocabulary, chunks, common, vocabularyListSchema,
      mergeVocabulary, (item) => item.word, fetched.provenance.kind === "demo",
    );

    await request.onStage("generating-grammar", 60);
    const grammar = await this.completeContent(
      "grammar",
      mergeGrammar(await this.generateChunkContent(
        "grammar", chunks, grammarTargets, common, grammarListSchema,
      )),
      targets.grammar, chunks, common, grammarListSchema,
      mergeGrammar, (item) => item.title, fetched.provenance.kind === "demo",
    );

    await request.onStage("generating-lesson", 75);
    const generatedSections = await this.generateValid(sectionListSchema, {
      ...common,
      kind: "sections",
      transcript,
    });
    const sections = [...generatedSections]
      .sort((left, right) => left.order - right.order)
      .map((section, index) => ({ ...section, order: index + 1 }));

    await request.onStage("generating-exercises", 90);
    const exercises = await this.generateExercises({
      ...common,
      kind: "exercises",
      transcript,
    }, request.video.learningFocus);

    const lesson = this.validateLesson({
      id: request.lessonId,
      videoId: request.video.id,
      title: "Bài học theo ngữ cảnh",
      description: lessonCopy[request.video.learningFocus].description,
      summary: lessonCopy[request.video.learningFocus].summary,
      level: request.video.targetLevel ?? { system: "CEFR", value: "B1" },
      learningFocus: request.video.learningFocus,
      transcriptSource: fetched.provenance.kind === "demo" ? "demo" : "youtube",
      transcriptProvenance: fetched.provenance,
      sections,
      transcript,
      vocabulary,
      grammar,
      exercises,
      promptVersion: PROMPT_VERSION,
      processingKey: request.processingKey,
      createdAt: this.now().toISOString(),
    });
    return { transcript, lesson };
  }

  async regenerateExercises(
    request: GenerateLessonRequest,
    existing: GeneratedLesson,
  ): Promise<PipelineResult> {
    if (existing.learningFocus !== request.video.learningFocus) {
      throw new ApplicationError(
        "CONFLICT",
        "Trọng tâm của bài học không khớp với cấu hình video. Hãy tạo lại toàn bộ bài học.",
        409,
      );
    }
    await request.onStage("generating-exercises", 90);
    const exercises = await this.generateExercises({
      ...this.commonInput(request),
      kind: "exercises",
      transcript: existing.transcript,
    }, request.video.learningFocus);
    const lesson = this.validateLesson({
      ...existing,
      exercises,
      promptVersion: PROMPT_VERSION,
      processingKey: request.processingKey,
      createdAt: this.now().toISOString(),
    });
    return { transcript: lesson.transcript, lesson };
  }
}
