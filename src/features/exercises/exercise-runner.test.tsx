import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicExercise } from "@/domain/exercise";
import type { ExerciseAttemptState, LessonProgress } from "@/domain/progress";
import { ExerciseRunner } from "./exercise-runner";

vi.mock("@/features/learning/hooks", () => ({
  useCheckExercise: () => ({ isSuccess: false, isPending: false, isError: false, data: undefined, error: null, mutate: vi.fn(), reset: vi.fn() }),
}));
afterEach(cleanup);

const exercises: PublicExercise[] = [
  { id: "mc-1", lessonId: "lesson-1", type: "multiple-choice", question: "MC one?", options: ["A", "B"], sourceSegmentIds: ["s1"] },
  { id: "blank-1", lessonId: "lesson-1", type: "fill-blank", question: "Blank one?", sentence: "A ___", sourceSegmentIds: ["s1"] },
  { id: "mc-2", lessonId: "lesson-1", type: "multiple-choice", question: "MC two?", options: ["C", "D"], sourceSegmentIds: ["s1"] },
  { id: "blank-2", lessonId: "lesson-1", type: "fill-blank", question: "Blank two?", sentence: "B ___", sourceSegmentIds: ["s1"] },
];
const progress: LessonProgress = { userId: "demo-user", lessonId: "lesson-1", completed: false, score: 0, completedExercises: 0, totalExercises: 4, answeredExerciseIds: [], lastStudiedAt: "2026-10-06T00:00:00.000Z" };
const transcript = [{ id: "s1", videoId: "video-1", startTimeSeconds: 0, endTimeSeconds: 5, text: "Source", translation: "Nguồn" }];

const renderRunner = (exerciseStates: ExerciseAttemptState[] = [], currentProgress = progress) => render(<ExerciseRunner exercises={exercises} transcript={transcript} progress={currentProgress} exerciseStates={exerciseStates} assessment={null} lessonId="lesson-1" videoId="video-1" />);

describe("ExerciseRunner", () => {
  it("navigates inside the selected type and shows a local count", () => {
    renderRunner();
    expect(screen.getByText("Trắc nghiệm · Câu 1/2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Câu tiếp" }));
    expect(screen.getByText("MC two?")).toBeInTheDocument();
    expect(screen.getByText("Trắc nghiệm · Câu 2/2")).toBeInTheDocument();
    expect(screen.queryByText("Blank one?")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dạng bài tập"), { target: { value: "fill-blank" } });
    expect(screen.getByText("Điền vào chỗ trống · Câu 1/2")).toBeInTheDocument();
  });

  it("shows first-attempt score semantics and latest-attempt symbols", () => {
    renderRunner([
      { exerciseId: "mc-1", attemptCount: 2, firstAttemptCorrect: false, latestCorrect: true },
      { exerciseId: "mc-2", attemptCount: 1, firstAttemptCorrect: true, latestCorrect: false },
    ], { ...progress, completedExercises: 2, answeredExerciseIds: ["mc-1", "mc-2"], score: 50 });
    expect(screen.getByText("Đúng 1/2 câu đã trả lời")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Trắc nghiệm câu 1, lần gần nhất đúng/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Trắc nghiệm câu 2, lần gần nhất sai/).length).toBeGreaterThan(0);
  });

  it("does not show zero as a score before any answer", () => {
    renderRunner();
    expect(screen.getByText("Chưa có điểm")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
