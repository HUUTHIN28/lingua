import type { AIProvider } from "./ai-provider";
import { GeminiProvider, type GeminiProviderOptions } from "./gemini-provider";
import { MockAIProvider } from "./mock-ai-provider";
import { OpenRouterProvider, type OpenRouterProviderOptions } from "./openrouter-provider";

type ProviderEnvironment = Partial<Record<
  | "AI_PROVIDER"
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "GEMINI_TIMEOUT_MS"
  | "OPENROUTER_API_KEY"
  | "OPENROUTER_MODEL"
  | "OPENROUTER_FALLBACK_MODELS"
  | "OPENROUTER_TIMEOUT_MS",
  string | undefined
>>;

export type AIProviderFactoryOptions = {
  providerName?: string;
  environment?: ProviderEnvironment;
  openRouterApiKey?: string;
  openRouterModel?: string;
  openRouterFallbackModels?: readonly string[] | string;
  openRouterTimeoutMs?: number | string;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiTimeoutMs?: number | string;
  fetchImpl?: OpenRouterProviderOptions["fetchImpl"] | GeminiProviderOptions["fetchImpl"];
  sleep?: OpenRouterProviderOptions["sleep"] | GeminiProviderOptions["sleep"];
  random?: OpenRouterProviderOptions["random"] | GeminiProviderOptions["random"];
};

const parseTimeout = (
  value: number | string | undefined,
  providerName: "OpenRouter" | "Gemini",
): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${providerName} timeout configuration is invalid.`);
  }
  return Number(value.trim());
};

export const parseOpenRouterFallbackModels = (
  value: readonly string[] | string | undefined,
): readonly string[] | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  if (!value.trim()) return [];
  return value.split(",").map((model) => model.trim());
};

export function createAIProvider(options: AIProviderFactoryOptions | string = {}): AIProvider {
  const normalizedOptions = typeof options === "string" ? { providerName: options } : options;
  const environment = normalizedOptions.environment ?? process.env;
  const providerName = normalizedOptions.providerName ?? environment.AI_PROVIDER ?? "mock";
  if (providerName === "mock") return new MockAIProvider();
  if (providerName === "gemini") {
    const apiKey = normalizedOptions.geminiApiKey ?? environment.GEMINI_API_KEY ?? "";
    const model = normalizedOptions.geminiModel ?? environment.GEMINI_MODEL;
    const timeoutMs = parseTimeout(
      normalizedOptions.geminiTimeoutMs ?? environment.GEMINI_TIMEOUT_MS,
      "Gemini",
    );
    return new GeminiProvider({
      apiKey,
      model,
      timeoutMs,
      fetchImpl: normalizedOptions.fetchImpl,
      sleep: normalizedOptions.sleep,
      random: normalizedOptions.random,
    });
  }
  if (providerName === "openrouter") {
    const apiKey = normalizedOptions.openRouterApiKey ?? environment.OPENROUTER_API_KEY ?? "";
    const model = normalizedOptions.openRouterModel ?? environment.OPENROUTER_MODEL;
    const fallbackModels = parseOpenRouterFallbackModels(
      normalizedOptions.openRouterFallbackModels ?? environment.OPENROUTER_FALLBACK_MODELS,
    );
    const timeoutMs = parseTimeout(
      normalizedOptions.openRouterTimeoutMs ?? environment.OPENROUTER_TIMEOUT_MS,
      "OpenRouter",
    );
    return new OpenRouterProvider({
      apiKey,
      model,
      fallbackModels,
      timeoutMs,
      fetchImpl: normalizedOptions.fetchImpl,
      sleep: normalizedOptions.sleep,
      random: normalizedOptions.random,
    });
  }
  throw new Error("AI provider is not supported.");
}
