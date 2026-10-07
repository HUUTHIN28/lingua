import { z } from "zod";
import { exerciseTypeSchema } from "@/domain/exercise";

export const DEMO_USER_ID = "demo-user" as const;

export const lessonProgressSchema = z.object({
  userId: z.literal(DEMO_USER_ID),
  lessonId: z.string().min(1),
  completed: z.boolean(),
  score: z.number().int().min(0).max(100),
  completedExercises: z.number().int().nonnegative(),
  totalExercises: z.number().int().nonnegative(),
  answeredExerciseIds: z.array(z.string().min(1)),
  lastStudiedAt: z.string().datetime(),
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

export const exerciseAttemptStateSchema = z.object({
  exerciseId: z.string().min(1),
  attemptCount: z.number().int().positive(),
  firstAttemptCorrect: z.boolean(),
  latestCorrect: z.boolean(),
});
export type ExerciseAttemptState = z.infer<typeof exerciseAttemptStateSchema>;

export const assessmentBandSchema = z.enum(["needs-review", "developing", "strong"]);
export type AssessmentBand = z.infer<typeof assessmentBandSchema>;

export const exerciseTypeAssessmentSchema = z.object({
  type: exerciseTypeSchema,
  label: z.string().trim().min(1),
  correct: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
});
export type ExerciseTypeAssessment = z.infer<typeof exerciseTypeAssessmentSchema>;

export const assessmentMistakeSchema = z.object({
  exerciseId: z.string().min(1),
  type: exerciseTypeSchema,
  typeLabel: z.string().trim().min(1),
  question: z.string().trim().min(1),
  submittedAnswer: z.string(),
  expectedAnswer: z.string().min(1),
  explanation: z.string().min(1),
  attemptCount: z.number().int().positive(),
  resolvedAfterRetry: z.boolean(),
});
export type AssessmentMistake = z.infer<typeof assessmentMistakeSchema>;

export const assessmentRecommendationSchema = z.object({
  type: exerciseTypeSchema.nullable(),
  label: z.string().trim().min(1),
  priority: z.enum(["high", "medium", "maintenance"]),
  observation: z.string().trim().min(1),
  evidenceExerciseIds: z.array(z.string().min(1)),
  studyTopics: z.array(z.string().trim().min(1)).min(1),
  actions: z.array(z.string().trim().min(1)).min(1),
});
export type AssessmentRecommendation = z.infer<typeof assessmentRecommendationSchema>;

export const lessonAssessmentReportSchema = z.object({
  lessonId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  correctExercises: z.number().int().nonnegative(),
  totalExercises: z.number().int().positive(),
  band: assessmentBandSchema,
  summary: z.string().trim().min(1),
  byType: z.array(exerciseTypeAssessmentSchema).min(1),
  mistakes: z.array(assessmentMistakeSchema),
  recommendations: z.array(assessmentRecommendationSchema).min(1),
});
export type LessonAssessmentReport = z.infer<typeof lessonAssessmentReportSchema>;

export const videoProgressSchema = z.object({
  userId: z.literal(DEMO_USER_ID),
  videoId: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  lastPositionSeconds: z.number().nonnegative().nullable(),
  lastStudiedAt: z.string().datetime().nullable(),
});
export type VideoProgress = z.infer<typeof videoProgressSchema>;
