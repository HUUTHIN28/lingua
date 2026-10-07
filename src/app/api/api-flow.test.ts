import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore, type MemoryStore } from "@/repositories/memory-store";
import { MemoryVideoRepository } from "@/repositories/video/memory-video-repository";
import { MemoryLearningRepository } from "@/repositories/learning/memory-learning-repository";
import { MemoryProgressRepository } from "@/repositories/progress/memory-progress-repository";
import { MemoryJobRepository } from "@/repositories/job/memory-job-repository";
import { MockTranscriptProvider } from "@/services/transcript/mock-transcript-provider";
import { MockAIProvider } from "@/ai/providers/mock-ai-provider";
import { LearningGenerationPipeline } from "@/ai/pipeline/learning-generation-pipeline";
import { GenerationRunner } from "@/services/learning/generation-runner";
import { ImmediateGenerationScheduler } from "@/services/learning/generation-scheduler";
import { VideoService } from "@/services/video/video-service";
import { LearningService } from "@/services/learning/learning-service";
import { expectedAnswer } from "@/services/learning/exercise-scoring";
import { createVideoInputSchema } from "@/domain/video";
import {
  AIProviderError,
  type AIProvider,
  type StructuredGenerationRequest,
} from "@/ai/providers/ai-provider";

function setupWithProvider<TProvider extends AIProvider>(
  ai: TProvider,
  store: MemoryStore = resetMemoryStore(),
) {
  const videos = new MemoryVideoRepository(store);
  const learning = new MemoryLearningRepository(store);
  const progress = new MemoryProgressRepository(store);
  const jobs = new MemoryJobRepository(store);
  const transcript = new MockTranscriptProvider();
  const pipeline = new LearningGenerationPipeline(transcript, ai, () => new Date("2026-10-06T00:00:00.000Z"));
  const runner = new GenerationRunner(jobs, videos, learning, progress, pipeline, 0, () => new Date("2026-10-06T00:00:00.000Z"));
  const scheduler = new ImmediateGenerationScheduler(runner);
  const videoService = new VideoService(videos, learning, progress, jobs, () => new Date("2026-10-06T00:00:00.000Z"));
  const service = new LearningService(
    videoService,
    videos,
    learning,
    progress,
    jobs,
    scheduler,
    ai.cacheIdentity,
    `${transcript.sourceKind}:${transcript.version}`,
    transcript.sourceKind,
    () => new Date("2026-10-06T00:00:00.000Z"),
  );
  return { videos, learning, progress, jobs, transcript, ai, scheduler, videoService, service };
}

function setup() {
  return setupWithProvider(new MockAIProvider());
}

describe("server application flow", () => {
  beforeEach(() => resetMemoryStore());

  it("creates asynchronously, generates, hides answers, scores, caches and cascades delete", async () => {
    const app = setup();
    const created = await app.service.createVideoAndGenerate({
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: { system: "CEFR", value: "B1" },
      learningFocus: "comprehensive",
    });
    expect(created.job.status).toBe("pending");
    await app.scheduler.waitForIdle();

    const ready = await app.service.getVideoWithJob(created.video.id);
    expect(ready.video.status).toBe("ready");
    expect(ready.job?.status).toBe("completed");
    expect(ready.transcriptMode).toBe("demo");
    expect(ready.video.lessonId).toBeTruthy();

    const publicLesson = await app.service.getPublicLesson(ready.video.lessonId!);
    expect(publicLesson.lesson.exercises).toHaveLength(42);
    expect(JSON.stringify(publicLesson.lesson)).not.toMatch(/correctAnswer|expectedAnswer/);
    expect(publicLesson.progress.completedExercises).toBe(0);
    expect(publicLesson.exerciseStates).toEqual([]);
    expect(publicLesson.lesson.transcriptSource).toBe("demo");
    expect(publicLesson.assessment).toBeNull();
    const exercise = publicLesson.lesson.exercises[0];
    const checked = await app.service.checkExercise(publicLesson.lesson.id, exercise.id, "Free");
    expect(checked.result.correct).toBe(true);
    expect(checked.progress).toMatchObject({ completedExercises: 1, score: 100 });

    const oldExerciseIds = publicLesson.lesson.exercises.map((item) => item.id);
    const regeneration = await app.service.generate(created.video.id, { scope: "exercises", force: true });
    await app.scheduler.waitForIdle();
    const regenerated = await app.service.getPublicLesson(regeneration.video.lessonId!);
    expect(regenerated.lesson.id).toBe(publicLesson.lesson.id);
    expect(regenerated.lesson.exercises.map((item) => item.id)).not.toEqual(oldExerciseIds);
    expect(regenerated.progress.completedExercises).toBe(0);

    const aiCalls = app.ai.invocationCount;
    const reused = await app.service.generate(created.video.id, { scope: "lesson", force: false });
    expect(reused.reused).toBe(true);
    expect(app.ai.invocationCount).toBe(aiCalls);

    await app.videoService.delete(created.video.id);
    await expect(app.videoService.get(created.video.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await app.learning.getLesson(publicLesson.lesson.id)).toBeNull();
    expect(await app.progress.get(publicLesson.lesson.id)).toBeNull();
    expect(await app.jobs.getLatestForVideo(created.video.id)).toBeNull();
  });

  it("records a safe terminal failure without persisting a partial lesson", async () => {
    const app = setup();
    const created = await app.service.createVideoAndGenerate({
      youtubeUrl: "https://www.youtube.com/watch?v=transcript0",
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: null,
      learningFocus: "comprehensive",
    });
    await app.scheduler.waitForIdle();
    const failed = await app.service.getVideoWithJob(created.video.id);
    expect(failed.video.status).toBe("failed");
    expect(failed.job).toMatchObject({ status: "failed", error: expect.stringContaining("transcript") });
    expect(await app.learning.getLessonsByVideo(created.video.id)).toEqual([]);
  });

  it("defaults legacy create focus and separates focused generation caches", async () => {
    const app = setup();
    const legacyInput = createVideoInputSchema.parse({
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: null,
    });
    expect(legacyInput.learningFocus).toBe("comprehensive");

    const created = await app.service.createVideoAndGenerate({ ...legacyInput, learningFocus: "speaking" });
    await app.scheduler.waitForIdle();
    const speakingVideo = (await app.service.getVideoWithJob(created.video.id)).video;
    const speaking = await app.learning.getLesson(speakingVideo.lessonId!);
    expect(speaking).toMatchObject({ learningFocus: "speaking" });
    expect(speaking?.exercises).toHaveLength(38);
    const publicSpeaking = await app.service.getPublicLesson(speaking!.id);
    expect(publicSpeaking.lesson.learningFocus).toBe("speaking");
    expect(publicSpeaking.progress.totalExercises).toBe(38);
    expect(publicSpeaking.assessment).toBeNull();
    expect(JSON.stringify(publicSpeaking.lesson)).not.toMatch(/correctAnswer|expectedAnswer/);

    const aiCalls = app.ai.invocationCount;
    const reused = await app.service.generate(created.video.id, { scope: "lesson", force: false });
    expect(reused.reused).toBe(true);
    expect(app.ai.invocationCount).toBe(aiCalls);

    const [first, ...remaining] = speaking!.exercises;
    const firstWrong = await app.service.checkExercise(speaking!.id, first.id, "definitely wrong");
    expect(firstWrong.assessment).toBeNull();
    expect(firstWrong.exerciseStates).toEqual([{ exerciseId: first.id, attemptCount: 1, firstAttemptCorrect: false, latestCorrect: false }]);
    const corrected = await app.service.checkExercise(speaking!.id, first.id, expectedAnswer(first));
    expect(corrected.exerciseStates).toEqual([{ exerciseId: first.id, attemptCount: 2, firstAttemptCorrect: false, latestCorrect: true }]);
    expect(JSON.stringify(corrected.exerciseStates)).not.toMatch(/answer|expected|submitted/i);
    let finalCheck: Awaited<ReturnType<typeof app.service.checkExercise>> | undefined;
    for (const exercise of remaining) {
      finalCheck = await app.service.checkExercise(speaking!.id, exercise.id, expectedAnswer(exercise));
    }
    expect(await app.progress.get(speaking!.id)).toMatchObject({
      completed: true,
      completedExercises: 38,
      totalExercises: 38,
      score: 97,
    });
    expect(finalCheck?.assessment).toMatchObject({ score: 97, correctExercises: 37, totalExercises: 38 });
    expect(finalCheck?.assessment?.mistakes).toEqual([
      expect.objectContaining({ exerciseId: first.id, submittedAnswer: "definitely wrong", attemptCount: 2, resolvedAfterRetry: true }),
    ]);
    const refreshed = await app.service.getPublicLesson(speaking!.id);
    expect(refreshed.assessment).toEqual(finalCheck?.assessment);
    expect(JSON.stringify(refreshed.lesson)).not.toMatch(/correctAnswer|expectedAnswer/);

    const titleOnly = await app.videoService.update(created.video.id, {
      title: "Focused conversation",
      learningFocus: "speaking",
    });
    expect(titleOnly).toMatchObject({ status: "ready", lessonId: speaking!.id, learningFocus: "speaking" });
    expect(await app.learning.getLesson(speaking!.id)).not.toBeNull();

    const focused = await app.videoService.update(created.video.id, { learningFocus: "listening" });
    expect(focused).toMatchObject({
      learningFocus: "listening",
      status: "pending",
      lessonId: null,
      processingProgress: 0,
    });
    expect(await app.learning.getLesson(speaking!.id)).toBeNull();
    expect(await app.progress.get(speaking!.id)).toBeNull();
    expect(await app.jobs.getLatestForVideo(created.video.id)).toBeNull();
    expect(await app.learning.getCachedLessonId(speaking!.processingKey)).toBeNull();

    const regenerated = await app.service.generate(created.video.id, { scope: "lesson", force: false });
    await app.scheduler.waitForIdle();
    const listening = await app.learning.getLesson((await app.service.getVideoWithJob(created.video.id)).video.lessonId!);
    expect(regenerated.reused).toBe(false);
    expect(listening).toMatchObject({ learningFocus: "listening" });
    expect(listening?.exercises).toHaveLength(40);
    expect(listening?.processingKey).not.toBe(speaking!.processingKey);
    expect(app.ai.invocationCount).toBeGreaterThan(aiCalls);
  });

  it("does not reuse a completed lesson after the provider identity changes", async () => {
    const store = resetMemoryStore();
    const mockApp = setupWithProvider(new MockAIProvider(), store);
    const created = await mockApp.service.createVideoAndGenerate({
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: null,
      learningFocus: "comprehensive",
    });
    await mockApp.scheduler.waitForIdle();
    const before = await mockApp.service.getVideoWithJob(created.video.id);
    const mockLesson = await mockApp.learning.getLesson(before.video.lessonId!);

    const delegate = new MockAIProvider();
    let providerCalls = 0;
    const alternateProvider: AIProvider = {
      cacheIdentity: "openrouter:test-model:json-schema-tool-fallback-v1",
      maxConcurrency: 1,
      async generateStructured<T>(request: StructuredGenerationRequest<T>) {
        providerCalls += 1;
        return delegate.generateStructured(request);
      },
    };
    const openRouterApp = setupWithProvider(alternateProvider, store);
    const generated = await openRouterApp.service.generate(created.video.id, {
      scope: "lesson",
      force: false,
    });
    expect(generated.reused).toBe(false);
    await openRouterApp.scheduler.waitForIdle();

    const after = await openRouterApp.service.getVideoWithJob(created.video.id);
    const providerLesson = await openRouterApp.learning.getLesson(after.video.lessonId!);
    expect(providerCalls).toBeGreaterThan(0);
    expect(providerLesson?.processingKey).not.toBe(mockLesson?.processingKey);
    expect(await openRouterApp.learning.getCachedLessonId(mockLesson!.processingKey)).toBeNull();
  });

  it("persists only a safe terminal error when the AI provider fails", async () => {
    let attempts = 0;
    const failedProvider: AIProvider = {
      cacheIdentity: "openrouter:test-model:json-schema-tool-fallback-v1",
      maxConcurrency: 1,
      async generateStructured() {
        attempts += 1;
        throw new AIProviderError("authentication", {
          status: 401,
          requestId: "request-safe-id",
        });
      },
    };
    const app = setupWithProvider(failedProvider);
    const created = await app.service.createVideoAndGenerate({
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      learningLanguage: "en",
      nativeLanguage: "vi",
      targetLevel: null,
      learningFocus: "comprehensive",
    });
    await app.scheduler.waitForIdle();

    const failed = await app.service.getVideoWithJob(created.video.id);
    expect(attempts).toBe(1);
    expect(failed.video).toMatchObject({ status: "failed", lessonId: null });
    expect(failed.job).toMatchObject({
      status: "failed",
      error: "Không thể xác thực với dịch vụ AI. Vui lòng kiểm tra API key.",
    });
    expect(JSON.stringify(failed)).not.toMatch(/401|request-safe-id|authorization|bearer/i);
    expect(await app.learning.getTranscript(created.video.id)).toBeNull();
    expect(await app.learning.getLessonsByVideo(created.video.id)).toEqual([]);
  });
});
