import { describe, expect, it } from "vitest";
import { ApplicationError, errorResponse } from "@/services/learning/errors";
import { validateLessonTraceability } from "./validate-traceability";

const DUPLICATE_MODEL_ID_SENTINEL = "DUPLICATE_MODEL_ID_SENTINEL";
const ORPHAN_MODEL_ID_SENTINEL = "ORPHAN_MODEL_ID_SENTINEL";

const hostileLesson = {
  id: "lesson-1",
  videoId: "video-1",
  title: "Lesson",
  description: "Description",
  summary: "Summary",
  level: { system: "CEFR", value: "B1" },
  learningFocus: "comprehensive",
  transcriptSource: "demo",
  transcriptProvenance: {
    kind: "demo", sourceLanguage: "en", captionFormat: null, translationKind: "demo",
    nativeLanguage: "vi", model: null, strategyVersion: "test-demo", durationSeconds: 2,
    coverage: { attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 2 }], firstSpeechSeconds: 0, lastSpeechSeconds: 2, method: "demo" },
  },
  sections: [{
    id: "section-1",
    title: "Section",
    summary: "Summary",
    startTimeSeconds: 0,
    endTimeSeconds: 2,
    order: 0,
    sourceSegmentIds: ["segment-1"],
  }],
  transcript: [{
    id: "segment-1",
    videoId: "video-1",
    startTimeSeconds: 0,
    endTimeSeconds: 2,
    text: "Hello world.",
    translation: "Xin chào thế giới.",
  }],
  vocabulary: [
    {
      id: DUPLICATE_MODEL_ID_SENTINEL,
      word: "hello",
      meaning: "a greeting",
      translation: "xin chào",
      exampleSentence: "Hello world.",
      exampleTranslation: "Xin chào thế giới.",
      sourceSegmentIds: ["segment-1"],
    },
    {
      id: DUPLICATE_MODEL_ID_SENTINEL,
      word: "world",
      meaning: "the earth",
      translation: "thế giới",
      exampleSentence: "Hello world.",
      exampleTranslation: "Xin chào thế giới.",
      sourceSegmentIds: [ORPHAN_MODEL_ID_SENTINEL],
    },
  ],
  grammar: [],
  exercises: [{
    id: "exercise-1",
    lessonId: "lesson-1",
    type: "multiple-choice",
    question: "Choose hello.",
    options: ["hello", "goodbye"],
    correctAnswer: "hello",
    sourceSegmentIds: ["segment-1"],
  }],
  promptVersion: "test-v1",
  processingKey: "processing-key",
  createdAt: "2026-10-06T00:00:00.000Z",
};

describe("validateLessonTraceability", () => {
  it("keeps hostile generated validation details internal", async () => {
    const internalIssues: Array<{ message: string }> = [];
    let thrown: unknown;

    try {
      validateLessonTraceability(hostileLesson, (issues) => {
        internalIssues.push(...issues);
      });
    } catch (error) {
      thrown = error;
    }

    expect(internalIssues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      `ID trùng lặp: ${DUPLICATE_MODEL_ID_SENTINEL}`,
      `Không tìm thấy transcript segment: ${ORPHAN_MODEL_ID_SENTINEL}`,
    ]));
    expect(thrown).toBeInstanceOf(ApplicationError);
    expect(thrown).toMatchObject({
      code: "INVALID_GENERATED_CONTENT",
      message: "Nội dung tạo tự động không hợp lệ sau khi kiểm tra.",
      status: 422,
    });
    expect((thrown as ApplicationError).fieldErrors).toBeUndefined();

    const serializedError = JSON.stringify(thrown);
    expect(serializedError).not.toContain("fieldErrors");
    expect(serializedError).not.toContain(DUPLICATE_MODEL_ID_SENTINEL);
    expect(serializedError).not.toContain(ORPHAN_MODEL_ID_SENTINEL);

    const response = errorResponse(thrown);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_GENERATED_CONTENT",
        message: "Nội dung tạo tự động không hợp lệ sau khi kiểm tra.",
      },
    });
  });
});
