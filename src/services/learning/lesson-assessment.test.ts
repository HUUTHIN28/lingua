import { describe, expect, it } from "vitest";
import type { Exercise } from "@/domain/exercise";
import type { GeneratedLesson } from "@/domain/lesson";
import type { StoredExerciseAttempt } from "@/repositories/memory-store";
import { buildLessonAssessment } from "./lesson-assessment";

const exercises: Exercise[] = [
  { id: "mc-1", lessonId: "lesson-1", type: "multiple-choice", question: "Choose one", options: ["A", "B"], correctAnswer: "A", explanation: "A is grounded in the source.", sourceSegmentIds: ["s1"] },
  { id: "fill-1", lessonId: "lesson-1", type: "fill-blank", question: "Fill one", sentence: "I am _____.", correctAnswer: "ready", explanation: "The missing adjective is ready.", sourceSegmentIds: ["s1"] },
  { id: "translation-1", lessonId: "lesson-1", type: "translation", question: "Translate one", sourceText: "Xin chào", sourceLanguage: "vi", targetLanguage: "en", expectedAnswer: "Hello", explanation: "This is the sample translation.", sourceSegmentIds: ["s1"] },
  { id: "listening-1", lessonId: "lesson-1", type: "listening", question: "Listen one", startTimeSeconds: 0, endTimeSeconds: 1, expectedAnswer: "hello", explanation: "Listen for the greeting.", sourceSegmentIds: ["s1"] },
  { id: "dictation-1", lessonId: "lesson-1", type: "dictation", question: "Write one", startTimeSeconds: 0, endTimeSeconds: 1, expectedAnswer: "Hello there", explanation: "Compare with the source sentence.", sourceSegmentIds: ["s1"] },
];

const lesson = { id: "lesson-1", exercises } as GeneratedLesson;
const attempt = (answer: string, correct: boolean): StoredExerciseAttempt => ({ answer, correct, submittedAt: "2026-10-06T00:00:00.000Z" });

describe("buildLessonAssessment", () => {
  it("uses first attempts, keeps retry resolution, and ranks weak types", () => {
    const attempts = new Map<string, StoredExerciseAttempt[]>([
      ["mc-1", [attempt("B", false), attempt("A", true)]],
      ["fill-1", [attempt("ready", true)]],
      ["translation-1", [attempt("Hi", false)]],
      ["listening-1", [attempt("hello", true)]],
      ["dictation-1", [attempt("Hello", false)]],
    ]);

    const report = buildLessonAssessment(lesson, attempts);
    expect(report).toMatchObject({ score: 40, correctExercises: 2, totalExercises: 5, band: "needs-review" });
    expect(report.byType.map(({ type, score }) => [type, score])).toEqual([
      ["multiple-choice", 0], ["fill-blank", 100], ["translation", 0], ["listening", 100], ["dictation", 0],
    ]);
    expect(report.mistakes[0]).toMatchObject({ exerciseId: "mc-1", submittedAnswer: "B", attemptCount: 2, resolvedAfterRetry: true });
    expect(report.mistakes.map((item) => item.exerciseId)).toEqual(["mc-1", "translation-1", "dictation-1"]);
    expect(report.recommendations).toHaveLength(3);
    expect(report.recommendations.flatMap((item) => item.evidenceExerciseIds).sort()).toEqual(["dictation-1", "mc-1", "translation-1"]);
    expect(JSON.stringify(report)).not.toMatch(/phát âm|độ trôi chảy/i);
  });

  it("returns a maintenance plan for a perfect first attempt", () => {
    const attempts = new Map(exercises.map((exercise) => [exercise.id, [attempt("correct", true)]]));
    const report = buildLessonAssessment(lesson, attempts);
    expect(report).toMatchObject({ score: 100, band: "strong", mistakes: [] });
    expect(report.recommendations).toEqual([
      expect.objectContaining({ type: null, priority: "maintenance", evidenceExerciseIds: [] }),
    ]);
  });

  it("refuses to expose a partial assessment", () => {
    expect(() => buildLessonAssessment(lesson, new Map([
      ["mc-1", [attempt("A", true)]],
    ]))).toThrow(/before every exercise/i);
  });
});
