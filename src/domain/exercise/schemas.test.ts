import { describe, expect, it } from "vitest";
import {
  exerciseSchema,
  exerciseSubmissionSchema,
  publicExerciseSchema,
  toPublicExercise,
  type Exercise,
} from ".";

const base = {
  id: "exercise-1",
  lessonId: "lesson-1",
  question: "What does available mean?",
  sourceSegmentIds: ["segment-1"],
};

describe("exercise schemas", () => {
  it("accepts and sanitizes every exercise variant", () => {
    const exercises: Exercise[] = [
      { ...base, type: "multiple-choice", options: ["Busy", "Free"], correctAnswer: "Free" },
      { ...base, id: "exercise-2", type: "fill-blank", sentence: "Are you ___?", correctAnswer: "available" },
      { ...base, id: "exercise-3", type: "translation", sourceText: "Bạn có rảnh không?", sourceLanguage: "vi", targetLanguage: "en", expectedAnswer: "Are you available?" },
      { ...base, id: "exercise-4", type: "listening", startTimeSeconds: 1, endTimeSeconds: 3, expectedAnswer: "available" },
      { ...base, id: "exercise-5", type: "dictation", startTimeSeconds: 4, endTimeSeconds: 7, expectedAnswer: "I am available." },
    ];

    exercises.forEach((exercise) => {
      expect(exerciseSchema.safeParse(exercise).success).toBe(true);
      const publicExercise = toPublicExercise(exercise);
      expect(publicExerciseSchema.safeParse(publicExercise).success).toBe(true);
      expect(publicExercise).not.toHaveProperty("correctAnswer");
      expect(publicExercise).not.toHaveProperty("expectedAnswer");
    });
  });

  it("requires one exact multiple-choice answer among unique options", () => {
    expect(exerciseSchema.safeParse({ ...base, type: "multiple-choice", options: ["Busy", "Free"], correctAnswer: "Missing" }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...base, type: "multiple-choice", options: ["Free", "Free"], correctAnswer: "Free" }).success).toBe(false);
  });

  it("rejects empty submissions and invalid time bounds", () => {
    expect(exerciseSubmissionSchema.safeParse({ answer: "  " }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...base, type: "dictation", startTimeSeconds: 4, endTimeSeconds: 4, expectedAnswer: "text" }).success).toBe(false);
  });
});
