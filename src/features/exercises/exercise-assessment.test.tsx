import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LessonAssessmentReport } from "@/domain/progress";
import { ExerciseAssessment } from "./exercise-assessment";

const mixed: LessonAssessmentReport = {
  lessonId: "lesson-1",
  score: 70,
  correctExercises: 7,
  totalExercises: 10,
  band: "developing",
  summary: "Bạn đã nắm được một phần nội dung.",
  byType: [{ type: "listening", label: "Nghe hiểu", correct: 1, total: 4, score: 25 }],
  mistakes: [{
    exerciseId: "listen-1", type: "listening", typeLabel: "Nghe hiểu", question: "Bạn nghe thấy địa điểm nào?",
    submittedAnswer: "station", expectedAnswer: "the cafe near the station", explanation: "Nghe lại cụm chỉ địa điểm.",
    attemptCount: 2, resolvedAfterRetry: true,
  }],
  recommendations: [{
    type: "listening", label: "Ưu tiên Nghe hiểu", priority: "high",
    observation: "Câu trả lời đầu tiên chưa khớp đáp án mẫu ở 3/4 câu nghe hiểu.", evidenceExerciseIds: ["listen-1"],
    studyTopics: ["Từ khóa và chi tiết trong câu nghe"], actions: ["Nghe lại đúng đoạn thời gian."],
  }],
};

describe("ExerciseAssessment", () => {
  it("shows score, evidence, retry resolution, and concrete study actions", () => {
    render(<ExerciseAssessment assessment={mixed} />);
    expect(screen.getByRole("heading", { name: "Đang tiến bộ" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tổng điểm 70 phần trăm")).toBeInTheDocument();
    expect(screen.getByText("station")).toBeInTheDocument();
    expect(screen.getByText("the cafe near the station")).toBeInTheDocument();
    expect(screen.getByText("Đã sửa đúng sau khi thử lại")).toBeInTheDocument();
    expect(screen.getByText("Từ khóa và chi tiết trong câu nghe")).toBeInTheDocument();
    expect(screen.getByText("Nghe lại đúng đoạn thời gian.")).toBeInTheDocument();
  });

  it("renders an explicit perfect state", () => {
    render(<ExerciseAssessment assessment={{
      ...mixed,
      score: 100,
      correctExercises: 10,
      band: "strong",
      mistakes: [],
      recommendations: [{ type: null, label: "Duy trì kết quả", priority: "maintenance", observation: "Đã đúng toàn bộ.", evidenceExerciseIds: [], studyTopics: ["Ôn giãn cách"], actions: ["Ôn lại sau một tuần."] }],
    }} />);
    expect(screen.getByRole("heading", { name: "Nắm khá chắc" })).toBeInTheDocument();
    expect(screen.getByText(/Không có câu sai ở lần làm đầu tiên/)).toBeInTheDocument();
    expect(screen.getByText("Ôn lại sau một tuần.")).toBeInTheDocument();
  });
});
