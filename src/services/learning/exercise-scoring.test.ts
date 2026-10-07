import { describe, expect, it } from "vitest";
import type { Exercise } from "@/domain/exercise";
import { normalizeAnswer, scoreExercise } from "./exercise-scoring";

const base = {
  id: "exercise-1",
  lessonId: "lesson-1",
  question: "Question",
  sourceSegmentIds: ["segment-1"],
};

describe("exercise scoring", () => {
  it("normalizes Unicode, punctuation, case and whitespace for text exercises", () => {
    const exercise: Exercise = { ...base, type: "fill-blank", sentence: "I am ___", correctAnswer: "Available!" };
    expect(scoreExercise(exercise, "  available... ")).toBe(true);
    expect(scoreExercise(exercise, "busy")).toBe(false);
    expect(scoreExercise(exercise, " ")).toBe(false);
    expect(normalizeAnswer(" Ｈello,   WORLD! ")).toBe("hello world");
  });

  it("compares multiple-choice options exactly", () => {
    const exercise: Exercise = { ...base, type: "multiple-choice", options: ["Free", "Busy"], correctAnswer: "Free" };
    expect(scoreExercise(exercise, "Free")).toBe(true);
    expect(scoreExercise(exercise, "free")).toBe(false);
  });
});
