import type { YouTubeVideo } from "@/domain/video";
import type { TranscriptSegment } from "@/domain/transcript";
import type { GeneratedLesson } from "@/domain/lesson";
import type { LearningGenerationJob } from "@/domain/job";
import type { LessonProgress } from "@/domain/progress";
import type { StoredExerciseAnswer, StoredExerciseAttempt } from "./memory-store";

export interface VideoRepository {
  list(): Promise<YouTubeVideo[]>;
  get(id: string): Promise<YouTubeVideo | null>;
  save(video: YouTubeVideo): Promise<YouTubeVideo>;
  delete(id: string): Promise<boolean>;
}

export interface LearningRepository {
  getTranscript(videoId: string): Promise<TranscriptSegment[] | null>;
  saveTranscript(videoId: string, transcript: TranscriptSegment[]): Promise<void>;
  getLesson(lessonId: string): Promise<GeneratedLesson | null>;
  getLessonsByVideo(videoId: string): Promise<GeneratedLesson[]>;
  saveLesson(lesson: GeneratedLesson): Promise<GeneratedLesson>;
  deleteLesson(lessonId: string): Promise<void>;
  deleteByVideo(videoId: string): Promise<void>;
  getCachedLessonId(key: string): Promise<string | null>;
  setCachedLessonId(key: string, lessonId: string): Promise<void>;
}

export interface JobRepository {
  get(id: string): Promise<LearningGenerationJob | null>;
  getLatestForVideo(videoId: string): Promise<LearningGenerationJob | null>;
  save(job: LearningGenerationJob): Promise<LearningGenerationJob>;
  deleteByVideo(videoId: string): Promise<void>;
}

export interface ProgressRepository {
  get(lessonId: string): Promise<LessonProgress | null>;
  list(): Promise<LessonProgress[]>;
  getAttempts(lessonId: string): Promise<Map<string, StoredExerciseAttempt[]>>;
  recordAnswer(lessonId: string, exerciseId: string, answer: StoredExerciseAnswer, total: number): Promise<LessonProgress>;
  reset(lessonId: string, total: number): Promise<LessonProgress>;
  deleteByLesson(lessonId: string): Promise<void>;
}
