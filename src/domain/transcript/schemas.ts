import { z } from "zod";

export const transcriptSourceSchema = z.enum(["demo", "youtube"]);
export type TranscriptSource = z.infer<typeof transcriptSourceSchema>;

export const transcriptProvenanceSchema = z.object({
  kind: z.enum(["youtube-manual-captions", "youtube-auto-captions", "gemini-video", "demo"]),
  sourceLanguage: z.string().trim().min(2),
  captionFormat: z.enum(["json3", "vtt"]).nullable(),
  translationKind: z.enum(["gemini", "source", "demo"]),
  nativeLanguage: z.string().trim().min(2),
  model: z.string().trim().min(1).nullable(),
  strategyVersion: z.string().trim().min(1),
  durationSeconds: z.number().positive().nullable(),
  coverage: z.object({
    attemptedRanges: z.array(z.object({
      startTimeSeconds: z.number().nonnegative(),
      endTimeSeconds: z.number().positive(),
    }).refine((range) => range.endTimeSeconds > range.startTimeSeconds)).min(1),
    firstSpeechSeconds: z.number().nonnegative().nullable(),
    lastSpeechSeconds: z.number().nonnegative().nullable(),
    method: z.enum(["caption-timestamps", "gemini-estimated", "demo"]),
  }),
});
export type TranscriptProvenance = z.infer<typeof transcriptProvenanceSchema>;

export const transcriptSegmentSchema = z
  .object({
    id: z.string().min(1),
    videoId: z.string().min(1),
    startTimeSeconds: z.number().nonnegative(),
    endTimeSeconds: z.number().positive(),
    text: z.string().trim().min(1),
    translation: z.string().trim().min(1).nullable(),
  })
  .refine((segment) => segment.endTimeSeconds > segment.startTimeSeconds, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
    path: ["endTimeSeconds"],
  });
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const transcriptChunkSchema = z
  .object({
    id: z.string().min(1),
    startTimeSeconds: z.number().nonnegative(),
    endTimeSeconds: z.number().positive(),
    segments: z.array(transcriptSegmentSchema).min(1),
  })
  .refine((chunk) => chunk.endTimeSeconds > chunk.startTimeSeconds, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
    path: ["endTimeSeconds"],
  });
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;
