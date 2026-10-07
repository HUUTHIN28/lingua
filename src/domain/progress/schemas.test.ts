import { describe, expect, it } from "vitest";
import { lessonAssessmentReportSchema } from "./schemas";

const valid = {
  lessonId: "lesson-1",
  score: 50,
  correctExercises: 1,
  totalExercises: 2,
  band: "developing",
  summary: "Bạn đang tiến bộ.",
  byType: [{ type: "listening", label: "Nghe hiểu", correct: 1, total: 2, score: 50 }],
  mistakes: [{ exerciseId: "one", type: "listening", typeLabel: "Nghe hiểu", question: "Listen", submittedAnswer: "x", expectedAnswer: "y", explanation: "Chưa khớp.", attemptCount: 1, resolvedAfterRetry: false }],
  recommendations: [{ type: "listening", label: "Ưu tiên nghe", priority: "high", observation: "Một câu chưa khớp.", evidenceExerciseIds: ["one"], studyTopics: ["Từ khóa"], actions: ["Nghe lại."] }],
};

describe("lessonAssessmentReportSchema", () => {
  it("accepts a complete public assessment", () => {
    expect(lessonAssessmentReportSchema.parse(valid)).toEqual(valid);
  });

  it("rejects out-of-range scores and empty recommendation actions", () => {
    expect(lessonAssessmentReportSchema.safeParse({ ...valid, score: 101 }).success).toBe(false);
    expect(lessonAssessmentReportSchema.safeParse({
      ...valid,
      recommendations: [{ ...valid.recommendations[0], actions: [] }],
    }).success).toBe(false);
  });
});
