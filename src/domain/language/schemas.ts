import { z } from "zod";

export const languageCodeSchema = z.enum(["en", "vi", "zh", "ja"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const cefrLevelSchema = z.object({
  system: z.literal("CEFR"),
  value: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

export const hskLevelSchema = z.object({
  system: z.literal("HSK"),
  value: z.enum(["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"]),
});

export const jlptLevelSchema = z.object({
  system: z.literal("JLPT"),
  value: z.enum(["N5", "N4", "N3", "N2", "N1"]),
});

export const learningLevelSchema = z.discriminatedUnion("system", [
  cefrLevelSchema,
  hskLevelSchema,
  jlptLevelSchema,
]);
export type LearningLevel = z.infer<typeof learningLevelSchema>;

export const learningFocusSchema = z.enum([
  "speaking",
  "listening",
  "grammar",
  "comprehensive",
]);
export type LearningFocus = z.infer<typeof learningFocusSchema>;

export const DEFAULT_LEARNING_FOCUS: LearningFocus = "comprehensive";

export const LEARNING_FOCUS_LABELS: Record<LearningFocus, string> = {
  speaking: "Luyện nói",
  listening: "Luyện nghe",
  grammar: "Luyện ngữ pháp",
  comprehensive: "Toàn diện",
};

export const learningLanguageConfigSchema = z.object({
  learningLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema,
  targetLevel: learningLevelSchema.nullable(),
  learningFocus: learningFocusSchema,
});
export type LearningLanguageConfig = z.infer<typeof learningLanguageConfigSchema>;

export const DEFAULT_LANGUAGE_CONFIG: LearningLanguageConfig = {
  learningLanguage: "en",
  nativeLanguage: "vi",
  targetLevel: null,
  learningFocus: DEFAULT_LEARNING_FOCUS,
};

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "English",
  vi: "Tiếng Việt",
  zh: "中文",
  ja: "日本語",
};

export const formatLearningLevel = (level: LearningLevel | null): string => {
  if (!level) return "Tự động";
  return level.system === "HSK" ? level.value.replace("HSK", "HSK ") : level.value;
};
