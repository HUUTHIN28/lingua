import { z } from "zod";
import {
  dictationExerciseSchema,
  exerciseSchema,
  fillBlankExerciseSchema,
  listeningExerciseSchema,
  multipleChoiceExerciseSchema,
  translationExerciseSchema,
  type Exercise,
  type ExerciseType,
} from "@/domain/exercise";
import type { LearningFocus, LearningLevel } from "@/domain/language";
import { learningLevelSchema } from "@/domain/language";
import { FOCUS_EXERCISE_DISTRIBUTION } from "@/ai/prompts/generation-policy";
import type { TranscriptSegment } from "@/domain/transcript";

export const EXERCISE_TRANSPORT_BUCKETS = [
  "multiple-choice",
  "fill-blank",
  "translation",
  "listening",
  "dictation",
] as const satisfies readonly ExerciseType[];

const schemaForExerciseType = (type: ExerciseType) => {
  switch (type) {
    case "multiple-choice": return multipleChoiceExerciseSchema;
    case "fill-blank": return fillBlankExerciseSchema;
    case "translation": return translationExerciseSchema;
    case "listening": return listeningExerciseSchema;
    case "dictation": return dictationExerciseSchema;
  }
};

export const exerciseBatchTransportSchema = (
  type: ExerciseType,
  count: number,
  transcript: readonly TranscriptSegment[] = [],
): z.ZodType<{ exercises: Exercise[] }> => {
  const sourceText = new Map(transcript.map((segment) => [segment.id, segment.text]));
  const normalize = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return z.strictObject({
    exercises: z.array(schemaForExerciseType(type)).length(count),
  }).superRefine((value, context) => {
    if (transcript.length === 0 || (type !== "listening" && type !== "dictation")) return;
    value.exercises.forEach((exercise, index) => {
      if (exercise.type !== type || (exercise.type !== "listening" && exercise.type !== "dictation")) return;
      const resolved = exercise.sourceSegmentIds.map((id) => sourceText.get(id)).filter((text): text is string => Boolean(text)).join(" ");
      if (!resolved) return;
      const matchesFullSource = normalize(exercise.expectedAnswer) === normalize(resolved);
      if (exercise.type === "listening" && matchesFullSource) {
        context.addIssue({ code: "custom", path: ["exercises", index, "expectedAnswer"], message: "Listening phải dùng câu trả lời ngắn, không chép nguyên nguồn." });
      }
      if (exercise.type === "dictation" && !matchesFullSource) {
        context.addIssue({ code: "custom", path: ["exercises", index, "expectedAnswer"], message: "Dictation phải dùng nguyên văn nguồn." });
      }
    });
  }) as z.ZodType<{ exercises: Exercise[] }>;
};

export const exerciseListSchemaForFocus = (focus: LearningFocus) => {
  const distribution = FOCUS_EXERCISE_DISTRIBUTION[focus];
  const expectedTotal = Object.values(distribution).reduce(
    (total, count) => total + count,
    0,
  );

  return z
    .array(exerciseSchema)
    .length(expectedTotal)
    .superRefine((exercises, context) => {
      for (const required of EXERCISE_TRANSPORT_BUCKETS) {
        const count = exercises.filter((exercise) => exercise.type === required).length;
        if (count !== distribution[required]) {
          context.addIssue({
            code: "custom",
            path: ["distribution", required],
            message: `Phân bố ${required} cho ${focus} phải là ${distribution[required]}, nhận ${count}.`,
          });
        }
      }

      const ids = new Set<string>();
      exercises.forEach((exercise, index) => {
        if (ids.has(exercise.id)) {
          context.addIssue({
            code: "custom",
            path: [index, "id"],
            message: "Exercise id phải duy nhất.",
          });
        }
        ids.add(exercise.id);
      });
    });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Remove only invalid optional difficulty metadata for an Auto-level request. */
export function normalizeAutoLevelExerciseDifficulty(
  input: unknown,
  targetLevel: LearningLevel | null,
): unknown {
  if (targetLevel !== null || !isRecord(input) || !Array.isArray(input.exercises)) {
    return input;
  }

  let changed = false;
  const exercises = input.exercises.map((exercise) => {
    if (
      !isRecord(exercise)
      || !Object.hasOwn(exercise, "difficulty")
      || learningLevelSchema.safeParse(exercise.difficulty).success
    ) {
      return exercise;
    }

    const { difficulty: _invalidDifficulty, ...withoutDifficulty } = exercise;
    void _invalidDifficulty;
    changed = true;
    return withoutDifficulty;
  });

  return changed ? { ...input, exercises } : input;
}

export function assignServerOwnedExerciseIds(
  generationId: string,
  type: ExerciseType,
  exercises: readonly Exercise[],
): Exercise[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    id: `${generationId}-${type}-${index + 1}`,
  }));
}

export function interleaveExerciseBatches(
  batches: Readonly<Record<ExerciseType, readonly Exercise[]>>,
): Exercise[] {
  const maxLength = Math.max(
    ...EXERCISE_TRANSPORT_BUCKETS.map((type) => batches[type].length),
  );
  const exercises: Exercise[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    for (const type of EXERCISE_TRANSPORT_BUCKETS) {
      const exercise = batches[type][index];
      if (exercise !== undefined) exercises.push(exercise);
    }
  }
  return exercises;
}
