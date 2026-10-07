import { generatedLessonSchema, type GeneratedLesson } from "@/domain/lesson";
import { ApplicationError } from "@/services/learning/errors";
import type { z } from "zod";

export function validateLessonTraceability(
  input: unknown,
  onInvalid?: (issues: readonly z.core.$ZodIssue[]) => void,
): GeneratedLesson {
  const parsed = generatedLessonSchema.safeParse(input);
  if (!parsed.success) {
    try {
      onInvalid?.(parsed.error.issues);
    } catch {
      // Optional internal diagnostics cannot change validation behavior.
    }
    throw new ApplicationError(
      "INVALID_GENERATED_CONTENT",
      "Nội dung tạo tự động không hợp lệ sau khi kiểm tra.",
      422,
    );
  }
  return parsed.data;
}
