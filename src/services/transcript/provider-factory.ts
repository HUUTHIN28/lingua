import type { TranscriptProvider } from "./transcript-provider";
import { MockTranscriptProvider } from "./mock-transcript-provider";
import { YoutubeTranscriptProvider } from "./youtube-transcript-provider";

export function createTranscriptProvider(
  providerName = process.env.TRANSCRIPT_PROVIDER ?? "youtube",
): TranscriptProvider {
  if (providerName === "mock") return new MockTranscriptProvider();
  if (providerName === "youtube") return new YoutubeTranscriptProvider({
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL,
    timeoutMs: process.env.GEMINI_VIDEO_TIMEOUT_MS ? Number(process.env.GEMINI_VIDEO_TIMEOUT_MS) : undefined,
  });
  throw new Error(`Transcript provider không được hỗ trợ: ${providerName}`);
}
