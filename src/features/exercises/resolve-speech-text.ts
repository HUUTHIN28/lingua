import type { TranscriptSegment } from "@/domain/transcript";

export function createTranscriptTextMap(
  transcript: readonly Pick<TranscriptSegment, "id" | "text">[],
): ReadonlyMap<string, string> {
  return new Map(transcript.map((segment) => [segment.id, segment.text]));
}

export function resolveExerciseSpeechText(
  sourceSegmentIds: readonly string[],
  transcriptTextById: ReadonlyMap<string, string>,
): string | undefined {
  if (sourceSegmentIds.length === 0) return undefined;
  const parts: string[] = [];
  for (const id of sourceSegmentIds) {
    const text = transcriptTextById.get(id);
    if (text === undefined || !text.trim()) return undefined;
    parts.push(text);
  }
  return parts.join(" ");
}
