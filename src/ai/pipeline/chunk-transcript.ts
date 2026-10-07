import type { TranscriptChunk, TranscriptSegment } from "@/domain/transcript";

export type ChunkTranscriptLimits = {
  maxTimeSeconds?: number;
  maxCharacters?: number;
  maxSegments?: number;
};

export function chunkTranscript(
  segments: TranscriptSegment[],
  limits: number | ChunkTranscriptLimits = {},
): TranscriptChunk[] {
  const options = typeof limits === "number" ? { maxSegments: limits } : limits;
  const { maxTimeSeconds = 210, maxCharacters = 4800, maxSegments = 100 } = options;
  if (
    !Number.isFinite(maxTimeSeconds) || maxTimeSeconds <= 0
    || !Number.isInteger(maxCharacters) || maxCharacters < 1
    || !Number.isInteger(maxSegments) || maxSegments < 1
  ) {
    throw new RangeError("Giới hạn chia transcript phải là số dương hợp lệ.");
  }
  const chunks: TranscriptChunk[] = [];
  let slice: TranscriptSegment[] = [];
  let characters = 0;
  const appendChunk = () => {
    if (slice.length === 0) return;
    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      startTimeSeconds: slice[0].startTimeSeconds,
      endTimeSeconds: slice.at(-1)!.endTimeSeconds,
      segments: slice,
    });
    slice = [];
    characters = 0;
  };
  for (const segment of segments) {
    const segmentCharacters = segment.text.length + (segment.translation?.length ?? 0);
    if (segmentCharacters > maxCharacters || segment.endTimeSeconds - segment.startTimeSeconds > maxTimeSeconds) {
      throw new RangeError("Một đoạn transcript vượt quá giới hạn tạo bài học.");
    }
    if (
      slice.length > 0
      && (slice.length >= maxSegments
        || characters + segmentCharacters > maxCharacters
        || segment.endTimeSeconds - slice[0].startTimeSeconds > maxTimeSeconds)
    ) {
      appendChunk();
    }
    slice.push(segment);
    characters += segmentCharacters;
  }
  appendChunk();
  return chunks;
}
