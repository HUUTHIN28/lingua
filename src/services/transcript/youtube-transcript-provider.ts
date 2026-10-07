import type { TranscriptProvider, TranscriptRequest, TranscriptFetchResult } from "./transcript-provider";
import { discoverYoutubeCaptions } from "./yt-dlp-caption-provider";
import { GeminiVideoTranscriptProvider, GEMINI_TRANSLATION_VERSION, GEMINI_VIDEO_STRATEGY_VERSION } from "./gemini-video-transcript-provider";
import { YT_DLP_STRATEGY_VERSION, getYtDlpVersion } from "./yt-dlp-runner";
import { transcriptProvenanceSchema, transcriptSegmentSchema, type TranscriptSegment } from "@/domain/transcript";
import { ApplicationError } from "@/services/learning/errors";
import { readTrustedDuration, saveTrustedDuration } from "./trusted-duration-cache";

export const YOUTUBE_TRANSCRIPT_VERSION = `youtube-real-v2:${YT_DLP_STRATEGY_VERSION}:${GEMINI_VIDEO_STRATEGY_VERSION}:${GEMINI_TRANSLATION_VERSION}`;

export class YoutubeTranscriptProvider implements TranscriptProvider {
  readonly sourceKind = "youtube" as const;
  readonly version: string;
  readonly #gemini: GeminiVideoTranscriptProvider;

  constructor(options: { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch }) {
    this.#gemini = new GeminiVideoTranscriptProvider(options);
    this.version = `${YOUTUBE_TRANSCRIPT_VERSION}:${this.#gemini.model}`;
  }

  async fetchTranscript(request: TranscriptRequest): Promise<TranscriptFetchResult> {
    let caption: Awaited<ReturnType<typeof discoverYoutubeCaptions>> | null = null;
    for (let attempt = 0; attempt < 3 && caption === null; attempt += 1) {
      try {
        // Mandatory first strategy: yt-dlp metadata and subtitle retrieval.
        caption = await discoverYoutubeCaptions(request.youtubeVideoId, request.learningLanguage);
      } catch {
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1_000));
        // A broken executable or unavailable YouTube extractor still permits real Gemini video transcription.
      }
    }
    if (caption?.durationSeconds) {
      await saveTrustedDuration(request.youtubeVideoId, caption.durationSeconds).catch(() => undefined);
    }
    const ytDlpVersion = await getYtDlpVersion();
    if (caption?.result) {
      const result = caption.result;
      const withIds = result.cues.map((cue, index) => ({ ...cue, id: `segment-${index + 1}` }));
      const translations = await this.#gemini.translateCaptions(withIds, request);
      const segments = withIds.map((cue): TranscriptSegment => transcriptSegmentSchema.parse({
        id: cue.id,
        videoId: request.videoId,
        startTimeSeconds: cue.startTimeSeconds,
        endTimeSeconds: cue.endTimeSeconds,
        text: cue.text,
        translation: translations.get(cue.id),
      }));
      const lastSpeech = segments.at(-1)?.endTimeSeconds ?? 0;
      const durationSeconds = result.durationSeconds ?? lastSpeech;
      return {
        segments,
        provenance: transcriptProvenanceSchema.parse({
          kind: result.kind,
          sourceLanguage: request.learningLanguage,
          captionFormat: result.format,
          translationKind: request.learningLanguage === request.nativeLanguage ? "source" : "gemini",
          nativeLanguage: request.nativeLanguage,
          model: request.learningLanguage === request.nativeLanguage ? null : this.#gemini.model,
          strategyVersion: `${this.version}:yt-dlp-${ytDlpVersion}`,
          durationSeconds,
          coverage: {
            attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: durationSeconds }],
            firstSpeechSeconds: segments[0].startTimeSeconds,
            lastSpeechSeconds: lastSpeech,
            method: "caption-timestamps",
          },
        }),
      };
    }
    let videoResult: Awaited<ReturnType<GeminiVideoTranscriptProvider["transcribe"]>>;
    try {
      const durationSeconds = caption?.durationSeconds ?? await readTrustedDuration(request.youtubeVideoId);
      if (durationSeconds === null) {
        throw new ApplicationError("TRANSCRIPT_UNAVAILABLE", "Không xác định được thời lượng video để xác minh transcript đầy đủ. Vui lòng thử lại khi YouTube truy cập được.", 422);
      }
      videoResult = await this.#gemini.transcribe(request, durationSeconds);
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError("TRANSCRIPT_UNAVAILABLE", "Không lấy được phụ đề YouTube và Gemini không phiên âm được video. Vui lòng thử lại.", 422);
    }
    const segments = videoResult.cues.map((cue, index): TranscriptSegment => transcriptSegmentSchema.parse({
      id: `segment-${index + 1}`,
      videoId: request.videoId,
      startTimeSeconds: cue.startTimeSeconds,
      endTimeSeconds: cue.endTimeSeconds,
      text: cue.text,
      translation: cue.translation,
    }));
    return {
      segments,
      provenance: transcriptProvenanceSchema.parse({
        kind: "gemini-video",
        sourceLanguage: request.learningLanguage,
        captionFormat: null,
        translationKind: "gemini",
        nativeLanguage: request.nativeLanguage,
        model: this.#gemini.model,
        strategyVersion: `${this.version}:yt-dlp-${ytDlpVersion}`,
        durationSeconds: videoResult.durationSeconds,
        coverage: {
          attemptedRanges: videoResult.attemptedRanges,
          firstSpeechSeconds: segments[0].startTimeSeconds,
          lastSpeechSeconds: segments.at(-1)!.endTimeSeconds,
          method: "gemini-estimated",
        },
      }),
    };
  }
}
