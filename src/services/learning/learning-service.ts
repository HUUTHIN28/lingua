import { randomUUID } from "node:crypto";
import type { GenerationRequest, LearningGenerationJob } from "@/domain/job";
import type { CreateVideoInput, YouTubeVideo } from "@/domain/video";
import type { GeneratedLesson, PublicLesson } from "@/domain/lesson";
import type { ExerciseCheckResult } from "@/domain/exercise";
import { toPublicExercises } from "@/domain/exercise";
import { DEMO_USER_ID, type ExerciseAttemptState, type LessonAssessmentReport, type LessonProgress, type VideoProgress } from "@/domain/progress";
import { publicLessonSchema } from "@/domain/lesson";
import type { JobRepository, LearningRepository, ProgressRepository, VideoRepository } from "@/repositories/types";
import type { GenerationScheduler } from "./generation-scheduler";
import { VideoService } from "@/services/video/video-service";
import { ApplicationError, notFound } from "./errors";
import { expectedAnswer, scoreExercise } from "./exercise-scoring";
import { hashProcessingKey, serializeLevel } from "./processing-key";
import { PROMPT_VERSION } from "@/ai/prompts/versions";
import { buildLessonAssessment } from "./lesson-assessment";
import type { TranscriptSource } from "@/domain/transcript";

export type GenerationResult = {
  video: YouTubeVideo;
  job: LearningGenerationJob;
  reused: boolean;
};

export class LearningService {
  constructor(
    private readonly videoService: VideoService,
    private readonly videos: VideoRepository,
    private readonly learning: LearningRepository,
    private readonly progress: ProgressRepository,
    private readonly jobs: JobRepository,
    private readonly scheduler: GenerationScheduler,
    private readonly aiProviderIdentity: string,
    private readonly transcriptProviderIdentity: string,
    private readonly transcriptSource: TranscriptSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createVideoAndGenerate(input: CreateVideoInput): Promise<GenerationResult> {
    const video = await this.videoService.create(input);
    return this.generate(video.id, { scope: "lesson", force: false });
  }

  private keyFor(video: YouTubeVideo) {
    return hashProcessingKey({
      youtubeVideoId: video.youtubeVideoId,
      transcriptVersion: this.transcriptProviderIdentity,
      learningLanguage: video.learningLanguage,
      nativeLanguage: video.nativeLanguage,
      targetLevel: serializeLevel(video.targetLevel),
      learningFocus: video.learningFocus,
      aiProviderIdentity: this.aiProviderIdentity,
      promptVersion: PROMPT_VERSION,
    });
  }

  async generate(videoId: string, request: GenerationRequest): Promise<GenerationResult> {
    let video = await this.videoService.get(videoId);
    const latest = await this.jobs.getLatestForVideo(video.id);
    if (latest && latest.status !== "completed" && latest.status !== "failed") {
      throw new ApplicationError("CONFLICT", "Video đang được xử lý.", 409);
    }
    if (request.scope === "exercises" && !video.lessonId) {
      throw new ApplicationError("CONFLICT", "Cần tạo bài học trước khi tạo lại bài tập.", 409);
    }

    const processingKey = this.keyFor(video);
    if (request.scope === "lesson" && !request.force) {
      const cachedLessonId = await this.learning.getCachedLessonId(processingKey);
      const cached = cachedLessonId ? await this.learning.getLesson(cachedLessonId) : null;
      if (cached && cached.videoId === video.id && latest?.status === "completed") {
        video = await this.videos.save({
          ...video,
          lessonId: cached.id,
          status: "ready",
          processingProgress: 100,
          errorMessage: null,
          updatedAt: this.now().toISOString(),
        });
        return { video, job: latest, reused: true };
      }
    }

    const timestamp = this.now().toISOString();
    const lessonId = request.scope === "exercises" ? video.lessonId! : randomUUID();
    const job: LearningGenerationJob = {
      id: randomUUID(),
      videoId: video.id,
      lessonId: request.scope === "exercises" ? lessonId : null,
      status: "pending",
      progress: 0,
      currentStep: "Đang chờ xử lý",
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    await this.jobs.save(job);
    video = await this.videos.save({
      ...video,
      status: "pending",
      processingProgress: 0,
      errorMessage: null,
      updatedAt: timestamp,
    });
    this.scheduler.schedule({
      jobId: job.id,
      scope: request.scope,
      processingKey,
      lessonId,
      existingLessonId: video.lessonId,
    });
    return { video, job, reused: false };
  }

  async getVideoWithJob(videoId: string) {
    const video = await this.videoService.get(videoId);
    const job = await this.jobs.getLatestForVideo(videoId);
    return { video, job, transcriptMode: this.transcriptSource === "demo" ? "demo" as const : "youtube" as const };
  }

  private emptyProgress(lessonId: string, total: number, timestamp: string): LessonProgress {
    return {
      userId: DEMO_USER_ID,
      lessonId,
      completed: false,
      score: 0,
      completedExercises: 0,
      totalExercises: total,
      answeredExerciseIds: [],
      lastStudiedAt: timestamp,
    };
  }

  private async assessmentFor(
    lesson: GeneratedLesson,
    progress: LessonProgress,
  ): Promise<LessonAssessmentReport | null> {
    if (!progress.completed) return null;
    const attempts = await this.progress.getAttempts(lesson.id);
    if (lesson.exercises.some((exercise) => !(attempts.get(exercise.id)?.length))) return null;
    return buildLessonAssessment(lesson, attempts);
  }

  private async exerciseStatesFor(lessonId: string): Promise<ExerciseAttemptState[]> {
    const attempts = await this.progress.getAttempts(lessonId);
    return [...attempts.entries()].flatMap(([exerciseId, history]) => {
      const first = history[0];
      const latest = history.at(-1);
      return first && latest ? [{
        exerciseId,
        attemptCount: history.length,
        firstAttemptCorrect: first.correct,
        latestCorrect: latest.correct,
      }] : [];
    });
  }

  async getPublicLesson(lessonId: string): Promise<{ lesson: PublicLesson; progress: LessonProgress; exerciseStates: ExerciseAttemptState[]; assessment: LessonAssessmentReport | null }> {
    const internal = await this.learning.getLesson(lessonId);
    if (!internal) throw notFound("bài học");
    const lesson = publicLessonSchema.parse({ ...internal, exercises: toPublicExercises(internal.exercises) });
    const progress = await this.progress.get(lessonId) ?? this.emptyProgress(lessonId, internal.exercises.length, internal.createdAt);
    const exerciseStates = await this.exerciseStatesFor(lessonId);
    const assessment = await this.assessmentFor(internal, progress);
    return { lesson, progress, exerciseStates, assessment };
  }

  async checkExercise(lessonId: string, exerciseId: string, answer: string) {
    const lesson = await this.learning.getLesson(lessonId);
    if (!lesson) throw notFound("bài học");
    const exercise = lesson.exercises.find((candidate) => candidate.id === exerciseId);
    if (!exercise) throw notFound("bài tập");
    if (!answer.trim()) throw new ApplicationError("VALIDATION_ERROR", "Vui lòng nhập câu trả lời.", 400, { answer: ["Câu trả lời không được để trống."] });
    const correct = scoreExercise(exercise, answer);
    const progress = await this.progress.recordAnswer(
      lesson.id,
      exercise.id,
      { answer, correct },
      lesson.exercises.length,
    );
    const result: ExerciseCheckResult = {
      exerciseId,
      correct,
      submittedAnswer: answer,
      expectedAnswer: expectedAnswer(exercise),
      explanation: exercise.explanation ?? (correct ? "Câu trả lời chính xác." : "Hãy so sánh với đáp án mẫu."),
      completedExercises: progress.completedExercises,
      totalExercises: progress.totalExercises,
      score: progress.score,
    };
    const assessment = await this.assessmentFor(lesson, progress);
    const exerciseStates = await this.exerciseStatesFor(lesson.id);
    return { result, progress, exerciseStates, assessment };
  }

  async getProgressOverview(): Promise<{ lessons: LessonProgress[]; videos: VideoProgress[] }> {
    const lessons = await this.progress.list();
    const progressByLesson = new Map(lessons.map((item) => [item.lessonId, item]));
    const videos = (await this.videos.list())
      .filter((video) => video.lessonId !== null)
      .map((video): VideoProgress => {
        const lessonProgress = progressByLesson.get(video.lessonId!);
        const completedExercises = lessonProgress?.completedExercises ?? 0;
        const totalExercises = lessonProgress?.totalExercises ?? 0;
        return {
          userId: DEMO_USER_ID,
          videoId: video.id,
          progressPercent: totalExercises === 0 ? 0 : Math.round((completedExercises / totalExercises) * 100),
          completedLessons: lessonProgress?.completed ? 1 : 0,
          totalLessons: 1,
          lastPositionSeconds: null,
          lastStudiedAt: lessonProgress?.lastStudiedAt ?? null,
        };
      });
    return { lessons, videos };
  }
}
