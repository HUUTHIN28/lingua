import { randomUUID } from "node:crypto";
import type { CreateVideoInput, UpdateVideoInput, YouTubeVideo } from "@/domain/video";
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from "@/lib/youtube";
import type { JobRepository, LearningRepository, ProgressRepository, VideoRepository } from "@/repositories/types";
import { ApplicationError, notFound } from "@/services/learning/errors";

export class VideoService {
  constructor(
    private readonly videos: VideoRepository,
    private readonly learning: LearningRepository,
    private readonly progress: ProgressRepository,
    private readonly jobs: JobRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list() {
    return this.videos.list();
  }

  async get(id: string) {
    const video = await this.videos.get(id);
    if (!video) throw notFound("video");
    return video;
  }

  async create(input: CreateVideoInput): Promise<YouTubeVideo> {
    const youtubeVideoId = extractYouTubeVideoId(input.youtubeUrl);
    if (!youtubeVideoId) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "URL YouTube không hợp lệ hoặc chưa được hỗ trợ.",
        400,
        { youtubeUrl: ["Hỗ trợ URL watch, youtu.be và embed."] },
      );
    }
    const timestamp = this.now().toISOString();
    return this.videos.save({
      id: randomUUID(),
      youtubeVideoId,
      youtubeUrl: input.youtubeUrl.trim(),
      title: "Bài học theo ngữ cảnh",
      description: "Nội dung học được chuẩn bị theo cấu hình bạn đã chọn.",
      thumbnailUrl: getYouTubeThumbnailUrl(youtubeVideoId),
      durationSeconds: null,
      detectedLanguage: null,
      learningLanguage: input.learningLanguage,
      nativeLanguage: input.nativeLanguage,
      targetLevel: input.targetLevel,
      learningFocus: input.learningFocus,
      lessonId: null,
      status: "pending",
      processingProgress: 0,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async update(id: string, input: UpdateVideoInput) {
    const current = await this.get(id);
    let youtubeVideoId = current.youtubeVideoId;
    if (input.youtubeUrl !== undefined) {
      const parsed = extractYouTubeVideoId(input.youtubeUrl);
      if (!parsed) {
        throw new ApplicationError("VALIDATION_ERROR", "URL YouTube không hợp lệ.", 400, {
          youtubeUrl: ["Hỗ trợ URL watch, youtu.be và embed."],
        });
      }
      youtubeVideoId = parsed;
    }
    const generationChanged =
      youtubeVideoId !== current.youtubeVideoId ||
      (input.learningLanguage !== undefined && input.learningLanguage !== current.learningLanguage) ||
      (input.nativeLanguage !== undefined && input.nativeLanguage !== current.nativeLanguage) ||
      (input.targetLevel !== undefined && JSON.stringify(input.targetLevel) !== JSON.stringify(current.targetLevel)) ||
      (input.learningFocus !== undefined && input.learningFocus !== current.learningFocus);

    if (generationChanged) await this.purgeGenerated(current);
    return this.videos.save({
      ...current,
      ...input,
      youtubeVideoId,
      thumbnailUrl: youtubeVideoId === current.youtubeVideoId ? current.thumbnailUrl : getYouTubeThumbnailUrl(youtubeVideoId),
      lessonId: generationChanged ? null : current.lessonId,
      status: generationChanged ? "pending" : current.status,
      processingProgress: generationChanged ? 0 : current.processingProgress,
      errorMessage: generationChanged ? null : current.errorMessage,
      updatedAt: this.now().toISOString(),
    });
  }

  private async purgeGenerated(video: YouTubeVideo) {
    const lessons = await this.learning.getLessonsByVideo(video.id);
    await Promise.all(lessons.map((lesson) => this.progress.deleteByLesson(lesson.id)));
    await this.learning.deleteByVideo(video.id);
    await this.jobs.deleteByVideo(video.id);
  }

  async delete(id: string) {
    const video = await this.get(id);
    await this.purgeGenerated(video);
    await this.videos.delete(id);
  }
}
