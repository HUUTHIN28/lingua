import { z } from "zod";
import { buildGenerationMessages } from "@/ai/prompts/build-generation-prompt";
import {
  AIProviderError,
  type AIProvider,
  type AIProviderFailureKind,
  type StructuredGenerationRequest,
} from "./ai-provider";

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_ENDPOINT_ORIGIN = "https://generativelanguage.googleapis.com";
export const GEMINI_STRATEGY_VERSION = "response-json-schema-v2";

const DEFAULT_TIMEOUT_MS = 45_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_CHARACTERS = 64_000;
const MAX_RETRY_DELAY_MS = 5_000;
const MAX_MODEL_NAME_LENGTH = 200;
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504, 524, 529]);
const modelNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type GeminiProviderOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const textPartSchema = z.object({ text: z.string() }).passthrough();
const successEnvelopeSchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.string().optional(),
    content: z.object({
      parts: z.array(z.unknown()).min(1),
    }).passthrough(),
  }).passthrough()).length(1),
  promptFeedback: z.object({ blockReason: z.string().optional() }).passthrough().optional(),
}).passthrough();

const errorEnvelopeSchema = z.object({
  error: z.object({
    status: z.string().max(200).optional(),
    message: z.string().max(2_000).optional(),
  }).passthrough(),
}).passthrough();

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

const failureKindForStatus = (status: number, body: unknown): AIProviderFailureKind => {
  if (status === 401 || status === 403) return "authentication";
  const parsedError = errorEnvelopeSchema.safeParse(body);
  if (status === 429 || (parsedError.success && parsedError.data.error.status === "RESOURCE_EXHAUSTED")) {
    return "rate-limit";
  }
  if (status === 408 || status === 504) return "timeout";
  if (status === 400 || status === 422) {
    const detail = parsedError.success
      ? `${parsedError.data.error.status ?? ""} ${parsedError.data.error.message ?? ""}`
      : "";
    if (/response[_ -]?json[_ -]?schema|response[_ -]?mime[_ -]?type|json schema|structured output/i.test(detail)) {
      return "capability";
    }
  }
  return "upstream";
};

const parseRetryAfter = (value: string | null): number | null => {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1_000;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
};

const readJsonBody = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (text.length === 0 || text.length > MAX_RESPONSE_CHARACTERS) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const getRequestId = (response: Response): string | null =>
  response.headers.get("x-goog-request-id") ?? response.headers.get("x-request-id");

const isValidModelName = (model: string): boolean =>
  model.length > 0 && model.length <= MAX_MODEL_NAME_LENGTH && modelNamePattern.test(model);

const adaptJsonSchemaForGemini = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => adaptJsonSchemaForGemini(item));
  }
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const adapted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (key !== "const") adapted[key] = adaptJsonSchemaForGemini(child);
  }
  if (Object.hasOwn(source, "const")) {
    adapted.enum = [adaptJsonSchemaForGemini(source.const)];
  }
  return adapted;
};

const jsonSchemaFor = <T>(request: StructuredGenerationRequest<T>): Record<string, unknown> => {
  try {
    const generated = z.toJSONSchema(request.schema, {
      target: "draft-2020-12",
    }) as Record<string, unknown>;
    const { $schema: _schemaVersion, ...schema } = generated;
    void _schemaVersion;
    return adaptJsonSchemaForGemini(schema) as Record<string, unknown>;
  } catch {
    throw new AIProviderError("capability");
  }
};

export class GeminiProvider implements AIProvider {
  readonly cacheIdentity: string;
  readonly maxConcurrency = 1;
  readonly model: string;

  readonly #apiKey: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;

  constructor(options: GeminiProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) throw new Error("Gemini API key is required.");
    const model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
    if (!isValidModelName(model)) {
      throw new Error("Gemini model configuration is invalid.");
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error("Gemini timeout must be an integer between 1000 and 120000 milliseconds.");
    }

    this.#apiKey = apiKey;
    this.model = model;
    this.#timeoutMs = timeoutMs;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#random = options.random ?? Math.random;
    this.cacheIdentity = `gemini:${model}:${GEMINI_STRATEGY_VERSION}`;
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<unknown> {
    const jsonSchema = jsonSchemaFor(request);
    const [systemMessage, userMessage] = buildGenerationMessages(request);
    const requestBody = {
      systemInstruction: { parts: [{ text: systemMessage.content }] },
      contents: [{ role: "user", parts: [{ text: userMessage.content }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: request.input.kind === "exercises" ? 8192 : 4096,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await this.#post(requestBody);
      } catch (error) {
        const kind: AIProviderFailureKind = isAbortError(error) ? "timeout" : "upstream";
        if (attempt === 0) {
          await this.#sleep(this.#backoffDelay());
          continue;
        }
        throw new AIProviderError(kind);
      }

      const responseBody = await readJsonBody(response);
      const requestId = getRequestId(response);
      if (response.ok) {
        return this.#parseResult(responseBody, response.status, requestId);
      }

      const failureKind = failureKindForStatus(response.status, responseBody);
      if (attempt === 0 && retryableStatuses.has(response.status)) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfter !== null && retryAfter > MAX_RETRY_DELAY_MS) {
          throw new AIProviderError(failureKind, { status: response.status, requestId });
        }
        await this.#sleep(retryAfter ?? this.#backoffDelay());
        continue;
      }
      throw new AIProviderError(failureKind, { status: response.status, requestId });
    }

    throw new AIProviderError("upstream");
  }

  async #post(body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetch(
        `${GEMINI_ENDPOINT_ORIGIN}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.#apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  #parseResult(body: unknown, status: number, requestId: string | null): unknown {
    const parsed = successEnvelopeSchema.safeParse(body);
    if (!parsed.success || parsed.data.promptFeedback?.blockReason) {
      throw new AIProviderError("invalid-output", { status, requestId });
    }

    const candidate = parsed.data.candidates[0];
    if (candidate.finishReason !== undefined && candidate.finishReason !== "STOP") {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
    const textParts: string[] = [];
    for (const part of candidate.content.parts) {
      const textPart = textPartSchema.safeParse(part);
      if (!textPart.success) {
        throw new AIProviderError("invalid-output", { status, requestId });
      }
      textParts.push(textPart.data.text);
    }
    const content = textParts.join("").trim();
    if (!content) throw new AIProviderError("invalid-output", { status, requestId });
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
  }

  #backoffDelay(): number {
    const random = this.#random();
    const boundedRandom = Number.isFinite(random) ? Math.min(1, Math.max(0, random)) : 0;
    return 250 + Math.floor(boundedRandom * 250);
  }
}
