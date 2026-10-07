import { createHash } from "node:crypto";
import type { LearningFocus, LearningLevel, LanguageCode } from "@/domain/language";

export type ContentProcessingKey = {
  youtubeVideoId: string;
  transcriptVersion: string;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  targetLevel: string;
  learningFocus: LearningFocus;
  aiProviderIdentity: string;
  promptVersion: string;
};

export function canonicalProcessingKey(input: ContentProcessingKey): string {
  return JSON.stringify({
    youtubeVideoId: input.youtubeVideoId,
    transcriptVersion: input.transcriptVersion,
    learningLanguage: input.learningLanguage,
    nativeLanguage: input.nativeLanguage,
    targetLevel: input.targetLevel,
    learningFocus: input.learningFocus,
    aiProviderIdentity: input.aiProviderIdentity,
    promptVersion: input.promptVersion,
  });
}

export function hashProcessingKey(input: ContentProcessingKey): string {
  return createHash("sha256").update(canonicalProcessingKey(input)).digest("hex");
}

export function serializeLevel(level: LearningLevel | null): string {
  return level ? `${level.system}:${level.value}` : "auto";
}
