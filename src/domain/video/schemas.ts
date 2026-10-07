import { z } from "zod";
import {
  DEFAULT_LEARNING_FOCUS,
  languageCodeSchema,
  learningFocusSchema,
  learningLevelSchema,
} from "@/domain/language";

export const videoStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
export type VideoStatus = z.infer<typeof videoStatusSchema>;

export const youTubeVideoSchema = z.object({
  id: z.string().min(1),
  youtubeVideoId: z.string().min(1),
  youtubeUrl: z.string().url(),
  title: z.string().min(1),
  description: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  detectedLanguage: languageCodeSchema.nullable(),
  learningLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema,
  targetLevel: learningLevelSchema.nullable(),
  learningFocus: learningFocusSchema,
  lessonId: z.string().min(1).nullable(),
  status: videoStatusSchema,
  processingProgress: z.number().min(0).max(100).nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type YouTubeVideo = z.infer<typeof youTubeVideoSchema>;

export const createVideoInputSchema = z.object({
  youtubeUrl: z.string().trim().min(1, "Vui lòng nhập URL YouTube."),
  learningLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema,
  targetLevel: learningLevelSchema.nullable(),
  learningFocus: learningFocusSchema.default(DEFAULT_LEARNING_FOCUS),
});
export type CreateVideoInput = z.infer<typeof createVideoInputSchema>;

export const updateVideoInputSchema = z
  .object({
    youtubeUrl: z.string().trim().min(1, "Vui lòng nhập URL YouTube.").optional(),
    learningLanguage: languageCodeSchema.optional(),
    nativeLanguage: languageCodeSchema.optional(),
    targetLevel: learningLevelSchema.nullable().optional(),
    learningFocus: learningFocusSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Cần ít nhất một thay đổi.");
export type UpdateVideoInput = z.infer<typeof updateVideoInputSchema>;
