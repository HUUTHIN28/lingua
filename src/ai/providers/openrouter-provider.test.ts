import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { exerciseBatchTransportSchema } from "@/ai/exercise-generation-contract";
import type { StructuredGenerationRequest } from "./ai-provider";
import { isAIProviderError } from "./ai-provider";
import { createAIProvider } from "./provider-factory";
import { MockAIProvider } from "./mock-ai-provider";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_STRATEGY_VERSION,
  GeminiProvider,
} from "./gemini-provider";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_ENDPOINT,
  OPENROUTER_STRATEGY_VERSION,
  OpenRouterProvider,
} from "./openrouter-provider";

const TEST_CREDENTIAL = "test-only-credential";

const segment = {
  id: "segment-1",
  videoId: "video-1",
  startTimeSeconds: 0,
  endTimeSeconds: 2,
  text: "Are you available tomorrow?",
  translation: "Bạn có rảnh ngày mai không?",
};

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
    chunk: { id: "chunk-1", startTimeSeconds: 0, endTimeSeconds: 2, segments: [segment] },
  },
};

const nativeSuccess = (value: unknown = { answer: "available" }): Response => new Response(JSON.stringify({
  id: "request-safe-1",
  choices: [{ message: { role: "assistant", content: JSON.stringify(value), refusal: null } }],
}), { status: 200, headers: { "Content-Type": "application/json" } });

const toolSuccess = (value: unknown = { answer: "available" }): Response => new Response(JSON.stringify({
  id: "request-safe-2",
  choices: [{
    message: {
      role: "assistant",
      content: "ignored",
      tool_calls: [{
        id: "tool-1",
        type: "function",
        function: { name: "submit_linguatube_result", arguments: JSON.stringify(value) },
      }],
    },
  }],
}), { status: 200, headers: { "Content-Type": "application/json" } });

const errorResponse = (
  status: number,
  message = "ordinary upstream error",
  headers?: HeadersInit,
): Response => new Response(JSON.stringify({ error: { code: status, message } }), { status, headers });

const fetchMockWith = (...responses: Array<Response | Error>): ReturnType<typeof vi.fn> => vi.fn(
  async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected fetch call");
    if (next instanceof Response) return next;
    throw next;
  },
);

const providerWith = (fetchMock: ReturnType<typeof vi.fn>, overrides: Partial<ConstructorParameters<typeof OpenRouterProvider>[0]> = {}) =>
  new OpenRouterProvider({
    apiKey: TEST_CREDENTIAL,
    fetchImpl: fetchMock as typeof fetch,
    sleep: async () => undefined,
    random: () => 0,
    ...overrides,
  });

const requestBodyAt = (fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> => {
  const init = fetchMock.mock.calls[index][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
};

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
    expect(String(error)).not.toContain(TEST_CREDENTIAL);
    expect(String(error)).not.toContain("ordinary upstream error");
  }
};

describe("OpenRouterProvider", () => {
  it("sends the exact native structured request and returns complete JSON", async () => {
    const fetchMock = fetchMockWith(nativeSuccess());
    const provider = providerWith(fetchMock, { model: "vendor/test-model" });

    await expect(provider.generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(OPENROUTER_ENDPOINT);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe(`Bearer ${TEST_CREDENTIAL}`);
    expect(headers.has("http-referer")).toBe(false);
    expect(headers.has("x-title")).toBe(false);

    const body = requestBodyAt(fetchMock, 0);
    expect(body).toMatchObject({
      model: "vendor/test-model",
      stream: false,
      temperature: 0,
      max_tokens: 4096,
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: "linguatube_vocabulary", strict: true },
      },
    });
    expect(body.messages).toHaveLength(2);
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("models");
    expect(JSON.stringify(body)).not.toContain(TEST_CREDENTIAL);
    expect(JSON.stringify((body.response_format as { json_schema: { schema: unknown } }).json_schema.schema))
      .toContain("answer");
    expect(provider.cacheIdentity).toBe(`openrouter:vendor/test-model:${OPENROUTER_STRATEGY_VERSION}`);
    expect(provider.cacheIdentity).not.toContain(TEST_CREDENTIAL);
    expect(provider.maxConcurrency).toBe(1);
  });

  it("sends the ordered official models routing chain in native and tool bodies", async () => {
    const options = {
      model: "vendor/primary-model",
      fallbackModels: [" vendor/fallback-one ", "~vendor/fallback-two"],
    } as const;
    const expectedModels = [
      "vendor/primary-model",
      "vendor/fallback-one",
      "~vendor/fallback-two",
    ];

    const nativeFetch = fetchMockWith(nativeSuccess());
    const nativeProvider = providerWith(nativeFetch, options);
    await expect(nativeProvider.generateStructured(request)).resolves.toEqual({ answer: "available" });
    const nativeBody = requestBodyAt(nativeFetch, 0);
    expect(nativeBody.models).toEqual(expectedModels);
    expect(nativeBody).not.toHaveProperty("model");

    const toolFetch = fetchMockWith(
      errorResponse(400, "No endpoints support the required response_format JSON schema parameter"),
      toolSuccess(),
    );
    const toolProvider = providerWith(toolFetch, options);
    await expect(toolProvider.generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(requestBodyAt(toolFetch, 0).models).toEqual(expectedModels);
    expect(requestBodyAt(toolFetch, 1).models).toEqual(expectedModels);
    expect(requestBodyAt(toolFetch, 0)).not.toHaveProperty("model");
    expect(requestBodyAt(toolFetch, 1)).not.toHaveProperty("model");

    expect(nativeProvider.fallbackModels).toEqual(expectedModels.slice(1));
    expect(nativeProvider.cacheIdentity).toBe(
      `openrouter:${expectedModels.join(">")}:${OPENROUTER_STRATEGY_VERSION}`,
    );
    expect(nativeProvider.cacheIdentity).not.toContain(TEST_CREDENTIAL);
  });

  it("keeps empty fallback routing on model and isolates ordered chains in cache identity", () => {
    const noFallback = providerWith(vi.fn(), {
      model: "vendor/primary-model",
      fallbackModels: [],
    });
    const firstOrder = providerWith(vi.fn(), {
      model: "vendor/primary-model",
      fallbackModels: ["vendor/fallback-one", "vendor/fallback-two"],
    });
    const reverseOrder = providerWith(vi.fn(), {
      model: "vendor/primary-model",
      fallbackModels: ["vendor/fallback-two", "vendor/fallback-one"],
    });

    expect(noFallback.cacheIdentity).toBe(
      `openrouter:vendor/primary-model:${OPENROUTER_STRATEGY_VERSION}`,
    );
    expect(firstOrder.cacheIdentity).not.toBe(reverseOrder.cacheIdentity);
    expect(firstOrder.cacheIdentity).not.toBe(noFallback.cacheIdentity);
  });

  it.each([
    [[""], "configuration is invalid"],
    [["not-a-model-slug"], "configuration is invalid"],
    [["vendor/primary-model"], "exclude the primary"],
    [["vendor/fallback", " vendor/fallback "], "must be unique"],
    [["vendor/a", "vendor/b", "vendor/c", "vendor/d"], "at most 3"],
  ] as const)("rejects invalid fallback configuration %j", (fallbackModels, message) => {
    expect(() => providerWith(vi.fn(), {
      model: "vendor/primary-model",
      fallbackModels,
    })).toThrow(message);
  });

  it("rejects an invalid primary model slug", () => {
    expect(() => providerWith(vi.fn(), { model: "not-a-model-slug" }))
      .toThrow("OpenRouter model configuration is invalid.");
  });

  it("sends one strict exercise batch schema identically through native and forced-tool requests", async () => {
    const transportResult = { exercises: Array.from({ length: 5 }, (_, index) => ({
      id: `exercise-${index + 1}`,
      lessonId: "lesson-1",
      type: "dictation" as const,
      question: `Write sentence ${index + 1}.`,
      sourceSegmentIds: ["segment-1"],
      startTimeSeconds: 0,
      endTimeSeconds: 2,
      expectedAnswer: "Are you available tomorrow?",
    })) };
    const schema = exerciseBatchTransportSchema("dictation", 5);
    expect(schema.parse(transportResult)).toEqual(transportResult);
    const exerciseRequest: StructuredGenerationRequest<z.infer<typeof schema>> = {
      schema,
      promptVersion: "test-prompt-v5",
      input: {
        kind: "exercises",
        processingKey: "private-processing-key",
        generationId: "generation-1",
        youtubeVideoId: "youtube-1",
        lessonId: "lesson-1",
        learningLanguage: "en",
        nativeLanguage: "vi",
        targetLevel: { system: "CEFR", value: "B1" },
        learningFocus: "speaking",
        transcript: [segment],
        batch: { type: "dictation", count: 5 },
      },
    };

    const nativeFetch = fetchMockWith(nativeSuccess(transportResult));
    await expect(providerWith(nativeFetch).generateStructured(exerciseRequest))
      .resolves.toEqual(transportResult);

    const fallbackFetch = fetchMockWith(
      errorResponse(400, "No endpoints support the required response_format JSON schema parameter"),
      toolSuccess(transportResult),
    );
    await expect(providerWith(fallbackFetch).generateStructured(exerciseRequest))
      .resolves.toEqual(transportResult);

    const nativeSchema = (requestBodyAt(nativeFetch, 0).response_format as {
      json_schema: { schema: Record<string, unknown> };
    }).json_schema.schema;
    const fallbackNativeSchema = (requestBodyAt(fallbackFetch, 0).response_format as {
      json_schema: { schema: Record<string, unknown> };
    }).json_schema.schema;
    const fallbackToolSchema = (
      requestBodyAt(fallbackFetch, 1).tools as Array<{
        function: { parameters: Record<string, unknown> };
      }>
    )[0].function.parameters;

    expect(nativeSchema).toEqual(fallbackNativeSchema);
    expect(nativeSchema).toEqual(fallbackToolSchema);
    expect(nativeSchema).toMatchObject({
      type: "object",
      required: ["exercises"],
      additionalProperties: false,
      properties: {
        exercises: { type: "array", minItems: 5, maxItems: 5 },
      },
    });
    const serializedSchema = JSON.stringify(nativeSchema);
    expect(serializedSchema).toContain("\"const\":\"dictation\"");
    for (const unsupportedKeyword of ["prefixItems", "contains", "minContains", "maxContains"]) {
      expect(serializedSchema).not.toContain(`\"${unsupportedKeyword}\"`);
    }
  });

  it.each([
    ["missing choices", {}],
    ["empty choices", { choices: [] }],
    ["multiple choices", { choices: [{ message: { role: "assistant", content: "{}" } }, { message: { role: "assistant", content: "{}" } }] }],
    ["non-assistant", { choices: [{ message: { role: "user", content: "{}" } }] }],
    ["refusal", { choices: [{ message: { role: "assistant", content: "{}", refusal: "no" } }] }],
    ["empty content", { choices: [{ message: { role: "assistant", content: "  " } }] }],
    ["prose wrapped JSON", { choices: [{ message: { role: "assistant", content: "Result: {\"answer\":\"x\"}" } }] }],
    ["fenced JSON", { choices: [{ message: { role: "assistant", content: "```json\\n{\"answer\":\"x\"}\\n```" } }] }],
  ])("rejects %s as safe invalid output", async (_label, body) => {
    const fetchMock = fetchMockWith(new Response(JSON.stringify(body), { status: 200 }));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "invalid-output", 200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses one forced-tool fallback only for a validated capability error", async () => {
    const fetchMock = fetchMockWith(
      errorResponse(400, "No endpoints support the required response_format JSON schema parameter"),
      toolSuccess(),
    );
    await expect(providerWith(fetchMock).generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const nativeBody = requestBodyAt(fetchMock, 0);
    const fallbackBody = requestBodyAt(fetchMock, 1);
    expect(nativeBody).toHaveProperty("response_format");
    expect(fallbackBody).not.toHaveProperty("response_format");
    expect(fallbackBody).not.toHaveProperty("provider");
    expect(fallbackBody).toMatchObject({
      model: DEFAULT_OPENROUTER_MODEL,
      tool_choice: { type: "function", function: { name: "submit_linguatube_result" } },
      parallel_tool_calls: false,
      tools: [{ type: "function", function: { name: "submit_linguatube_result" } }],
    });
    expect((fallbackBody.tools as Array<{ function: { parameters: unknown } }>)[0].function.parameters)
      .toEqual((nativeBody.response_format as { json_schema: { schema: unknown } }).json_schema.schema);
  });

  it("does not enter fallback for unrelated or malformed client errors", async () => {
    for (const response of [
      errorResponse(400, "Unknown model slug"),
      new Response("response_format unsupported", { status: 422 }),
    ]) {
      const fetchMock = fetchMockWith(response);
      await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "upstream", response.status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects an invalid or unsupported forced-tool result without a third request", async () => {
    const wrongTool = toolSuccess();
    const wrongBody = await wrongTool.json() as { choices: Array<{ message: { tool_calls: Array<{ function: { name: string } }> } }> };
    wrongBody.choices[0].message.tool_calls[0].function.name = "other_function";
    const wrongFetch = fetchMockWith(
      errorResponse(422, "response_format is not supported"),
      new Response(JSON.stringify(wrongBody), { status: 200 }),
    );
    await expectProviderFailure(providerWith(wrongFetch).generateStructured(request), "invalid-output", 200);
    expect(wrongFetch).toHaveBeenCalledTimes(2);

    const unsupportedFetch = fetchMockWith(
      errorResponse(400, "response_format is unsupported"),
      errorResponse(400, "tools are unsupported for this JSON schema"),
    );
    await expectProviderFailure(providerWith(unsupportedFetch).generateStructured(request), "capability", 400);
    expect(unsupportedFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["multiple calls", [
      { type: "function", function: { name: "submit_linguatube_result", arguments: "{}" } },
      { type: "function", function: { name: "submit_linguatube_result", arguments: "{}" } },
    ]],
    ["malformed arguments", [
      { type: "function", function: { name: "submit_linguatube_result", arguments: "not-json" } },
    ]],
  ])("fails closed for fallback %s", async (_label, toolCalls) => {
    const fetchMock = fetchMockWith(
      errorResponse(400, "response_format is unsupported"),
      new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", tool_calls: toolCalls } }],
      }), { status: 200 }),
    );
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "invalid-output", 200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [402, "quota"],
    [404, "upstream"],
  ])("maps status %i without retry", async (status, kind) => {
    const fetchMock = fetchMockWith(errorResponse(status));
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), kind, status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [408, "timeout"],
    [429, "rate-limit"],
    [500, "upstream"],
    [502, "upstream"],
    [503, "upstream"],
    [524, "upstream"],
    [529, "upstream"],
  ])("retries transient status %i once", async (status) => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = fetchMockWith(errorResponse(status), nativeSuccess());
    await expect(providerWith(fetchMock, { sleep }).generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("retries network and abort failures once with safe classifications", async () => {
    const networkFetch = fetchMockWith(new Error("socket included private bytes"), new Error("again"));
    await expectProviderFailure(providerWith(networkFetch).generateStructured(request), "upstream", null);
    expect(networkFetch).toHaveBeenCalledTimes(2);

    const abortFetch = fetchMockWith(
      new DOMException("timed out", "AbortError"),
      new DOMException("timed out", "AbortError"),
    );
    await expectProviderFailure(providerWith(abortFetch).generateStructured(request), "timeout", null);
    expect(abortFetch).toHaveBeenCalledTimes(2);
  });

  it("stops malformed persistent upstream responses after two requests", async () => {
    const fetchMock = fetchMockWith(
      new Response("not-json", { status: 503 }),
      new Response("still-not-json", { status: 503 }),
    );
    await expectProviderFailure(providerWith(fetchMock).generateStructured(request), "upstream", 503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors only bounded Retry-After and clears request timers", async () => {
    const sleep = vi.fn(async () => undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const fetchMock = fetchMockWith(errorResponse(429, "rate limited", { "Retry-After": "2" }), nativeSuccess());
    await expect(providerWith(fetchMock, { sleep }).generateStructured(request)).resolves.toEqual({ answer: "available" });
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    clearTimeoutSpy.mockRestore();

    const longSleep = vi.fn(async () => undefined);
    const longFetch = fetchMockWith(errorResponse(429, "rate limited", { "Retry-After": "10" }));
    await expectProviderFailure(providerWith(longFetch, { sleep: longSleep }).generateStructured(request), "rate-limit", 429);
    expect(longFetch).toHaveBeenCalledTimes(1);
    expect(longSleep).not.toHaveBeenCalled();
  });
});

describe("createAIProvider", () => {
  it("keeps mock as the default without reading OpenRouter configuration", () => {
    const environment = new Proxy({ AI_PROVIDER: "mock" }, {
      get(target, property) {
        if (property !== "AI_PROVIDER") throw new Error(`Unexpected environment read: ${String(property)}`);
        return target.AI_PROVIDER;
      },
    });
    expect(createAIProvider({ environment })).toBeInstanceOf(MockAIProvider);
    expect(createAIProvider("mock")).toBeInstanceOf(MockAIProvider);
  });

  it("resolves default/explicit model and injected transport safely", () => {
    const fetchMock = fetchMockWith(nativeSuccess());
    const defaultProvider = createAIProvider({
      environment: { AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: TEST_CREDENTIAL },
      fetchImpl: fetchMock as typeof fetch,
    });
    expect(defaultProvider).toBeInstanceOf(OpenRouterProvider);
    expect(defaultProvider.cacheIdentity).toContain(DEFAULT_OPENROUTER_MODEL);

    const explicitProvider = createAIProvider({
      providerName: "openrouter",
      environment: {},
      openRouterApiKey: TEST_CREDENTIAL,
      openRouterModel: " vendor/model ",
      openRouterTimeoutMs: "1000",
      fetchImpl: fetchMock as typeof fetch,
    });
    expect(explicitProvider.cacheIdentity).toBe(`openrouter:vendor/model:${OPENROUTER_STRATEGY_VERSION}`);
  });

  it("resolves Gemini defaults and gives explicit options precedence", () => {
    const defaultProvider = createAIProvider({
      environment: { AI_PROVIDER: "gemini", GEMINI_API_KEY: TEST_CREDENTIAL },
      fetchImpl: vi.fn() as typeof fetch,
    });
    expect(defaultProvider).toBeInstanceOf(GeminiProvider);
    expect(defaultProvider.cacheIdentity).toBe(
      `gemini:${DEFAULT_GEMINI_MODEL}:${GEMINI_STRATEGY_VERSION}`,
    );

    const explicitProvider = createAIProvider({
      providerName: "gemini",
      environment: {
        GEMINI_API_KEY: "ignored-environment-key",
        GEMINI_MODEL: "gemini-environment-model",
        GEMINI_TIMEOUT_MS: "1000",
      },
      geminiApiKey: TEST_CREDENTIAL,
      geminiModel: "gemini-explicit-model",
      geminiTimeoutMs: 2_000,
      fetchImpl: vi.fn() as typeof fetch,
    });
    expect(explicitProvider).toBeInstanceOf(GeminiProvider);
    expect(explicitProvider.cacheIdentity).toBe(
      `gemini:gemini-explicit-model:${GEMINI_STRATEGY_VERSION}`,
    );
    expect(explicitProvider.cacheIdentity).not.toContain(TEST_CREDENTIAL);
  });

  it("parses comma-separated fallback models and preserves their order", () => {
    const environmentProvider = createAIProvider({
      environment: {
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: TEST_CREDENTIAL,
        OPENROUTER_MODEL: "vendor/primary",
        OPENROUTER_FALLBACK_MODELS: " vendor/first,~vendor/second ",
      },
    });
    expect(environmentProvider.cacheIdentity).toBe(
      `openrouter:vendor/primary>vendor/first>~vendor/second:${OPENROUTER_STRATEGY_VERSION}`,
    );

    const emptyProvider = createAIProvider({
      environment: {
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: TEST_CREDENTIAL,
        OPENROUTER_MODEL: "vendor/primary",
        OPENROUTER_FALLBACK_MODELS: "   ",
      },
    });
    expect(emptyProvider.cacheIdentity).toBe(
      `openrouter:vendor/primary:${OPENROUTER_STRATEGY_VERSION}`,
    );

    expect(() => createAIProvider({
      providerName: "openrouter",
      environment: {},
      openRouterApiKey: TEST_CREDENTIAL,
      openRouterModel: "vendor/primary",
      openRouterFallbackModels: "vendor/first,,vendor/second",
    })).toThrow("configuration is invalid");
  });

  it("fails closed for missing key, invalid timeout, and unknown provider", () => {
    expect(() => createAIProvider({ providerName: "openrouter", environment: {} }))
      .toThrow("OpenRouter API key is required.");
    expect(() => createAIProvider({
      providerName: "openrouter",
      environment: {},
      openRouterApiKey: TEST_CREDENTIAL,
      openRouterTimeoutMs: "1.5 seconds",
    })).toThrow("OpenRouter timeout configuration is invalid.");
    expect(() => createAIProvider({ providerName: "gemini", environment: {} }))
      .toThrow("Gemini API key is required.");
    expect(() => createAIProvider({
      providerName: "gemini",
      environment: {},
      geminiApiKey: TEST_CREDENTIAL,
      geminiTimeoutMs: "invalid",
    })).toThrow("Gemini timeout configuration is invalid.");
    expect(() => createAIProvider({
      providerName: "gemini",
      environment: {},
      geminiApiKey: TEST_CREDENTIAL,
      geminiModel: "models/unsafe name",
    })).toThrow("Gemini model configuration is invalid.");
    expect(() => createAIProvider({ providerName: "unknown", environment: {} }))
      .toThrow("AI provider is not supported.");
  });
});
