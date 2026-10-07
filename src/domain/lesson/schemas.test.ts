import { describe, expect, it } from "vitest";
import { generatedLessonSchema, publicLessonSchema } from ".";
import {
  createVideoInputSchema,
  updateVideoInputSchema,
  youTubeVideoSchema,
} from "@/domain/video";

const lesson = {
  id: "lesson-1",
  videoId: "video-1",
  title: "Everyday availability",
  description: "A short conversational lesson.",
  summary: "Learn to ask whether somebody is free.",
  level: { system: "CEFR", value: "A2" },
  learningFocus: "comprehensive",
  transcriptSource: "demo",
  transcriptProvenance: {
    kind: "demo", sourceLanguage: "en", captionFormat: null, translationKind: "demo",
    nativeLanguage: "vi", model: null, strategyVersion: "test-demo", durationSeconds: 8,
    coverage: { attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 8 }], firstSpeechSeconds: 0, lastSpeechSeconds: 8, method: "demo" },
  },
  sections: [{ id: "section-1", title: "Planning", summary: "Make a plan.", startTimeSeconds: 0, endTimeSeconds: 8, order: 0, sourceSegmentIds: ["segment-1"] }],
  transcript: [{ id: "segment-1", videoId: "video-1", startTimeSeconds: 0, endTimeSeconds: 8, text: "Are you available tomorrow?", translation: "Ngày mai bạn có rảnh không?" }],
  vocabulary: [{ id: "vocab-1", word: "available", meaning: "free to do something", translation: "rảnh", exampleSentence: "Are you available tomorrow?", exampleTranslation: "Ngày mai bạn có rảnh không?", sourceSegmentIds: ["segment-1"] }],
  grammar: [{ id: "grammar-1", title: "Be + adjective", explanation: "Use be before an adjective.", examples: [{ sentence: "Are you available?", translation: "Bạn có rảnh không?", sourceSegmentId: "segment-1" }], sourceSegmentIds: ["segment-1"] }],
  exercises: [{ id: "exercise-1", lessonId: "lesson-1", type: "multiple-choice", question: "What does available mean?", options: ["Busy", "Free"], correctAnswer: "Free", sourceSegmentIds: ["segment-1"] }],
  promptVersion: "lesson-v1",
  processingKey: "key-1",
  createdAt: "2026-10-06T03:00:00.000Z",
};

describe("generated lesson schema", () => {
  it("accepts a traceable lesson", () => {
    expect(generatedLessonSchema.safeParse(lesson).success).toBe(true);
    expect(publicLessonSchema.safeParse(lesson).success).toBe(true);
  });

  it("requires explicit transcript provenance", () => {
    expect(generatedLessonSchema.parse(lesson).transcriptSource).toBe("demo");
    expect(publicLessonSchema.parse(lesson).transcriptProvenance.kind).toBe("demo");
    expect(generatedLessonSchema.safeParse({ ...lesson, transcriptProvenance: undefined }).success).toBe(false);
    expect(generatedLessonSchema.safeParse({ ...lesson, transcriptSource: "youtube" }).success).toBe(false);
  });

  it("requires a valid learning focus on internal and public lessons", () => {
    const missing = structuredClone(lesson) as Record<string, unknown>;
    delete missing.learningFocus;
    expect(generatedLessonSchema.safeParse(missing).success).toBe(false);
    expect(publicLessonSchema.safeParse(missing).success).toBe(false);

    expect(
      generatedLessonSchema.safeParse({ ...lesson, learningFocus: "vocabulary" }).success,
    ).toBe(false);
  });

  it("rejects orphan source references", () => {
    const invalid = structuredClone(lesson);
    invalid.vocabulary[0].sourceSegmentIds[0] = "missing-segment";
    expect(generatedLessonSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate IDs and cross-video transcript", () => {
    const duplicate = structuredClone(lesson);
    duplicate.transcript.push({ ...duplicate.transcript[0] });
    expect(generatedLessonSchema.safeParse(duplicate).success).toBe(false);

    const wrongVideo = structuredClone(lesson);
    wrongVideo.transcript[0].videoId = "another-video";
    expect(generatedLessonSchema.safeParse(wrongVideo).success).toBe(false);
  });

  it("rejects non-positive time ordering", () => {
    const invalid = structuredClone(lesson);
    invalid.sections[0].endTimeSeconds = 0;
    expect(generatedLessonSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("video learning focus contracts", () => {
  const video = {
    id: "video-1",
    youtubeVideoId: "dQw4w9WgXcQ",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Everyday availability",
    description: null,
    thumbnailUrl: null,
    durationSeconds: null,
    detectedLanguage: null,
    learningLanguage: "en",
    nativeLanguage: "vi",
    targetLevel: null,
    learningFocus: "listening",
    lessonId: null,
    status: "pending",
    processingProgress: 0,
    errorMessage: null,
    createdAt: "2026-10-06T03:00:00.000Z",
    updatedAt: "2026-10-06T03:00:00.000Z",
  };

  it("requires a persisted focus on video records", () => {
    expect(youTubeVideoSchema.safeParse(video).success).toBe(true);

    const missing = structuredClone(video) as Record<string, unknown>;
    delete missing.learningFocus;
    expect(youTubeVideoSchema.safeParse(missing).success).toBe(false);
    expect(youTubeVideoSchema.safeParse({ ...video, learningFocus: "vocabulary" }).success).toBe(false);
  });

  it("defaults legacy create input to comprehensive", () => {
    const parsed = createVideoInputSchema.parse({
      youtubeUrl: video.youtubeUrl,
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: null,
    });
    expect(parsed.learningFocus).toBe("comprehensive");
  });

  it("never applies the create default to an omitted PATCH focus", () => {
    expect(updateVideoInputSchema.parse({ title: "Updated title" })).toEqual({
      title: "Updated title",
    });
    expect(updateVideoInputSchema.safeParse({ learningFocus: "vocabulary" }).success).toBe(false);
  });
});
