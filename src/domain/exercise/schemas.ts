import { z } from "zod";
import { languageCodeSchema, learningLevelSchema } from "@/domain/language";

export const exerciseTypeSchema = z.enum([
  "multiple-choice",
  "fill-blank",
  "translation",
  "listening",
  "dictation",
]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

const baseExerciseShape = {
  id: z.string().min(1),
  lessonId: z.string().min(1),
  question: z.string().trim().min(1),
  explanation: z.string().trim().min(1).optional(),
  difficulty: learningLevelSchema.optional(),
  sourceSegmentIds: z.array(z.string().min(1)).min(1),
};

export const multipleChoiceExerciseSchema = z
  .object({
    ...baseExerciseShape,
    type: z.literal("multiple-choice"),
    options: z.array(z.string().trim().min(1)).min(2),
    correctAnswer: z.string().trim().min(1),
  })
  .superRefine((exercise, context) => {
    if (new Set(exercise.options).size !== exercise.options.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Các lựa chọn phải khác nhau.",
      });
    }
    if (exercise.options.filter((option) => option === exercise.correctAnswer).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["correctAnswer"],
        message: "Đáp án đúng phải xuất hiện đúng một lần trong các lựa chọn.",
      });
    }
  });

export const fillBlankExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("fill-blank"),
  sentence: z.string().trim().min(1),
  correctAnswer: z.string().trim().min(1),
});

export const translationExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("translation"),
  sourceText: z.string().trim().min(1),
  sourceLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
  expectedAnswer: z.string().trim().min(1),
});

const timedExerciseShape = {
  ...baseExerciseShape,
  startTimeSeconds: z.number().nonnegative(),
  endTimeSeconds: z.number().positive(),
  expectedAnswer: z.string().trim().min(1),
};

export const listeningExerciseSchema = z
  .object({ ...timedExerciseShape, type: z.literal("listening") })
  .refine((exercise) => exercise.endTimeSeconds > exercise.startTimeSeconds, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
    path: ["endTimeSeconds"],
  });

export const dictationExerciseSchema = z
  .object({ ...timedExerciseShape, type: z.literal("dictation") })
  .refine((exercise) => exercise.endTimeSeconds > exercise.startTimeSeconds, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
    path: ["endTimeSeconds"],
  });

export const exerciseSchema = z.union([
  multipleChoiceExerciseSchema,
  fillBlankExerciseSchema,
  translationExerciseSchema,
  listeningExerciseSchema,
  dictationExerciseSchema,
]);
export type Exercise = z.infer<typeof exerciseSchema>;
export type MultipleChoiceExercise = z.infer<typeof multipleChoiceExerciseSchema>;
export type FillBlankExercise = z.infer<typeof fillBlankExerciseSchema>;
export type TranslationExercise = z.infer<typeof translationExerciseSchema>;
export type ListeningExercise = z.infer<typeof listeningExerciseSchema>;
export type DictationExercise = z.infer<typeof dictationExerciseSchema>;

const publicMultipleChoiceExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("multiple-choice"),
  options: z.array(z.string().trim().min(1)).min(2),
});
const publicFillBlankExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("fill-blank"),
  sentence: z.string().trim().min(1),
});
const publicTranslationExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("translation"),
  sourceText: z.string().trim().min(1),
  sourceLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
});
const publicListeningExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("listening"),
  startTimeSeconds: z.number().nonnegative(),
  endTimeSeconds: z.number().positive(),
});
const publicDictationExerciseSchema = z.object({
  ...baseExerciseShape,
  type: z.literal("dictation"),
  startTimeSeconds: z.number().nonnegative(),
  endTimeSeconds: z.number().positive(),
});

export const publicExerciseSchema = z.discriminatedUnion("type", [
  publicMultipleChoiceExerciseSchema,
  publicFillBlankExerciseSchema,
  publicTranslationExerciseSchema,
  publicListeningExerciseSchema,
  publicDictationExerciseSchema,
]);
export type PublicExercise = z.infer<typeof publicExerciseSchema>;

export const exerciseSubmissionSchema = z.object({
  answer: z.string().trim().min(1, "Vui lòng nhập câu trả lời."),
});
export type ExerciseSubmission = z.infer<typeof exerciseSubmissionSchema>;

export const exerciseCheckResultSchema = z.object({
  exerciseId: z.string().min(1),
  correct: z.boolean(),
  submittedAnswer: z.string(),
  expectedAnswer: z.string().min(1),
  explanation: z.string().min(1),
  completedExercises: z.number().int().nonnegative(),
  totalExercises: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(100),
});
export type ExerciseCheckResult = z.infer<typeof exerciseCheckResultSchema>;
