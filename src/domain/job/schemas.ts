import { z } from "zod";

export const processingStatusSchema = z.enum([
  "pending",
  "fetching-transcript",
  "analyzing",
  "generating-vocabulary",
  "generating-grammar",
  "generating-lesson",
  "generating-exercises",
  "completed",
  "failed",
]);
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;

export const learningGenerationJobSchema = z.object({
  id: z.string().min(1),
  videoId: z.string().min(1),
  lessonId: z.string().min(1).nullable(),
  status: processingStatusSchema,
  progress: z.number().int().min(0).max(100),
  currentStep: z.string().min(1),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type LearningGenerationJob = z.infer<typeof learningGenerationJobSchema>;

export const generationRequestSchema = z.object({
  scope: z.enum(["lesson", "exercises"]),
  force: z.boolean(),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
