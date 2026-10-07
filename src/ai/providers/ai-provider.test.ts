import { describe, expect, it } from "vitest";
import { exerciseBatchTransportSchema } from "@/ai/exercise-generation-contract";
import { FOCUS_EXERCISE_DISTRIBUTION } from "@/ai/prompts/generation-policy";
import { MockTranscriptProvider } from "@/services/transcript/mock-transcript-provider";
import {
  AIProviderError,
  AI_PROVIDER_FAILURE_KINDS,
  isAIProviderError,
} from "./ai-provider";
import { MockAIProvider } from "./mock-ai-provider";

describe("AI provider contract", () => {
  it("recognizes safe provider errors across module identities", () => {
    const local = new AIProviderError("rate-limit", { status: 429, requestId: "req-123" });
    const reloaded = {
      name: "AIProviderError",
      message: local.message,
      kind: "rate-limit",
      status: 429,
      requestId: "req-123",
    };
    expect(isAIProviderError(local)).toBe(true);
    expect(isAIProviderError(reloaded)).toBe(true);
    expect(isAIProviderError({ ...reloaded, kind: "secret-error" })).toBe(false);
    expect(isAIProviderError({ ...reloaded, status: 999 })).toBe(false);
    expect(isAIProviderError({ ...reloaded, requestId: "unsafe\nrequest" })).toBe(false);
    expect(isAIProviderError(new Error("upstream body"))).toBe(false);
  });

  it("keeps error metadata bounded and excludes arbitrary input fields", () => {
    const error = new AIProviderError("upstream", {
      status: 700,
      requestId: "unsafe request id",
      rawBody: "must not be retained",
    } as never);
    expect(error).toMatchObject({
      name: "AIProviderError",
      message: "AI provider request failed.",
      kind: "upstream",
      status: null,
      requestId: null,
    });
    expect(JSON.stringify(error)).not.toContain("must not be retained");
    expect(AI_PROVIDER_FAILURE_KINDS).toHaveLength(7);
  });

  it("publishes deterministic mock limits and the exact focus distribution", () => {
    const provider = new MockAIProvider();
    expect(provider.cacheIdentity).toBe("mock:linguatube-mock-v3");
    expect(provider.maxConcurrency).toBe(32);
    expect(FOCUS_EXERCISE_DISTRIBUTION).toEqual({
      comprehensive: { "multiple-choice": 10, "fill-blank": 8, translation: 8, listening: 8, dictation: 8 },
      speaking: { "multiple-choice": 10, "fill-blank": 8, translation: 10, listening: 5, dictation: 5 },
      listening: { "multiple-choice": 10, "fill-blank": 5, translation: 5, listening: 10, dictation: 10 },
      grammar: { "multiple-choice": 10, "fill-blank": 10, translation: 5, listening: 5, dictation: 5 },
    });
  });

  it.each(["multiple-choice", "fill-blank", "translation", "listening", "dictation"] as const)(
    "returns an exact %s batch in the strict wire shape",
    async (type) => {
      const provider = new MockAIProvider();
      const transcript = await new MockTranscriptProvider().fetchTranscript({
        videoId: "video-1",
        youtubeVideoId: "dQw4w9WgXcQ",
        learningLanguage: "en",
        nativeLanguage: "vi",
      });
      const count = type === "multiple-choice" ? 10 : 5;
      const schema = exerciseBatchTransportSchema(type, count);
      const output = await provider.generateStructured({
        schema,
        promptVersion: "mock-provider-contract-test",
        input: {
          kind: "exercises",
          processingKey: "processing",
          generationId: "generation",
          youtubeVideoId: "dQw4w9WgXcQ",
          lessonId: "lesson-1",
          learningLanguage: "en",
          nativeLanguage: "vi",
          targetLevel: { system: "CEFR", value: "B1" },
          learningFocus: "comprehensive",
          transcript: transcript.segments,
          batch: { type, count },
        },
      });
      const parsed = schema.parse(output);
      expect(Object.keys(parsed)).toEqual(["exercises"]);
      expect(parsed.exercises).toHaveLength(count);
      expect(parsed.exercises.every((exercise) => exercise.type === type)).toBe(true);
      expect(new Set(parsed.exercises.map((exercise) => exercise.id)).size).toBe(count);
    },
  );
});
