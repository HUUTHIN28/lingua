import { describe, expect, it } from "vitest";
import { parseJson3Captions } from "./json3";
import { parseVttCaptions } from "./vtt";

describe("caption parsers", () => {
  it("parses JSON3 timing, Unicode, and overlapping rolling captions", () => {
    const source = JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 1800, segs: [{ utf8: "Hello" }] },
      { tStartMs: 900, dDurationMs: 1800, segs: [{ utf8: "Hello world!" }] },
      { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: "Café &amp; tea." }] },
    ] });
    expect(parseJson3Captions(source, 10)).toEqual([
      { startTimeSeconds: 0, endTimeSeconds: 2.7, text: "Hello world!" },
      { startTimeSeconds: 3, endTimeSeconds: 5, text: "Café & tea." },
    ]);
  });

  it("preserves repeated speech when cues do not overlap", () => {
    const source = JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "Again." }] },
      { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: "Again." }] },
    ] });
    expect(parseJson3Captions(source, 10)).toHaveLength(2);
  });

  it("handles VTT cue IDs, hour times, settings, multiline text, and metadata blocks", () => {
    const source = "WEBVTT\n\nNOTE source\nignore\n\nSTYLE\n::cue { color: red }\n\ncue-1\n01:00:01.000 --> 01:00:03.000 align:start\n<b>Hello</b>\nworld &amp; friends.\n\n";
    expect(parseVttCaptions(source, 3_605)).toEqual([
      { startTimeSeconds: 3_601, endTimeSeconds: 3_603, text: "Hello world & friends." },
    ]);
  });

  it("rejects malformed, oversized, and out-of-duration cues", () => {
    expect(() => parseJson3Captions("{}", null)).toThrow();
    expect(() => parseJson3Captions(JSON.stringify({ events: [{ tStartMs: 19000, dDurationMs: 1000, segs: [{ utf8: "Late" }] }] }), 5)).toThrow();
    expect(() => parseVttCaptions("WEBVTT\n\n00:02.000 --> 00:01.000\nBackwards", null)).toThrow();
    expect(() => parseVttCaptions(`WEBVTT\n\n${"x".repeat(2_000_001)}`, null)).toThrow();
  });
});
