import type { ExerciseType } from "@/domain/exercise";
import type { LearningFocus } from "@/domain/language";
import type { TranscriptChunk, TranscriptSegment } from "@/domain/transcript";

export type FocusExerciseDistribution = Readonly<Record<ExerciseType, number>>;

export const FOCUS_EXERCISE_DISTRIBUTION = {
  comprehensive: {
    "multiple-choice": 10,
    "fill-blank": 8,
    translation: 8,
    listening: 8,
    dictation: 8,
  },
  speaking: {
    "multiple-choice": 10,
    "fill-blank": 8,
    translation: 10,
    listening: 5,
    dictation: 5,
  },
  listening: {
    "multiple-choice": 10,
    "fill-blank": 5,
    translation: 5,
    listening: 10,
    dictation: 10,
  },
  grammar: {
    "multiple-choice": 10,
    "fill-blank": 10,
    translation: 5,
    listening: 5,
    dictation: 5,
  },
} as const satisfies Readonly<Record<LearningFocus, FocusExerciseDistribution>>;

export type LearningContentKind = "vocabulary" | "grammar";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function contentTargets(segments: readonly TranscriptSegment[]) {
  const durationSeconds = segments.length === 0
    ? 0
    : Math.max(0, segments.at(-1)!.endTimeSeconds - segments[0].startTimeSeconds);
  const wordCount = segments.reduce(
    (total, segment) => total + (segment.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0),
    0,
  );
  return {
    vocabulary: Math.min(
      clamp(Math.round(durationSeconds / 45), 3, 20),
      Math.max(1, Math.floor(wordCount / 7)),
    ),
    grammar: Math.min(
      clamp(Math.round(durationSeconds / 120), 2, 8),
      Math.max(1, Math.floor(segments.length / 3)),
    ),
  };
}

export function allocateContentTargets(
  chunks: readonly TranscriptChunk[],
  total: number,
): number[] {
  if (chunks.length === 0) return [];
  if (total < chunks.length) {
    const result = chunks.map(() => 0);
    for (let index = 0; index < total; index += 1) {
      result[Math.min(chunks.length - 1, Math.floor((index + 0.5) * chunks.length / total))] = 1;
    }
    return result;
  }
  const weights = chunks.map((chunk) => chunk.segments.reduce(
    (sum, segment) => sum + segment.text.length,
    0,
  ));
  const result = chunks.map(() => 1);
  const remaining = total - chunks.length;
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || chunks.length;
  const fractional = weights.map((weight, index) => ({
    index,
    quota: remaining * ((weight || 1) / weightSum),
  }));
  for (const item of fractional) result[item.index] += Math.floor(item.quota);
  const assigned = result.reduce((sum, count) => sum + count, 0);
  fractional.sort((left, right) =>
    (right.quota % 1) - (left.quota % 1) || left.index - right.index,
  );
  for (let index = 0; index < total - assigned; index += 1) {
    result[fractional[index].index] += 1;
  }
  return result;
}
