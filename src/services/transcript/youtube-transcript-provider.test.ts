import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  discover: vi.fn(), transcribe: vi.fn(), translate: vi.fn(), readDuration: vi.fn(), saveDuration: vi.fn(),
}));
vi.mock("./yt-dlp-caption-provider", () => ({ discoverYoutubeCaptions: mocks.discover }));
vi.mock("./yt-dlp-runner", () => ({ YT_DLP_STRATEGY_VERSION: "test-yt", getYtDlpVersion: async () => "2026.08.19" }));
vi.mock("./trusted-duration-cache", () => ({ readTrustedDuration: mocks.readDuration, saveTrustedDuration: mocks.saveDuration }));
vi.mock("./gemini-video-transcript-provider", () => ({
  GEMINI_VIDEO_STRATEGY_VERSION: "test-video", GEMINI_TRANSLATION_VERSION: "test-translation",
  GeminiVideoTranscriptProvider: class {
    model = "gemini-test";
    transcribe = mocks.transcribe;
    translateCaptions = mocks.translate;
  },
}));

import { YoutubeTranscriptProvider } from "./youtube-transcript-provider";
import { ApplicationError } from "@/services/learning/errors";

const request = { videoId: "video-1", youtubeVideoId: "NZxK3oIxI3Y", learningLanguage: "en", nativeLanguage: "vi" };
const cue = { startTimeSeconds: 1, endTimeSeconds: 3, text: "Good morning." };

describe("real transcript strategy order", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.readDuration.mockResolvedValue(null);
    mocks.saveDuration.mockResolvedValue(undefined);
  });

  it("uses creator captions and translates each source segment without video transcription", async () => {
    mocks.discover.mockResolvedValue({ durationSeconds: 706, result: { cues: [cue], kind: "youtube-manual-captions", format: "json3", durationSeconds: 706 } });
    mocks.translate.mockResolvedValue(new Map([["segment-1", "Chào buổi sáng."]]));
    const output = await new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request);
    expect(output.provenance.kind).toBe("youtube-manual-captions");
    expect(output.segments[0].translation).toBe("Chào buổi sáng.");
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    expect(mocks.transcribe).not.toHaveBeenCalled();
    expect(mocks.saveDuration).toHaveBeenCalledWith(request.youtubeVideoId, 706);
  });

  it("retains automatic-caption provenance", async () => {
    mocks.discover.mockResolvedValue({ durationSeconds: 706, result: { cues: [cue], kind: "youtube-auto-captions", format: "vtt", durationSeconds: 706 } });
    mocks.translate.mockResolvedValue(new Map([["segment-1", "Chào buổi sáng."]]));
    const output = await new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request);
    expect(output.provenance.kind).toBe("youtube-auto-captions");
    expect(output.provenance.captionFormat).toBe("vtt");
  });

  it("calls yt-dlp first and then Gemini when no caption exists", async () => {
    const order: string[] = [];
    mocks.discover.mockImplementation(async () => { order.push("yt-dlp"); return { durationSeconds: 706, result: null }; });
    mocks.transcribe.mockImplementation(async () => {
      order.push("gemini");
      return { cues: [{ ...cue, translation: "Chào buổi sáng." }], durationSeconds: 706, attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 706 }] };
    });
    const output = await new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request);
    expect(order).toEqual(["yt-dlp", "gemini"]);
    expect(output.provenance.kind).toBe("gemini-video");
    expect(output.provenance.coverage.method).toBe("gemini-estimated");
  });

  it("uses only a verified cached duration after yt-dlp network failure", async () => {
    mocks.discover.mockRejectedValue(new Error("network unavailable"));
    mocks.readDuration.mockResolvedValue(706);
    mocks.transcribe.mockResolvedValue({ cues: [{ ...cue, translation: "Chào buổi sáng." }], durationSeconds: 706, attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 706 }] });
    const output = await new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request);
    expect(mocks.discover).toHaveBeenCalledTimes(3);
    expect(mocks.transcribe).toHaveBeenCalledWith(request, 706);
    expect(output.provenance.kind).toBe("gemini-video");
  });

  it("fails visibly when neither real strategy can complete", async () => {
    mocks.discover.mockResolvedValue({ durationSeconds: 706, result: null });
    mocks.transcribe.mockRejectedValue(new ApplicationError("TRANSCRIPT_UNAVAILABLE", "Gemini unavailable", 422));
    await expect(new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
  });

  it("fails before calling Gemini when yt-dlp and cache have no verified duration", async () => {
    mocks.discover.mockResolvedValue({ durationSeconds: null, result: null });
    await expect(new YoutubeTranscriptProvider({ apiKey: "test" }).fetchTranscript(request)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    expect(mocks.readDuration).toHaveBeenCalledWith(request.youtubeVideoId);
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });
});
