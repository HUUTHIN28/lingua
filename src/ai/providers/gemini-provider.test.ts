import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { exerciseBatchTransportSchema } from "@/ai/exercise-generation-contract";
import type { StructuredGenerationRequest } from "./ai-provider";
import { isAIProviderError } from "./ai-provider";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_ENDPOINT_ORIGIN,
  GEMINI_STRATEGY_VERSION,
  GeminiProvider,
} from "./gemini-provider";

const TEST_CREDENTIAL = "gemini-test-only-credential";
const PRIVATE_TRANSCRIPT = "PRIVATE_TRANSCRIPT_SENTINEL";

const request: StructuredGenerationRequest<{ answer: string }> = {
  schema: z.object({ answer: z.string() }),
  promptVersion: "test-prompt-v1",
  input: {
    kind: "vocabulary",
    processingKey: "private-processing-key",
    generationId: "generation-1",
    youtubeVideoId: "youtube-1",
    lessonId: "lesson-1",
    learningLanguage: "en",
    nativeLanguage: "vi",
    targetLevel: { system: "CEFR", value: "B1" },
    learningFocus: "comprehensive",
    chunk: {
      id: "chunk-1",
      startTimeSeconds: 0,
      endTimeSeconds: 2,
      segments: [{
        id: "segment-1",
        videoId: "video-1",
        startTimeSeconds: 0,
        endTimeSeconds: 2,
        text: PRIVATE_TRANSCRIPT,
        translation: "Bản dịch",
      }],
    },
  },
};

const exerciseRequest: StructuredGenerationRequest<unknown> = {
  schema: exerciseBatchTransportSchema("translation", 8),
  promptVersion: "test-prompt-v1",
  input: {
    kind: "exercises",
    processingKey: "private-processing-key",
    generationId: "generation-1",
    youtubeVideoId: "youtube-1",
    lessonId: "lesson-1",
    learningLanguage: "en",
    nativeLanguage: "vi",
    targetLevel: { system: "CEFR", value: "B1" },
    learningFocus: "comprehensive",
    transcript: request.input.kind === "vocabulary" ? request.input.chunk.segments : [],
    batch: { type: "translation", count: 8 },
  },
};

const hasKeyRecursively = (value: unknown, searchedKey: string): boolean => {
  if (Array.isArray(value)) return value.some((item) => hasKeyRecursively(item, searchedKey));
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Object.hasOwn(record, searchedKey)
    || Object.values(record).some((item) => hasKeyRecursively(item, searchedKey));
};

const collectSingleValueEnums = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((item) => collectSingleValueEnums(item));
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const own = Array.isArray(record.enum) && record.enum.length === 1 ? [record.enum[0]] : [];
  return [...own, ...Object.values(record).flatMap((item) => collectSingleValueEnums(item))];
};

const success = (value: unknown = { answer: "available" }, headers?: HeadersInit): Response =>
  new Response(JSON.stringify({
    candidates: [{
      content: { parts: [{ text: JSON.stringify(value) }], role: "model" },
      finishReason: "STOP",
    }],
  }), { status: 200, headers });

const errorResponse = (
  status: number,
  message = "RAW_GOOGLE_ERROR_SENTINEL",
  headers?: HeadersInit,
): Response => new Response(JSON.stringify({
  error: {
    code: status,
    status: status === 429 ? "RESOURCE_EXHAUSTED" : "INVALID_ARGUMENT",
    message,
  },
}), { status, headers });

const fetchMockWith = (...responses: Array<Response | Error>): ReturnType<typeof vi.fn> => vi.fn(
  async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected fetch call");
    if (next instanceof Response) return next;
    throw next;
  },
);

const providerWith = (
  fetchMock: ReturnType<typeof vi.fn>,
  overrides: Partial<ConstructorParameters<typeof GeminiProvider>[0]> = {},
) => new GeminiProvider({
  apiKey: TEST_CREDENTIAL,
  fetchImpl: fetchMock as typeof fetch,
  sleep: async () => undefined,
  random: () => 0,
  ...overrides,
});

const expectProviderFailure = async (
  promise: Promise<unknown>,
  kind: string,
  status: number | null,
): Promise<void> => {
  try {
    await promise;
    throw new Error("Expected provider failure");
  } catch (error) {
    expect(isAIProviderError(error)).toBe(true);
    expect(error).toMatchObject({
      name: "AIProviderError",
      message: "AI provider request failed.",
      kind,
      status,
    });
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(TEST_CREDENTIAL);
    expect(serialized).not.toContain(PRIVATE_TRANSCRIPT);
    expect(serialized).not.toContain("RAW_GOOGLE_ERROR_SENTINEL");
  }
};

describe("GeminiProvider", () => {
  it("sends the exact Developer API structured request and returns JSON", async () => {
    const fetchMock = fetchMockWith(success());
    const provider = providerWith(fetchMock, { model: "gemini-test-model" });

    await expect(provider.generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${GEMINI_ENDPOINT_ORIGIN}/v1beta/models/gemini-test-model:generateContent`,
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-goog-api-key")).toBe(TEST_CREDENTIAL);
    expect(headers.has("authorization")).toBe(false);

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: expect.stringContaining("structured language-learning") }] },
      contents: [{ role: "user", parts: [{ text: expect.stringContaining(PRIVATE_TRANSCRIPT) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { answer: { type: "string" } },
          required: ["answer"],
          additionalProperties: false,
        },
      },
    });
    expect((body.generationConfig as { responseJsonSchema: object }).responseJsonSchema)
      .not.toHaveProperty("$schema");
    expect(JSON.stringify(body)).not.toContain(TEST_CREDENTIAL);
    expect(provider.cacheIdentity).toBe(
      `gemini:gemini-test-model:${GEMINI_STRATEGY_VERSION}`,
    );
    expect(provider.cacheIdentity).not.toContain(TEST_CREDENTIAL);
    expect(provider.maxConcurrency).toBe(1);
  });

  it("adapts exercise literals for Gemini and gives only exercises the larger output budget", async () => {
    const fetchMock = fetchMockWith(success({}), success());
    const provider = providerWith(fetchMock);

    await expect(provider.generateStructured(exerciseRequest)).resolves.toEqual({});
    await expect(provider.generateStructured(request)).resolves.toEqual({ answer: "available" });

    const exerciseBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as {
      generationConfig: {
        maxOutputTokens: number;
        responseJsonSchema: Record<string, unknown>;
      };
    };
    const standardBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    ) as { generationConfig: { maxOutputTokens: number } };
    const schema = exerciseBody.generationConfig.responseJsonSchema;

    expect(exerciseBody.generationConfig.maxOutputTokens).toBe(8192);
    expect(standardBody.generationConfig.maxOutputTokens).toBe(4096);
    expect(schema).not.toHaveProperty("$schema");
    expect(hasKeyRecursively(schema, "const")).toBe(false);

    const literalValues = collectSingleValueEnums(schema);
    for (const literal of ["translation", "CEFR", "HSK", "JLPT"]) {
      expect(literalValues).toContain(literal);
    }
    expect(schema).toMatchObject({
      type: "object",
      required: ["exercises"],
      additionalProperties: false,
      properties: {
        exercises: { type: "array", minItems: 8, maxItems: 8 },
      },
    });
  });

  it("uses stable defaults and validates constructor input", () => {
    const provider = providerWith(vi.fn());
    expect(provider.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(provider.cacheIdentity).toBe(
      `gemini:${DEFAULT_GEMINI_MODEL}:${GEMINI_STRATEGY_VERSION}`,
    );
    expect(() => new GeminiProvider({ apiKey: " " })).toThrow("Gemini API key is required.");
    expect(() => providerWith(vi.fn(), { model: "models/gemini unsafe" }))
      .toThrow("Gemini model configuration is invalid.");
    expect(() => providerWith(vi.fn(), { timeoutMs: 999 }))
      .toThrow("Gemini timeout must be an integer between 1000 and 120000 milliseconds.");
    expect(() => providerWith(vi.fn(), { timeoutMs: 120_001 }))
      .toThrow("Gemini timeout must be an integer between 1000 and 120000 milliseconds.");
  });

  it("joins text parts from one complete candidate", async () => {
    const fetchMock = fetchMockWith(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "{\"answer\":" }, { text: "\"available\"}" }] },
        finishReason: "STOP",
      }],
    }), { status: 200 }));
    await expect(providerWith(fetchMock).generateStructured(request))
      .resolves.toEqual({ answer: "available" });
  });

  it.each([
    [{ candidates: [] }, "no candidate"],
    [{ promptFeedback: { blockReason: "SAFETY" }, candidates: [] }, "blocked prompt"],
    [{ candidates: [{ content: { parts: [{ text: "" }] }, finishReason: "STOP" }] }, "empty text"],
    [{ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "MAX_TOKENS" }] }, "truncated"],
    [{ candidates: [{ content: { parts: [{ inlineData: {} }] }, finishReason: "STOP" }] }, "non-text part"],
    [{ candidates: [{ content: { parts: [{ text: "not-json" }] }, finishReason: "STOP" }] }, "non-JSON"],
    [{ candidates: [{ content: { parts: [{ text: "{}" }] } }, { content: { parts: [{ text: "{}" }] } }] }, "ambiguous"],
  ])("rejects %s output as invalid-output (%s)", async (body, _description) => {
    void _description;
    const fetchMock = fetchMockWith(new Response(JSON.stringify(body), { status: 200 }));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "invalid-output", 200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [400, "capability"],
    [422, "capability"],
  ])("maps status %i without retrying", async (status, kind) => {
    const fetchMock = fetchMockWith(errorResponse(
      status,
      status === 400 || status === 422
        ? "responseJsonSchema structured output is unsupported"
        : undefined,
      { "x-goog-request-id": "safe-request-id" },
    ));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), kind, status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries one transient response using Retry-After then succeeds", async () => {
    const fetchMock = fetchMockWith(errorResponse(429, undefined, { "Retry-After": "1" }), success());
    const sleep = vi.fn(async () => undefined);
    await expect(providerWith(fetchMock, { sleep }).generateStructured(request))
      .resolves.toEqual({ answer: "available" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("maps a RESOURCE_EXHAUSTED envelope to rate-limit", async () => {
    const fetchMock = fetchMockWith(new Response(JSON.stringify({
      error: { code: 400, status: "RESOURCE_EXHAUSTED", message: "RAW_GOOGLE_ERROR_SENTINEL" },
    }), { status: 400 }));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "rate-limit", 400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not wait or retry when Retry-After exceeds the bound", async () => {
    const fetchMock = fetchMockWith(errorResponse(429, undefined, { "Retry-After": "6" }));
    const sleep = vi.fn(async () => undefined);
    await expectProviderFailure(
      providerWith(fetchMock, { sleep }).generateStructured(request),
      "rate-limit",
      429,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    [503, "upstream"],
    [504, "timeout"],
  ])("retries transient HTTP %i once and maps the final failure", async (status, kind) => {
    const fetchMock = fetchMockWith(errorResponse(status), errorResponse(status));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), kind, status);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network failures once and keeps the final error safe", async () => {
    const fetchMock = fetchMockWith(new Error("RAW_NETWORK_SENTINEL"), new Error("RAW_NETWORK_SENTINEL"));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "upstream", null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps repeated abort failures to timeout", async () => {
    const abort = new DOMException("PRIVATE_ABORT_SENTINEL", "AbortError");
    const fetchMock = fetchMockWith(abort, abort);
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "timeout", null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps only a safe request identifier", async () => {
    const safeFetch = fetchMockWith(errorResponse(401, undefined, { "x-goog-request-id": "safe/request-1" }));
    try {
      await providerWith(safeFetch).generateStructured(request);
    } catch (error) {
      expect(error).toMatchObject({ requestId: "safe/request-1" });
    }

    const unsafeFetch = fetchMockWith(errorResponse(401, undefined, { "x-goog-request-id": "unsafe id with spaces" }));
    try {
      await providerWith(unsafeFetch).generateStructured(request);
    } catch (error) {
      expect(error).toMatchObject({ requestId: null });
    }
  });
});
