import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { YoutubeTranscriptProvider } from "./youtube-transcript-provider";
import { GeminiVideoTranscriptProvider } from "./gemini-video-transcript-provider";
import { discoverYoutubeCaptions } from "./yt-dlp-caption-provider";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { LearningGenerationPipeline } from "@/ai/pipeline/learning-generation-pipeline";
import type { YouTubeVideo } from "@/domain/video";
import { transcriptProvenanceSchema } from "@/domain/transcript";
import type { TranscriptProvider } from "./transcript-provider";

loadEnvConfig(process.cwd());
const localEnv = process.env.RUN_LIVE_TRANSCRIPT === "1" || process.env.RUN_LIVE_CLIP === "1" || process.env.RUN_LIVE_LESSON === "1" || process.env.RUN_LIVE_GEMINI_ONLY === "1"
  ? readFileSync(join(process.cwd(), ".env.local"), "utf8") : "";
const localValue = (name: string) => localEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim().replace(/^['"]|['"]$/g, "");

describe("live real transcript", () => {
  it.skipIf(process.env.RUN_LIVE_GEMINI_ONLY !== "1")("generates a lesson from all verified Gemini fallback windows", async () => {
    // 706 seconds was verified previously by a successful yt-dlp metadata fetch for this exact video.
    const provider = new GeminiVideoTranscriptProvider({ apiKey: process.env.GEMINI_API_KEY ?? localValue("GEMINI_API_KEY") ?? "", model: process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL") });
    const output = await provider.transcribe({ videoId: "live-target", youtubeVideoId: "NZxK3oIxI3Y", learningLanguage: "en", nativeLanguage: "vi" }, 706);
    const metadata = {
      verifiedDurationSeconds: 706,
      source: "gemini-video",
      segmentCount: output.cues.length,
      firstSpeechSeconds: output.cues[0]?.startTimeSeconds,
      lastSpeechSeconds: output.cues.at(-1)?.endTimeSeconds,
      translatedCount: output.cues.filter((cue) => cue.translation.trim()).length,
      attemptedRanges: output.attemptedRanges.length,
      attemptedEndSeconds: output.attemptedRanges.at(-1)?.endTimeSeconds,
    };
    writeFileSync(join(process.cwd(), ".understand-code", "runs", "run-20261006-095845Z", "live-transcript-metadata.json"), JSON.stringify(metadata, null, 2));
    expect(metadata.segmentCount).toBeGreaterThan(8);
    expect(metadata.translatedCount).toBe(metadata.segmentCount);
    expect(metadata.attemptedEndSeconds).toBe(706);
    const transcriptProvider: TranscriptProvider = {
      sourceKind: "youtube", version: "live-verified-gemini-video",
      async fetchTranscript(request) {
        return {
          segments: output.cues.map((cue, index) => ({ id: `segment-${index + 1}`, videoId: request.videoId, ...cue })),
          provenance: transcriptProvenanceSchema.parse({
            kind: "gemini-video", sourceLanguage: "en", captionFormat: null, translationKind: "gemini",
            nativeLanguage: "vi", model: process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL") ?? "gemini-3.1-flash-lite",
            strategyVersion: "live-verified-gemini-video", durationSeconds: 706,
            coverage: { attemptedRanges: output.attemptedRanges, firstSpeechSeconds: output.cues[0].startTimeSeconds, lastSpeechSeconds: output.cues.at(-1)!.endTimeSeconds, method: "gemini-estimated" },
          }),
        };
      },
    };
    const video: YouTubeVideo = {
      id: "live-video", youtubeVideoId: "NZxK3oIxI3Y", youtubeUrl: "https://www.youtube.com/watch?v=NZxK3oIxI3Y",
      title: "Live video", description: null, thumbnailUrl: null, durationSeconds: null,
      detectedLanguage: "en", learningLanguage: "en", nativeLanguage: "vi", targetLevel: null,
      learningFocus: "comprehensive", lessonId: null, status: "pending", processingProgress: 0,
      errorMessage: null, createdAt: "2026-10-07T00:00:00.000Z", updatedAt: "2026-10-07T00:00:00.000Z",
    };
    const pipeline = new LearningGenerationPipeline(transcriptProvider, new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY ?? localValue("GEMINI_API_KEY") ?? "",
      model: process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL"), timeoutMs: 120_000,
    }));
    const lessonResult = await pipeline.generateLesson({ video, processingKey: "live-real-v1", lessonId: "live-lesson", generationId: "live-job", onStage: async () => undefined });
    const lesson = lessonResult.lesson;
    const lessonMetadata = { ...metadata, vocabularyCount: lesson.vocabulary.length, grammarCount: lesson.grammar.length, sectionCount: lesson.sections.length, exerciseCount: lesson.exercises.length };
    writeFileSync(join(process.cwd(), ".understand-code", "runs", "run-20261006-095845Z", "live-lesson-metadata.json"), JSON.stringify(lessonMetadata, null, 2));
    expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(12);
    expect(lesson.grammar.length).toBeGreaterThanOrEqual(5);
    expect(lesson.exercises.length).toBe(42);
  }, 1_800_000);
  it.skipIf(process.env.RUN_LIVE_METADATA !== "1")("diagnoses yt-dlp metadata without exposing subtitles", async () => {
    try {
      const output = await discoverYoutubeCaptions("NZxK3oIxI3Y", "en");
      expect(output.durationSeconds).toBe(706);
      expect(output.result).toBeNull();
    } catch (error) {
      throw new Error(`yt-dlp metadata failed: ${error instanceof Error ? error.name + ":" + error.message.slice(0, 80) : "unknown"}`);
    }
  }, 120_000);
  it.skipIf(process.env.RUN_LIVE_CLIP !== "1")("checks a short speech clip without exposing transcript", async () => {
    const provider = new GeminiVideoTranscriptProvider({ apiKey: process.env.GEMINI_API_KEY ?? localValue("GEMINI_API_KEY") ?? "", model: process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL") });
    const output = await provider.transcribe({ videoId: "live-clip", youtubeVideoId: "NZxK3oIxI3Y", learningLanguage: "en", nativeLanguage: "vi" }, 118);
    console.log(JSON.stringify({ segments: output.cues.length, min: output.cues[0]?.startTimeSeconds, max: output.cues.at(-1)?.endTimeSeconds }));
    expect(output.cues.length).toBeGreaterThan(0);
  }, 120_000);
  it.skipIf(process.env.RUN_LIVE_TRANSCRIPT !== "1")("retrieves full target video through yt-dlp then Gemini", async () => {
    const provider = new YoutubeTranscriptProvider({
      apiKey: process.env.GEMINI_API_KEY ?? localValue("GEMINI_API_KEY") ?? "",
      model: process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL"),
      timeoutMs: 180_000,
      fetchImpl: async (input, init) => {
        const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) as { contents?: Array<{ parts?: Array<{ videoMetadata?: unknown }> }> } : null;
        const response = await fetch(input, init);
        const body = await response.clone().json().catch(() => null) as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { candidatesTokenCount?: number } } | null;
        const payload = body?.candidates?.[0]?.content?.parts?.[0]?.text;
        let parsed: { segments?: Array<{ startTimeSeconds: number; endTimeSeconds: number }>; noSpeech?: boolean } | null = null;
        try { parsed = payload ? JSON.parse(payload) : null; } catch { /* metadata-only diagnostic */ }
        console.log(JSON.stringify({ status: response.status, requested: requestBody?.contents?.[0]?.parts?.[0]?.videoMetadata, finish: body?.candidates?.map((candidate) => candidate.finishReason), textLengths: body?.candidates?.map((candidate) => candidate.content?.parts?.map((part) => part.text?.length ?? 0)), outputTokens: body?.usageMetadata?.candidatesTokenCount, segments: parsed?.segments?.length, min: parsed?.segments?.[0]?.startTimeSeconds, max: parsed?.segments?.at(-1)?.endTimeSeconds }));
        return response;
      },
    });
    const result = await provider.fetchTranscript({
      videoId: "live-target",
      youtubeVideoId: "NZxK3oIxI3Y",
      learningLanguage: "en",
      nativeLanguage: "vi",
    });
    expect(result.provenance.kind).toBe("gemini-video");
    expect(result.provenance.durationSeconds).toBe(706);
    expect(result.provenance.coverage.attemptedRanges.at(-1)?.endTimeSeconds).toBe(706);
    expect(result.segments.length).toBeGreaterThan(8);
    expect(result.segments.every((segment) => segment.translation?.trim())).toBe(true);
    const span = [result.segments[0].startTimeSeconds, result.segments.at(-1)?.endTimeSeconds];
    console.log(JSON.stringify({ source: result.provenance.kind, duration: result.provenance.durationSeconds, segmentCount: result.segments.length, span, translatedCount: result.segments.filter((segment) => segment.translation).length }));
  }, 1_200_000);

  it.skipIf(process.env.RUN_LIVE_LESSON !== "1")("generates a complete grounded lesson from the real video", async () => {
    const apiKey = process.env.GEMINI_API_KEY ?? localValue("GEMINI_API_KEY") ?? "";
    const model = process.env.GEMINI_MODEL ?? localValue("GEMINI_MODEL");
    const transcriptProvider = new YoutubeTranscriptProvider({ apiKey, model });
    const aiProvider = new GeminiProvider({ apiKey, model, timeoutMs: 120_000 });
    const video: YouTubeVideo = {
      id: "live-video", youtubeVideoId: "NZxK3oIxI3Y", youtubeUrl: "https://www.youtube.com/watch?v=NZxK3oIxI3Y",
      title: "Live video", description: null, thumbnailUrl: null, durationSeconds: null,
      detectedLanguage: "en", learningLanguage: "en", nativeLanguage: "vi", targetLevel: null,
      learningFocus: "comprehensive", lessonId: null, status: "pending", processingProgress: 0,
      errorMessage: null, createdAt: "2026-10-07T00:00:00.000Z", updatedAt: "2026-10-07T00:00:00.000Z",
    };
    const stages: string[] = [];
    const pipeline = new LearningGenerationPipeline(transcriptProvider, aiProvider);
    const result = await pipeline.generateLesson({
      video, processingKey: "live-real-v1", lessonId: "live-lesson", generationId: "live-job",
      onStage: async (stage) => { stages.push(stage); },
    });
    const lesson = result.lesson;
    const metadata = {
      source: lesson.transcriptProvenance.kind,
      duration: lesson.transcriptProvenance.durationSeconds,
      attemptedRanges: lesson.transcriptProvenance.coverage.attemptedRanges.length,
      segments: lesson.transcript.length,
      firstSpeech: lesson.transcript[0]?.startTimeSeconds,
      lastSpeech: lesson.transcript.at(-1)?.endTimeSeconds,
      translated: lesson.transcript.filter((segment) => segment.translation?.trim()).length,
      vocabulary: lesson.vocabulary.length,
      grammar: lesson.grammar.length,
      sections: lesson.sections.length,
      exercises: lesson.exercises.length,
      stages,
    };
    writeFileSync(join(process.cwd(), ".understand-code", "runs", "run-20261006-095845Z", "live-metadata.json"), JSON.stringify(metadata, null, 2));
    expect(metadata.source).toBe("gemini-video");
    expect(metadata.duration).toBe(706);
    expect(metadata.segments).toBeGreaterThan(8);
    expect(metadata.translated).toBe(metadata.segments);
    expect(metadata.vocabulary).toBeGreaterThanOrEqual(12);
    expect(metadata.grammar).toBeGreaterThanOrEqual(5);
    expect(metadata.exercises).toBe(42);
  }, 1_800_000);
});
