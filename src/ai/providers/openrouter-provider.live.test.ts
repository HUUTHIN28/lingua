import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_STRATEGY_VERSION,
  OpenRouterProvider,
} from "./openrouter-provider";
import { parseOpenRouterFallbackModels } from "./provider-factory";

const liveFlagEnabled = process.env.OPENROUTER_LIVE_SMOKE === "1";
const liveSmokeEnabled = liveFlagEnabled && Boolean(process.env.OPENROUTER_API_KEY?.trim());
const configuredModel = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
const configuredFallbackModels = parseOpenRouterFallbackModels(
  process.env.OPENROUTER_FALLBACK_MODELS,
) ?? [];
const configuredModelChain = [configuredModel, ...configuredFallbackModels];
const liveIt = liveSmokeEnabled ? it : it.skip;
const LIVE_SMOKE_TIMEOUT_MS = 60_000;

const smokeResultSchema = z.object({
  terms: z.array(z.string().trim().min(1).max(40)).max(1),
});

const observedRequestSchema = z.object({
  model: z.string().optional(),
  models: z.array(z.string()).optional(),
  response_format: z
    .object({
      type: z.literal("json_schema"),
    })
    .optional(),
});

describe("OpenRouter live smoke", () => {
  liveIt(`validates one structured call with ${configuredModel}`, async () => {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("OpenRouter live smoke configuration is missing.");

    let observedConfiguredModel = false;
    let observedNativeSchema = false;
    const forwardingFetch: typeof fetch = async (input, init) => {
      if (typeof init?.body === "string") {
        try {
          const observed = observedRequestSchema.safeParse(JSON.parse(init.body));
          if (observed.success) {
            observedConfiguredModel ||= configuredFallbackModels.length > 0
              ? JSON.stringify(observed.data.models) === JSON.stringify(configuredModelChain)
              : observed.data.model === configuredModel && observed.data.models === undefined;
            observedNativeSchema ||= observed.data.response_format?.type === "json_schema";
          }
        } catch {
          // The provider owns request validation; the smoke never logs request content.
        }
      }
      return globalThis.fetch(input, init);
    };

    const provider = new OpenRouterProvider({
      apiKey,
      model: configuredModel,
      fallbackModels: configuredFallbackModels,
      fetchImpl: forwardingFetch,
    });
    const generateStructured = vi.spyOn(provider, "generateStructured");

    const result = await provider.generateStructured({
      schema: smokeResultSchema,
      promptVersion: "linguatube-openrouter-live-smoke-v1",
      input: {
        kind: "vocabulary",
        processingKey: "openrouter-live-smoke",
        generationId: "openrouter-live-smoke",
        youtubeVideoId: "smoketest01",
        lessonId: "openrouter-live-smoke",
        learningLanguage: "en",
        nativeLanguage: "vi",
        targetLevel: { system: "CEFR", value: "A1" },
        learningFocus: "comprehensive",
        chunk: {
          id: "smoke-chunk",
          startTimeSeconds: 0,
          endTimeSeconds: 1,
          segments: [
            {
              id: "smoke-segment",
              videoId: "openrouter-live-smoke",
              startTimeSeconds: 0,
              endTimeSeconds: 1,
              text: "Hello.",
              translation: "Xin chào.",
            },
          ],
        },
      },
    });

    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(smokeResultSchema.safeParse(result).success).toBe(true);
    expect(provider.cacheIdentity).toBe(
      `openrouter:${configuredModelChain.join(">")}:${OPENROUTER_STRATEGY_VERSION}`,
    );
    expect(provider.maxConcurrency).toBe(1);
    expect(observedConfiguredModel).toBe(true);
    expect(observedNativeSchema).toBe(true);
  }, LIVE_SMOKE_TIMEOUT_MS);
});
