import { describe, expect, it, vi } from "vitest";
import { GeminiVideoTranscriptProvider } from "./gemini-video-transcript-provider";

const request = { videoId: "video-1", youtubeVideoId: "NZxK3oIxI3Y", learningLanguage: "en", nativeLanguage: "vi" };
const envelope = (payload: unknown, finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(payload) }] } }],
}), { status: 200, headers: { "content-type": "application/json" } });

describe("Gemini video transcript adapter", () => {
  it("sends a canonical public video URI with a bounded clip and keeps key server-side", async () => {
    const fetchImpl = vi.fn(async () => envelope({ noSpeech: false, segments: [{ startTimeSeconds: 1, endTimeSeconds: 3, text: "Hello.", translation: "Xin chào." }] }));
    const provider = new GeminiVideoTranscriptProvider({ apiKey: "private-test-key", model: "gemini-test", fetchImpl: fetchImpl as typeof fetch });
    const output = await provider.transcribe(request, 60);
    expect(output.cues).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toContain("gemini-test:generateContent");
    expect(body.contents[0].parts[0]).toEqual({
      file_data: { file_uri: "https://www.youtube.com/watch?v=NZxK3oIxI3Y" },
      videoMetadata: { startOffset: "0s", endOffset: "60s" },
    });
    expect(JSON.stringify(body)).not.toContain("private-test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("private-test-key");
  });

  it("rejects out-of-window or incomplete model timestamps", async () => {
    const provider = new GeminiVideoTranscriptProvider({ apiKey: "test", fetchImpl: vi.fn(async () => envelope({ noSpeech: false, segments: [{ startTimeSeconds: 90, endTimeSeconds: 95, text: "Wrong time", translation: "Sai thời gian" }] })) as typeof fetch });
    await expect(provider.transcribe(request, 60)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
  });

  it("rejects recitation blocks without using an incomplete response", async () => {
    const provider = new GeminiVideoTranscriptProvider({ apiKey: "test", fetchImpl: vi.fn(async () => envelope({ noSpeech: false, segments: [] }, "RECITATION")) as typeof fetch });
    await expect(provider.transcribe(request, 60)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
  });

  it("times out a stalled response body and returns a safe error after one retry", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            signal.addEventListener("abort", () => controller.error(new DOMException("body aborted", "AbortError")), { once: true });
          },
        });
        return new Response(stream, { status: 200 });
      });
      const provider = new GeminiVideoTranscriptProvider({ apiKey: "test", timeoutMs: 10_000, fetchImpl: fetchImpl as typeof fetch });
      const result = expect(provider.transcribe(request, 60)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
      await vi.advanceTimersByTimeAsync(20_000);
      await result;
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to transcribe without a verified duration", async () => {
    const fetchImpl = vi.fn();
    const provider = new GeminiVideoTranscriptProvider({ apiKey: "test", fetchImpl: fetchImpl as typeof fetch });
    await expect(provider.transcribe(request, null as unknown as number)).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires exact translation IDs and retries only the failed batch", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return envelope({ translations: [{ id: calls === 1 ? "invented" : "segment-1", translation: "Xin chào." }] });
    });
    const provider = new GeminiVideoTranscriptProvider({ apiKey: "test", fetchImpl: fetchImpl as typeof fetch });
    const result = await provider.translateCaptions([{ id: "segment-1", startTimeSeconds: 0, endTimeSeconds: 2, text: "Hello." }], request);
    expect(result.get("segment-1")).toBe("Xin chào.");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
