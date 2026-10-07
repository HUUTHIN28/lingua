import type { TranscriptProvenance, TranscriptSegment, TranscriptSource } from "@/domain/transcript";

export const MOCK_TRANSCRIPT_VERSION = "mock-transcript-v1";

export type TranscriptRequest = {
  videoId: string;
  youtubeVideoId: string;
  learningLanguage: string;
  nativeLanguage: string;
};

export type TranscriptFetchResult = {
  segments: TranscriptSegment[];
  provenance: TranscriptProvenance;
};

export interface TranscriptProvider {
  readonly version: string;
  readonly sourceKind: TranscriptSource;
  fetchTranscript(request: TranscriptRequest): Promise<TranscriptFetchResult>;
}
