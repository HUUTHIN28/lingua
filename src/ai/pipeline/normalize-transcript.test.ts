import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/domain/transcript";
import { normalizeTranscript } from "./normalize-transcript";

const segment = (id: string, startTimeSeconds: number): TranscriptSegment => ({
  id,
  videoId: "video-1",
  startTimeSeconds,
  endTimeSeconds: startTimeSeconds + 5,
  text: `Spoken source ${id}`,
  translation: `Bản dịch ${id}`,
});

describe("normalizeTranscript", () => {
  it("sorts complete translated cues without dropping repeated speech", () => {
    const result = normalizeTranscript([segment("later", 5), segment("first", 0), segment("repeat", 10)]);
    expect(result.map(({ id }) => id)).toEqual(["first", "later", "repeat"]);
  });

  it("rejects untranslated, oversized, and excessively long input instead of truncating it", () => {
    expect(() => normalizeTranscript([{ ...segment("first", 0), translation: null }]))
      .toThrow(/chưa được dịch/);
    expect(() => normalizeTranscript([segment("first", 0), segment("late", 5400)]))
      .toThrow(/thời lượng/);
    expect(() => normalizeTranscript(Array.from({ length: 1801 }, (_, index) => segment(`cue-${index}`, index))))
      .toThrow(/quá dài/);
  });
});
