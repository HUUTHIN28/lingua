import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Exercise, ExerciseType } from "@/domain/exercise";
import type { LearningFocus } from "@/domain/language";
import { FOCUS_EXERCISE_DISTRIBUTION } from "@/ai/prompts/generation-policy";
import {
  EXERCISE_TRANSPORT_BUCKETS,
  assignServerOwnedExerciseIds,
  exerciseBatchTransportSchema,
  exerciseListSchemaForFocus,
  interleaveExerciseBatches,
  normalizeAutoLevelExerciseDifficulty,
} from "./exercise-generation-contract";

const base = (type: ExerciseType, ordinal: number) => ({
  id: `${type}-${ordinal}`,
  lessonId: "lesson-1",
  type,
  question: `${type} question ${ordinal}`,
  explanation: `${type} explanation ${ordinal}`,
  sourceSegmentIds: ["segment-1"],
});

function exerciseFor(type: ExerciseType, ordinal: number): Exercise {
  switch (type) {
    case "multiple-choice":
      return { ...base(type, ordinal), type, options: ["wrong", `correct-${ordinal}`], correctAnswer: `correct-${ordinal}` };
    case "fill-blank":
      return { ...base(type, ordinal), type, sentence: `Complete _____ ${ordinal}`, correctAnswer: `answer-${ordinal}` };
    case "translation":
      return { ...base(type, ordinal), type, sourceText: `Nguồn ${ordinal}`, sourceLanguage: "vi", targetLanguage: "en", expectedAnswer: `Source ${ordinal}` };
    case "listening":
    case "dictation":
      return { ...base(type, ordinal), type, startTimeSeconds: ordinal * 10, endTimeSeconds: ordinal * 10 + 4, expectedAnswer: `heard-${ordinal}` };
  }
}

const batchesFor = (focus: LearningFocus): Record<ExerciseType, Exercise[]> => {
  const distribution = FOCUS_EXERCISE_DISTRIBUTION[focus];
  return Object.fromEntries(EXERCISE_TRANSPORT_BUCKETS.map((type) => [
    type,
    Array.from({ length: distribution[type] }, (_, index) => exerciseFor(type, index)),
  ])) as Record<ExerciseType, Exercise[]>;
};

describe("exercise generation transport contract", () => {
  it.each(EXERCISE_TRANSPORT_BUCKETS)("emits one strict exact %s batch schema", (type) => {
    const schema = z.toJSONSchema(exerciseBatchTransportSchema(type, 5), {
      target: "draft-7",
    }) as Record<string, unknown>;
    expect(schema).toMatchObject({
      type: "object",
      required: ["exercises"],
      additionalProperties: false,
    });
    expect(Object.keys(schema.properties as object)).toEqual(["exercises"]);
    expect((schema.properties as { exercises: Record<string, unknown> }).exercises)
      .toMatchObject({ type: "array", minItems: 5, maxItems: 5 });
    const serialized = JSON.stringify(schema);
    expect(serialized).toContain(`"const":"${type}"`);
    expect(serialized).not.toContain('"prefixItems"');
  });

  it("rejects extra roots, wrong count, and the wrong item type", () => {
    const schema = exerciseBatchTransportSchema("translation", 2);
    const valid = { exercises: [exerciseFor("translation", 0), exerciseFor("translation", 1)] };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, extra: [] }).success).toBe(false);
    expect(schema.safeParse({ exercises: valid.exercises.slice(0, 1) }).success).toBe(false);
    expect(schema.safeParse({ exercises: [exerciseFor("fill-blank", 0), valid.exercises[1]] }).success).toBe(false);
  });

  it.each([
    ["comprehensive", 42],
    ["speaking", 38],
    ["listening", 40],
    ["grammar", 35],
  ] as const)("interleaves and validates the exact %s distribution (%i)", (focus, total) => {
    const exercises = interleaveExerciseBatches(batchesFor(focus));
    expect(exercises).toHaveLength(total);
    expect(exerciseListSchemaForFocus(focus).safeParse(exercises).success).toBe(true);
    expect(exercises.slice(0, 5).map((exercise) => exercise.type)).toEqual(EXERCISE_TRANSPORT_BUCKETS);
  });

  it("rejects a missing item, extra item, and duplicate id in the full list", () => {
    const exercises = interleaveExerciseBatches(batchesFor("comprehensive"));
    expect(exerciseListSchemaForFocus("comprehensive").safeParse(exercises.slice(0, -1)).success).toBe(false);
    expect(exerciseListSchemaForFocus("comprehensive").safeParse([...exercises, exerciseFor("dictation", 99)]).success).toBe(false);
    const duplicate = exercises.map((exercise, index) => index === 1 ? { ...exercise, id: exercises[0].id } : exercise);
    expect(exerciseListSchemaForFocus("comprehensive").safeParse(duplicate).success).toBe(false);
  });

  it("normalizes invalid Auto difficulty without mutation and preserves valid difficulty", () => {
    const valid = exerciseFor("multiple-choice", 0);
    const invalid = { ...exerciseFor("multiple-choice", 1), difficulty: { system: "AUTO", value: "Auto" } };
    const providerOutput = { exercises: [valid, invalid] };
    const before = structuredClone(providerOutput);
    const normalized = normalizeAutoLevelExerciseDifficulty(providerOutput, null);
    expect(providerOutput).toEqual(before);
    expect(normalized).toEqual({ exercises: [valid, { ...invalid, difficulty: undefined }] });
    expect(normalized).not.toBe(providerOutput);

    const fixed = normalizeAutoLevelExerciseDifficulty(providerOutput, { system: "CEFR", value: "B1" });
    expect(fixed).toBe(providerOutput);
    expect(exerciseBatchTransportSchema("multiple-choice", 2).safeParse(fixed).success).toBe(false);
  });

  it("replaces duplicate model ids with deterministic unique server ids", () => {
    const modelExercises = [exerciseFor("listening", 0), exerciseFor("listening", 1)]
      .map((exercise) => ({ ...exercise, id: "duplicate-model-id" }));
    const assigned = assignServerOwnedExerciseIds("generation-1", "listening", modelExercises);
    expect(assigned.map((exercise) => exercise.id)).toEqual([
      "generation-1-listening-1",
      "generation-1-listening-2",
    ]);
    expect(modelExercises.every((exercise) => exercise.id === "duplicate-model-id")).toBe(true);
  });

  it("separates short listening answers from verbatim dictation", () => {
    const transcript = [{ id: "segment-1", videoId: "video-1", startTimeSeconds: 0, endTimeSeconds: 5, text: "Meet me at the station.", translation: "Gặp tôi ở nhà ga." }];
    const listening = exerciseFor("listening", 0);
    const dictation = exerciseFor("dictation", 0);
    expect(exerciseBatchTransportSchema("listening", 1, transcript).safeParse({ exercises: [{ ...listening, expectedAnswer: "the station" }] }).success).toBe(true);
    expect(exerciseBatchTransportSchema("listening", 1, transcript).safeParse({ exercises: [{ ...listening, expectedAnswer: "Meet me at the station." }] }).success).toBe(false);
    expect(exerciseBatchTransportSchema("dictation", 1, transcript).safeParse({ exercises: [{ ...dictation, expectedAnswer: "Meet me at the station." }] }).success).toBe(true);
    expect(exerciseBatchTransportSchema("dictation", 1, transcript).safeParse({ exercises: [{ ...dictation, expectedAnswer: "the station" }] }).success).toBe(false);
  });
});
