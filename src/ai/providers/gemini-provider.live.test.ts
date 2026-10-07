import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_ENDPOINT_ORIGIN,
  GEMINI_STRATEGY_VERSION,
  GeminiProvider,
} from "./gemini-provider";

const liveSmokeEnabled = process.env.GEMINI_LIVE_SMOKE === "1"
  && Boolean(process.env.GEMINI_API_KEY?.trim());
const liveIt = liveSmokeEnabled ? it : it.skip;
const configuredModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const LIVE_SMOKE_TIMEOUT_MS = 60_000;

const resultSchema = z.object({ terms: z.array(z.string().trim().min(1).max(40)).max(1) });

describe("Gemini live smoke", () => {
  liveIt(`validates one structured call with ${configuredModel}`, async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("Gemini live smoke configuration is missing.");

    let observedEndpoint = false;
    let observedSchema = false;
    const forwardingFetch: typeof fetch = async (input, init) => {
      observedEndpoint = String(input) ===
        `${GEMINI_ENDPOINT_ORIGIN}/v1beta/models/${configuredModel}:generateContent`;
      if (typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as {
            generationConfig?: { responseMimeType?: unknown; responseJsonSchema?: unknown };
          };
          observedSchema = body.generationConfig?.responseMimeType === "application/json"
            && typeof body.generationConfig.responseJsonSchema === "object";
        } catch {
          // Provider validation owns the request; this smoke never logs request content.
        }
      }
      return globalThis.fetch(input, init);
    };
    const provider = new GeminiProvider({ apiKey, model: configuredModel, fetchImpl: forwardingFetch });
    const generateStructured = vi.spyOn(provider, "generateStructured");
    const result = await provider.generateStructured({
      schema: resultSchema,
      promptVersion: "linguatube-gemini-live-smoke-v1",
      input: {
        kind: "vocabulary",
        processingKey: "gemini-live-smoke",
        generationId: "gemini-live-smoke",
        youtubeVideoId: "smoketest01",
        lessonId: "gemini-live-smoke",
        learningLanguage: "en",
        nativeLanguage: "vi",
        targetLevel: { system: "CEFR", value: "A1" },
        learningFocus: "comprehensive",
        chunk: {
          id: "smoke-chunk",
          startTimeSeconds: 0,
          endTimeSeconds: 1,
          segments: [{
            id: "smoke-segment",
            videoId: "gemini-live-smoke",
            startTimeSeconds: 0,
            endTimeSeconds: 1,
            text: "Hello.",
            translation: "Xin chào.",
          }],
        },
      },
    });

    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(resultSchema.safeParse(result).success).toBe(true);
    expect(provider.cacheIdentity).toBe(
      `gemini:${configuredModel}:${GEMINI_STRATEGY_VERSION}`,
    );
    expect(provider.maxConcurrency).toBe(1);
    expect(observedEndpoint).toBe(true);
    expect(observedSchema).toBe(true);
  }, LIVE_SMOKE_TIMEOUT_MS);
});
