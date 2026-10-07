import { transcriptSegmentSchema, type TranscriptSegment } from "@/domain/transcript";
import { ApplicationError } from "@/services/learning/errors";

export const MAX_TRANSCRIPT_SEGMENTS = 1800;
export const MAX_TRANSCRIPT_CHARACTERS = 160_000;
export const MAX_TRANSCRIPT_DURATION_SECONDS = 5400;

export function normalizeTranscript(input: TranscriptSegment[]): TranscriptSegment[] {
  if (input.length === 0 || input.length > MAX_TRANSCRIPT_SEGMENTS) {
    throw new ApplicationError(
      "TRANSCRIPT_UNAVAILABLE",
      "Transcript quá dài hoặc không có lời thoại để tạo bài học.",
      422,
    );
  }
  const parsed = input.map((segment) => transcriptSegmentSchema.safeParse(segment));
  if (parsed.some((result) => !result.success)) {
    throw new ApplicationError(
      "TRANSCRIPT_UNAVAILABLE",
      "Transcript của video không hợp lệ.",
      422,
    );
  }
  const normalized = parsed
    .map((result) => result.data!)
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
  if (new Set(normalized.map((segment) => segment.id)).size !== normalized.length) {
    throw new ApplicationError(
      "TRANSCRIPT_UNAVAILABLE",
      "Transcript chứa đoạn bị trùng lặp.",
      422,
    );
  }
  if (normalized.at(-1)!.endTimeSeconds - normalized[0].startTimeSeconds > MAX_TRANSCRIPT_DURATION_SECONDS) {
    throw new ApplicationError(
      "TRANSCRIPT_UNAVAILABLE",
      "Video vượt quá thời lượng bài học hỗ trợ. Vui lòng chọn video ngắn hơn.",
      422,
    );
  }
  const totalCharacters = normalized.reduce(
    (sum, segment) => sum + segment.text.length + (segment.translation?.length ?? 0),
    0,
  );
  if (
    totalCharacters > MAX_TRANSCRIPT_CHARACTERS
    || normalized.some((segment) => !segment.translation?.trim() || segment.text.length > 1500 || segment.translation.length > 1500)
  ) {
    throw new ApplicationError(
      "TRANSCRIPT_UNAVAILABLE",
      "Transcript vượt quá giới hạn bài học hoặc còn đoạn chưa được dịch. Vui lòng thử video ngắn hơn.",
      422,
    );
  }
  return normalized;
}
