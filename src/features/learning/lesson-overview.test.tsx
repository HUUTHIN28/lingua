import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicLesson } from "@/domain/lesson";
import type { LessonProgress } from "@/domain/progress";
import { LessonOverview } from "./lesson-overview";

afterEach(cleanup);
const lesson = {
  id: "lesson-1", videoId: "video-1", title: "Bài học theo ngữ cảnh", description: "Mô tả chi tiết", summary: "Tóm tắt", level: { system: "CEFR", value: "B1" }, learningFocus: "comprehensive", transcriptSource: "demo",
  transcriptProvenance: { kind: "demo", sourceLanguage: "en", captionFormat: null, translationKind: "demo", nativeLanguage: "vi", model: null, strategyVersion: "demo-v1", durationSeconds: 10, coverage: { attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 10 }], firstSpeechSeconds: 0, lastSpeechSeconds: 10, method: "demo" } },
  sections: [
    { id: "s2", title: "Hai", summary: "Hai", startTimeSeconds: 5, endTimeSeconds: 10, order: 2, sourceSegmentIds: ["t1"] },
    { id: "s1", title: "Một", summary: "Một", startTimeSeconds: 0, endTimeSeconds: 5, order: 1, sourceSegmentIds: ["t1"] },
  ],
  transcript: [{ id: "t1", videoId: "video-1", startTimeSeconds: 0, endTimeSeconds: 10, text: "Hello", translation: "Xin chào" }],
  vocabulary: [], grammar: [], exercises: [{ id: "e1", lessonId: "lesson-1", type: "multiple-choice", question: "Hello?", options: ["A", "B"], sourceSegmentIds: ["t1"] }], promptVersion: "v10", processingKey: "key", createdAt: "2026-10-06T00:00:00.000Z",
} satisfies PublicLesson;
const progress: LessonProgress = { userId: "demo-user", lessonId: "lesson-1", completed: false, score: 0, completedExercises: 0, totalExercises: 1, answeredExerciseIds: [], lastStudiedAt: "2026-10-06T00:00:00.000Z" };

describe("LessonOverview", () => {
  it("shows a compact start action and canonical section numbers", () => {
    render(<LessonOverview lesson={lesson} progress={progress} />);
    expect(screen.getByRole("heading", { name: "Bài học theo ngữ cảnh" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bắt đầu học" })).toHaveAttribute("href", "#practice");
    expect(screen.getByText("Phần 1")).toBeInTheDocument();
    expect(screen.getByText("Phần 2")).toBeInTheDocument();
    expect(screen.queryByText(/NZxK3oIxI3Y/)).not.toBeInTheDocument();
    expect(screen.getByText("Xem chi tiết bài học")).toBeInTheDocument();
  });

  it("changes the action after learning has started", () => {
    render(<LessonOverview lesson={lesson} progress={{ ...progress, completedExercises: 1, completed: true }} />);
    expect(screen.getByRole("link", { name: "Tiếp tục học" })).toBeInTheDocument();
  });
});
