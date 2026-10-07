import { z } from "zod";
import { buildGenerationMessages } from "@/ai/prompts/build-generation-prompt";
import {
  AIProviderError,
  type AIProvider,
  type AIProviderFailureKind,
  type StructuredGenerationRequest,
} from "./ai-provider";

export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_STRATEGY_VERSION = "json-schema-tool-fallback-v2";

const DEFAULT_TIMEOUT_MS = 45_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_CHARACTERS = 64_000;
const MAX_RETRY_DELAY_MS = 5_000;
const MAX_FALLBACK_MODELS = 3;
const MAX_MODEL_SLUG_LENGTH = 200;
const FALLBACK_TOOL_NAME = "submit_linguatube_result";
const retryableStatuses = new Set([408, 429, 500, 502, 503, 524, 529]);
const modelSlugPattern = /^~?[A-Za-z0-9][A-Za-z0-9._:-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type OpenRouterProviderOptions = {
  apiKey: string;
  model?: string;
  fallbackModels?: readonly string[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const nativeEnvelopeSchema = z.object({
  id: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({
      role: z.literal("assistant"),
      content: z.string(),
      refusal: z.string().nullable().optional(),
    }).passthrough(),
  }).passthrough()).length(1),
}).passthrough();

const toolEnvelopeSchema = z.object({
  id: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({
      role: z.literal("assistant"),
      refusal: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }).passthrough(),
      }).passthrough()).length(1),
    }).passthrough(),
  }).passthrough()).length(1),
}).passthrough();

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.union([z.string().max(200), z.number()]).optional(),
    message: z.string().max(2_000).optional(),
  }).passthrough(),
}).passthrough();

type RequestStrategy = "native" | "tool";

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

const failureKindForStatus = (status: number): AIProviderFailureKind => {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "quota";
  if (status === 429) return "rate-limit";
  if (status === 408) return "timeout";
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

const getRequestId = (response: Response, body: unknown): string | null => {
  const headerId = response.headers.get("x-request-id") ?? response.headers.get("x-openrouter-request-id");
  if (headerId) return headerId;
  if (typeof body === "object" && body !== null && typeof (body as { id?: unknown }).id === "string") {
    return (body as { id: string }).id;
  }
  return null;
};

const isStructuredOutputCapabilityError = (status: number, body: unknown): boolean => {
  if (status !== 400 && status !== 422) return false;
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (!parsed.success) return false;
  const detail = `${parsed.data.error.code ?? ""} ${parsed.data.error.message ?? ""}`;
  const namesStructuredParameter = /response[ _-]?format|json[ _-]?schema|require[ _-]?parameters/i.test(detail);
  const saysUnsupported = /unsupported|not supported|does not support|no endpoints?.*support|unknown parameter/i.test(detail);
  return namesStructuredParameter && saysUnsupported;
};

const schemaNameFor = (kind: string): string => `linguatube_${kind}`;

const isValidModelSlug = (model: string): boolean =>
  model.length > 0 &&
  model.length <= MAX_MODEL_SLUG_LENGTH &&
  modelSlugPattern.test(model);

const normalizeFallbackModels = (
  primaryModel: string,
  values: readonly string[] | undefined,
): readonly string[] => {
  if (values === undefined) return [];
  if (values.length > MAX_FALLBACK_MODELS) {
    throw new Error("OpenRouter supports at most 3 fallback models.");
  }

  const normalized = values.map((value) => value.trim());
  const seen = new Set<string>();
  for (const model of normalized) {
    if (!isValidModelSlug(model)) {
      throw new Error("OpenRouter fallback model configuration is invalid.");
    }
    if (model === primaryModel) {
      throw new Error("OpenRouter fallback models must exclude the primary model.");
    }
    if (seen.has(model)) {
      throw new Error("OpenRouter fallback models must be unique.");
    }
    seen.add(model);
  }
  return Object.freeze(normalized);
};

export class OpenRouterProvider implements AIProvider {
  readonly cacheIdentity: string;
  readonly maxConcurrency = 1;
  readonly model: string;
  readonly fallbackModels: readonly string[];

  readonly #apiKey: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;

  constructor(options: OpenRouterProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) throw new Error("OpenRouter API key is required.");
    const model = options.model?.trim() || DEFAULT_OPENROUTER_MODEL;
    if (!isValidModelSlug(model)) {
      throw new Error("OpenRouter model configuration is invalid.");
    }
    const fallbackModels = normalizeFallbackModels(model, options.fallbackModels);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error("OpenRouter timeout must be an integer between 1000 and 120000 milliseconds.");
    }
    this.#apiKey = apiKey;
    this.model = model;
    this.fallbackModels = fallbackModels;
    this.#timeoutMs = timeoutMs;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#random = options.random ?? Math.random;
    this.cacheIdentity = `openrouter:${[model, ...fallbackModels].join(">")}:${OPENROUTER_STRATEGY_VERSION}`;
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<unknown> {
    let jsonSchema: Record<string, unknown>;
    try {
      jsonSchema = z.toJSONSchema(request.schema, {
        target: "draft-2020-12",
      }) as Record<string, unknown>;
    } catch {
      throw new AIProviderError("capability");
    }

    const messages = buildGenerationMessages(request);
    const schemaName = schemaNameFor(request.input.kind);
    let strategy: RequestStrategy = "native";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestBody = strategy === "native"
        ? this.#nativeRequestBody(messages, schemaName, jsonSchema)
        : this.#toolRequestBody(messages, jsonSchema);

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
      const requestId = getRequestId(response, responseBody);

      if (response.ok) {
        return strategy === "native"
          ? this.#parseNativeResult(responseBody, response.status, requestId)
          : this.#parseToolResult(responseBody, response.status, requestId);
      }

      if (isStructuredOutputCapabilityError(response.status, responseBody)) {
        if (strategy === "native" && attempt === 0) {
          strategy = "tool";
          continue;
        }
        throw new AIProviderError("capability", { status: response.status, requestId });
      }

      const failureKind = failureKindForStatus(response.status);
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

  #nativeRequestBody(
    messages: ReturnType<typeof buildGenerationMessages>,
    schemaName: string,
    jsonSchema: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...this.#modelRoutingBody(),
      stream: false,
      temperature: 0,
      max_tokens: 4096,
      messages,
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema: jsonSchema },
      },
    };
  }

  #toolRequestBody(
    messages: ReturnType<typeof buildGenerationMessages>,
    jsonSchema: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...this.#modelRoutingBody(),
      stream: false,
      temperature: 0,
      max_tokens: 4096,
      messages,
      tools: [{
        type: "function",
        function: {
          name: FALLBACK_TOOL_NAME,
          description: "Return the requested transcript-grounded learning data.",
          parameters: jsonSchema,
        },
      }],
      tool_choice: { type: "function", function: { name: FALLBACK_TOOL_NAME } },
      parallel_tool_calls: false,
    };
  }

  async #post(body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  #modelRoutingBody(): { model: string } | { models: string[] } {
    return this.fallbackModels.length === 0
      ? { model: this.model }
      : { models: [this.model, ...this.fallbackModels] };
  }

  #parseNativeResult(body: unknown, status: number, requestId: string | null): unknown {
    const parsed = nativeEnvelopeSchema.safeParse(body);
    if (!parsed.success) throw new AIProviderError("invalid-output", { status, requestId });
    const { message } = parsed.data.choices[0];
    if (message.refusal !== undefined && message.refusal !== null) {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
    if (!message.content.trim()) throw new AIProviderError("invalid-output", { status, requestId });
    try {
      return JSON.parse(message.content) as unknown;
    } catch {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
  }

  #parseToolResult(body: unknown, status: number, requestId: string | null): unknown {
    const parsed = toolEnvelopeSchema.safeParse(body);
    if (!parsed.success) throw new AIProviderError("invalid-output", { status, requestId });
    const { message } = parsed.data.choices[0];
    if (message.refusal !== undefined && message.refusal !== null) {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
    const call = message.tool_calls[0];
    if (call.function.name !== FALLBACK_TOOL_NAME) {
      throw new AIProviderError("invalid-output", { status, requestId });
    }
    try {
      return JSON.parse(call.function.arguments) as unknown;
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
