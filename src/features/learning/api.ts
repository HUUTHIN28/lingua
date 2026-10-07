import type { ExerciseCheckResult, ExerciseSubmission } from "@/domain/exercise";
import type { LearningGenerationJob } from "@/domain/job";
import type { PublicLesson } from "@/domain/lesson";
import type { ExerciseAttemptState, LessonAssessmentReport, LessonProgress, VideoProgress } from "@/domain/progress";
import type { YouTubeVideo } from "@/domain/video";
import { apiRequest } from "@/lib/api-contract";

export type LessonResponse = {
  lesson: PublicLesson;
  progress: LessonProgress;
  exerciseStates: ExerciseAttemptState[];
  assessment: LessonAssessmentReport | null;
};

export type VideoDetailResponse = {
  video: YouTubeVideo;
  job: LearningGenerationJob | null;
  transcriptMode: "youtube" | "demo";
};

export type ExerciseCheckResponse = {
  result: ExerciseCheckResult;
  progress: LessonProgress;
  exerciseStates: ExerciseAttemptState[];
  assessment: LessonAssessmentReport | null;
};

export type ProgressResponse = {
  lessons: LessonProgress[];
  videos: VideoProgress[];
};

export const getLesson = (lessonId: string) =>
  apiRequest<LessonResponse>(`/api/lessons/${encodeURIComponent(lessonId)}`);

export const getVideoDetail = (videoId: string) =>
  apiRequest<VideoDetailResponse>(`/api/videos/${encodeURIComponent(videoId)}`);

export const checkExercise = (
  lessonId: string,
  exerciseId: string,
  submission: ExerciseSubmission,
) =>
  apiRequest<ExerciseCheckResponse>(
    `/api/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exerciseId)}/check`,
    { method: "POST", body: JSON.stringify(submission) },
  );

export const getProgress = () => apiRequest<ProgressResponse>("/api/progress");
