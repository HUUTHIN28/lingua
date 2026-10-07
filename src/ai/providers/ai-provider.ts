import type { z } from "zod";
import type { TranscriptChunk, TranscriptSegment } from "@/domain/transcript";
import type { ExerciseType } from "@/domain/exercise";
import type { LearningFocus, LearningLevel, LanguageCode } from "@/domain/language";
import type { SafeGenerationIssue } from "@/ai/generation-diagnostics";

type CommonInput = {
  processingKey: string;
  generationId: string;
  youtubeVideoId: string;
  lessonId: string;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  targetLevel: LearningLevel | null;
  learningFocus: LearningFocus;
};

export type AIProviderInput = CommonInput &
  (
    | { kind: "vocabulary"; chunk: TranscriptChunk; targetCount?: number; excludeTerms?: string[] }
    | { kind: "grammar"; chunk: TranscriptChunk; targetCount?: number; excludeTerms?: string[] }
    | { kind: "sections"; transcript: TranscriptSegment[] }
    | {
        kind: "exercises";
        transcript: TranscriptSegment[];
        batch: { type: ExerciseType; count: number };
      }
  );

export type StructuredGenerationRequest<T> = {
  schema: z.ZodType<T>;
  promptVersion: string;
  input: AIProviderInput;
  repairIssues?: readonly SafeGenerationIssue[];
};

export const AI_PROVIDER_FAILURE_KINDS = [
  "invalid-output",
  "authentication",
  "quota",
  "rate-limit",
  "timeout",
  "capability",
  "upstream",
] as const;

export type AIProviderFailureKind = (typeof AI_PROVIDER_FAILURE_KINDS)[number];

export type AIProviderErrorOptions = {
  status?: number | null;
  requestId?: string | null;
};

const AI_PROVIDER_ERROR_MESSAGE = "AI provider request failed.";
const providerFailureKinds = new Set<string>(AI_PROVIDER_FAILURE_KINDS);
const safeRequestIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/;

const isSafeStatus = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599);

const isSafeRequestId = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && safeRequestIdPattern.test(value));

export class AIProviderError extends Error {
  readonly kind: AIProviderFailureKind;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(kind: AIProviderFailureKind, options: AIProviderErrorOptions = {}) {
    super(AI_PROVIDER_ERROR_MESSAGE);
    Object.defineProperty(this, "name", { value: "AIProviderError", configurable: true });
    this.kind = kind;
    this.status = isSafeStatus(options.status ?? null) ? (options.status ?? null) : null;
    this.requestId = isSafeRequestId(options.requestId ?? null) ? (options.requestId ?? null) : null;
  }
}

export function isAIProviderError(value: unknown): value is AIProviderError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.name === "AIProviderError"
    && candidate.message === AI_PROVIDER_ERROR_MESSAGE
    && typeof candidate.kind === "string"
    && providerFailureKinds.has(candidate.kind)
    && isSafeStatus(candidate.status)
    && isSafeRequestId(candidate.requestId);
}

export interface AIProvider {
  readonly cacheIdentity: string;
  readonly maxConcurrency: number;
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<unknown>;
}
