import type { ProcessingStatus } from "@/domain/job";
import type { GeneratedLesson } from "@/domain/lesson";
import type { JobRepository, LearningRepository, ProgressRepository, VideoRepository } from "@/repositories/types";
import { LearningGenerationPipeline } from "@/ai/pipeline/learning-generation-pipeline";
import { ApplicationError } from "./errors";

export type GenerationTask = {
  jobId: string;
  scope: "lesson" | "exercises";
  processingKey: string;
  lessonId: string;
  existingLessonId: string | null;
};

const stepNames: Record<ProcessingStatus, string> = {
  pending: "Đang chờ xử lý",
  "fetching-transcript": "Đang lấy transcript",
  analyzing: "Đang phân tích nội dung",
  "generating-vocabulary": "Đang tạo từ vựng",
  "generating-grammar": "Đang tạo ngữ pháp",
  "generating-lesson": "Đang xây dựng bài học",
  "generating-exercises": "Đang tạo bài tập",
  completed: "Hoàn tất",
  failed: "Xử lý thất bại",
};

export class GenerationRunner {
  constructor(
    private readonly jobs: JobRepository,
    private readonly videos: VideoRepository,
    private readonly learning: LearningRepository,
    private readonly progress: ProgressRepository,
    private readonly pipeline: LearningGenerationPipeline,
    private readonly stageDelayMs = 0,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async wait() {
    if (this.stageDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.stageDelayMs));
    }
  }

  private async transition(jobId: string, status: ProcessingStatus, progress: number) {
    await this.wait();
    const job = await this.jobs.get(jobId);
    if (!job) throw new ApplicationError("NOT_FOUND", "Không tìm thấy tác vụ xử lý.", 404);
    const timestamp = this.now().toISOString();
    await this.jobs.save({
      ...job,
      status,
      progress,
      currentStep: stepNames[status],
      error: null,
      updatedAt: timestamp,
      completedAt: status === "completed" ? timestamp : null,
    });
    const video = await this.videos.get(job.videoId);
    if (video) {
      await this.videos.save({
        ...video,
        status: status === "completed" ? "ready" : status === "failed" ? "failed" : status === "pending" ? "pending" : "processing",
        processingProgress: progress,
        errorMessage: null,
        updatedAt: timestamp,
      });
    }
  }

  async run(task: GenerationTask): Promise<void> {
    const job = await this.jobs.get(task.jobId);
    if (!job) return;
    const video = await this.videos.get(job.videoId);
    if (!video) return;

    try {
      let result: { transcript: GeneratedLesson["transcript"]; lesson: GeneratedLesson };
      if (task.scope === "exercises") {
        const existing = task.existingLessonId
          ? await this.learning.getLesson(task.existingLessonId)
          : null;
        if (!existing) throw new ApplicationError("NOT_FOUND", "Không tìm thấy bài học để tạo lại bài tập.", 404);
        result = await this.pipeline.regenerateExercises(
          {
            video,
            processingKey: task.processingKey,
            lessonId: existing.id,
            generationId: task.jobId,
            onStage: (status, progress) => this.transition(task.jobId, status, progress),
          },
          existing,
        );
      } else {
        result = await this.pipeline.generateLesson({
          video,
          processingKey: task.processingKey,
          lessonId: task.lessonId,
          generationId: task.jobId,
          onStage: (status, progress) => this.transition(task.jobId, status, progress),
        });
      }

      await this.learning.saveTranscript(video.id, result.transcript);
      await this.learning.saveLesson(result.lesson);
      await this.learning.setCachedLessonId(task.processingKey, result.lesson.id);
      await this.progress.reset(result.lesson.id, result.lesson.exercises.length);
      if (task.scope === "lesson" && task.existingLessonId && task.existingLessonId !== result.lesson.id) {
        await this.learning.deleteLesson(task.existingLessonId);
        await this.progress.deleteByLesson(task.existingLessonId);
      }
      const currentVideo = await this.videos.get(video.id);
      if (currentVideo) {
        await this.videos.save({
          ...currentVideo,
          lessonId: result.lesson.id,
          detectedLanguage: currentVideo.learningLanguage,
          updatedAt: this.now().toISOString(),
        });
      }
      const currentJob = await this.jobs.get(task.jobId);
      if (currentJob) {
        await this.jobs.save({ ...currentJob, lessonId: result.lesson.id });
      }
      await this.transition(task.jobId, "completed", 100);
    } catch (error) {
      const current = await this.jobs.get(task.jobId);
      const message = error instanceof ApplicationError
        ? error.message
        : "Không thể tạo bài học. Vui lòng thử lại.";
      if (current) {
        const timestamp = this.now().toISOString();
        await this.jobs.save({
          ...current,
          status: "failed",
          progress: current.progress,
          currentStep: stepNames.failed,
          error: message,
          updatedAt: timestamp,
          completedAt: timestamp,
        });
        const failedVideo = await this.videos.get(current.videoId);
        if (failedVideo) {
          await this.videos.save({
            ...failedVideo,
            status: "failed",
            errorMessage: message,
            updatedAt: timestamp,
          });
        }
      }
    }
  }
}
