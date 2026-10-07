import type { TranscriptSegment } from "@/domain/transcript";
import { formatTimestamp } from "@/lib/format";

export function createTranscriptTimestampMap(transcript: readonly TranscriptSegment[]) {
  return new Map(transcript.map((segment) => [segment.id, formatTimestamp(segment.startTimeSeconds)]));
}
