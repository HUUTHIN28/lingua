import { z } from "zod";
import { exerciseSchema, publicExerciseSchema } from "@/domain/exercise";
import { learningFocusSchema, learningLevelSchema } from "@/domain/language";
import { transcriptProvenanceSchema, transcriptSegmentSchema, transcriptSourceSchema } from "@/domain/transcript";

export const learningSectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    startTimeSeconds: z.number().nonnegative(),
    endTimeSeconds: z.number().positive(),
    order: z.number().int().nonnegative(),
    sourceSegmentIds: z.array(z.string().min(1)).min(1),
  })
  .refine((section) => section.endTimeSeconds > section.startTimeSeconds, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
    path: ["endTimeSeconds"],
  });
export type LearningSection = z.infer<typeof learningSectionSchema>;

export const vocabularyItemSchema = z.object({
  id: z.string().min(1),
  word: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  translation: z.string().trim().min(1),
  partOfSpeech: z.string().trim().min(1).optional(),
  pronunciation: z.string().trim().min(1).optional(),
  exampleSentence: z.string().trim().min(1),
  exampleTranslation: z.string().trim().min(1),
  difficulty: learningLevelSchema.optional(),
  sourceSegmentIds: z.array(z.string().min(1)).min(1),
});
export type VocabularyItem = z.infer<typeof vocabularyItemSchema>;

export const grammarExampleSchema = z.object({
  sentence: z.string().trim().min(1),
  translation: z.string().trim().min(1),
  sourceSegmentId: z.string().min(1),
});
export type GrammarExample = z.infer<typeof grammarExampleSchema>;

export const grammarPointSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  pattern: z.string().trim().min(1).optional(),
  examples: z.array(grammarExampleSchema).min(1),
  difficulty: learningLevelSchema.optional(),
  sourceSegmentIds: z.array(z.string().min(1)).min(1),
});
export type GrammarPoint = z.infer<typeof grammarPointSchema>;

const generatedLessonShape = {
  id: z.string().min(1),
  videoId: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  level: learningLevelSchema,
  learningFocus: learningFocusSchema,
  transcriptSource: transcriptSourceSchema,
  transcriptProvenance: transcriptProvenanceSchema,
  sections: z.array(learningSectionSchema).min(1),
  transcript: z.array(transcriptSegmentSchema).min(1),
  vocabulary: z.array(vocabularyItemSchema),
  grammar: z.array(grammarPointSchema),
  promptVersion: z.string().min(1),
  processingKey: z.string().min(1),
  createdAt: z.string().datetime(),
};

function addDuplicateIssues(
  values: Array<{ id: string }>,
  path: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      context.addIssue({
        code: "custom",
        path: [path, index, "id"],
        message: `ID trùng lặp: ${value.id}`,
      });
    }
    seen.add(value.id);
  });
}

type TraceableLesson = {
  id: string;
  videoId: string;
  sections: Array<{ sourceSegmentIds: string[] }>;
  transcript: Array<{ id: string; videoId: string }>;
  vocabulary: Array<{ sourceSegmentIds: string[] }>;
  grammar: Array<{
    sourceSegmentIds: string[];
    examples: Array<{ sourceSegmentId: string }>;
  }>;
  exercises: Array<{ lessonId: string; sourceSegmentIds: string[] }>;
  transcriptSource: "demo" | "youtube";
  transcriptProvenance: { kind: "demo" | "youtube-manual-captions" | "youtube-auto-captions" | "gemini-video" };
};

function validateTraceability(lesson: TraceableLesson, context: z.RefinementCtx) {
  if (lesson.transcriptSource !== (lesson.transcriptProvenance.kind === "demo" ? "demo" : "youtube")) {
    context.addIssue({ code: "custom", path: ["transcriptSource"], message: "Nguồn transcript không khớp với provenance." });
  }
  const sourceIds = new Set(lesson.transcript.map((segment) => segment.id));
  const checkSources = (ids: string[], path: Array<string | number>) => {
    ids.forEach((id, index) => {
      if (!sourceIds.has(id)) {
        context.addIssue({
          code: "custom",
          path: [...path, index],
          message: `Không tìm thấy transcript segment: ${id}`,
        });
      }
    });
  };

  lesson.transcript.forEach((segment, index) => {
    if (segment.videoId !== lesson.videoId) {
      context.addIssue({
        code: "custom",
        path: ["transcript", index, "videoId"],
        message: "Transcript phải thuộc video của bài học.",
      });
    }
  });
  lesson.sections.forEach((item, index) =>
    checkSources(item.sourceSegmentIds, ["sections", index, "sourceSegmentIds"]),
  );
  lesson.vocabulary.forEach((item, index) =>
    checkSources(item.sourceSegmentIds, ["vocabulary", index, "sourceSegmentIds"]),
  );
  lesson.grammar.forEach((item, index) => {
    checkSources(item.sourceSegmentIds, ["grammar", index, "sourceSegmentIds"]);
    item.examples.forEach((example, exampleIndex) =>
      checkSources(
        [example.sourceSegmentId],
        ["grammar", index, "examples", exampleIndex, "sourceSegmentId"],
      ),
    );
  });
  lesson.exercises.forEach((item, index) => {
    if (item.lessonId !== lesson.id) {
      context.addIssue({
        code: "custom",
        path: ["exercises", index, "lessonId"],
        message: "Exercise phải thuộc bài học hiện tại.",
      });
    }
    checkSources(item.sourceSegmentIds, ["exercises", index, "sourceSegmentIds"]);
  });
}

export const generatedLessonSchema = z
  .object({ ...generatedLessonShape, exercises: z.array(exerciseSchema).min(1) })
  .superRefine((lesson, context) => {
    addDuplicateIssues(lesson.transcript, "transcript", context);
    addDuplicateIssues(lesson.sections, "sections", context);
    addDuplicateIssues(lesson.vocabulary, "vocabulary", context);
    addDuplicateIssues(lesson.grammar, "grammar", context);
    addDuplicateIssues(lesson.exercises, "exercises", context);
    validateTraceability(lesson, context);
  });
export type GeneratedLesson = z.infer<typeof generatedLessonSchema>;

export const publicLessonSchema = z
  .object({ ...generatedLessonShape, exercises: z.array(publicExerciseSchema).min(1) })
  .superRefine(validateTraceability);
export type PublicLesson = z.infer<typeof publicLessonSchema>;
