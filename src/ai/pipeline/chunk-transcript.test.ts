import { describe, expect, it } from "vitest";
import { chunkTranscript } from "./chunk-transcript";
import type { TranscriptSegment } from "@/domain/transcript";
import { allocateContentTargets, contentTargets } from "@/ai/prompts/generation-policy";

const segments: TranscriptSegment[] = Array.from({ length: 7 }, (_, index) => ({
  id: `segment-${index}`,
  videoId: "video-1",
  startTimeSeconds: index * 2,
  endTimeSeconds: index * 2 + 2,
  text: `Line ${index}`,
  translation: `Dòng ${index}`,
}));

describe("chunkTranscript", () => {
  it("preserves order and includes every segment exactly once", () => {
    const chunks = chunkTranscript(segments, 3);
    expect(chunks).toHaveLength(3);
    expect(chunks.flatMap((chunk) => chunk.segments.map((segment) => segment.id)))
      .toEqual(segments.map((segment) => segment.id));
    expect(chunks.map((chunk) => [chunk.startTimeSeconds, chunk.endTimeSeconds]))
      .toEqual([[0, 6], [6, 12], [12, 14]]);
  });

  it("handles empty input and rejects invalid limits", () => {
    expect(chunkTranscript([], 3)).toEqual([]);
    expect(() => chunkTranscript(segments, 0)).toThrow(RangeError);
  });

  it.each([706, 1200, 3600])("bounds calls while preserving every cue in a %i-second source", (duration) => {
    const cues: TranscriptSegment[] = Array.from({ length: Math.ceil(duration / 5) }, (_, index) => ({
      id: `cue-${index}`,
      videoId: "video-1",
      startTimeSeconds: index * 5,
      endTimeSeconds: Math.min(duration, index * 5 + 5),
      text: `At minute ${index}, the speaker explains a different useful detail for this lesson.`,
      translation: `Ở phút ${index}, người nói giải thích một chi tiết hữu ích khác cho bài học này.`,
    }));
    const chunks = chunkTranscript(cues);
    const targets = contentTargets(cues);
    const vocabularyPlan = allocateContentTargets(chunks, targets.vocabulary);
    const grammarPlan = allocateContentTargets(chunks, targets.grammar);
    expect(chunks.flatMap((chunk) => chunk.segments.map((segment) => segment.id)))
      .toEqual(cues.map((segment) => segment.id));
    expect(chunks.every((chunk) =>
      chunk.endTimeSeconds - chunk.startTimeSeconds <= 210
      && chunk.segments.length <= 100
      && chunk.segments.reduce((sum, segment) => sum + segment.text.length + segment.translation!.length, 0) <= 4800,
    )).toBe(true);
    expect(vocabularyPlan.reduce((sum, count) => sum + count, 0)).toBe(targets.vocabulary);
    expect(grammarPlan.reduce((sum, count) => sum + count, 0)).toBe(targets.grammar);
    expect(vocabularyPlan.filter(Boolean).length + grammarPlan.filter(Boolean).length).toBeLessThan(40);
    if (duration === 706) {
      expect(targets.vocabulary).toBeGreaterThanOrEqual(12);
      expect(targets.vocabulary).toBeLessThanOrEqual(20);
      expect(targets.grammar).toBeGreaterThanOrEqual(5);
      expect(targets.grammar).toBeLessThanOrEqual(8);
    }
  });
});
