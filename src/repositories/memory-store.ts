import type { YouTubeVideo } from "@/domain/video";
import type { TranscriptSegment } from "@/domain/transcript";
import type { GeneratedLesson } from "@/domain/lesson";
import type { LearningGenerationJob } from "@/domain/job";
import type { LessonProgress } from "@/domain/progress";

export type StoredExerciseAnswer = {
  answer: string;
  correct: boolean;
};

export type StoredExerciseAttempt = StoredExerciseAnswer & {
  submittedAt: string;
};

export type MemoryStore = {
  schemaVersion: 3;
  videos: Map<string, YouTubeVideo>;
  transcripts: Map<string, TranscriptSegment[]>;
  lessons: Map<string, GeneratedLesson>;
  jobs: Map<string, LearningGenerationJob>;
  latestJobByVideo: Map<string, string>;
  lessonProgress: Map<string, LessonProgress>;
  exerciseAttempts: Map<string, Map<string, StoredExerciseAttempt[]>>;
  cache: Map<string, string>;
};

const createMemoryStore = (): MemoryStore => ({
  schemaVersion: 3,
  videos: new Map(),
  transcripts: new Map(),
  lessons: new Map(),
  jobs: new Map(),
  latestJobByVideo: new Map(),
  lessonProgress: new Map(),
  exerciseAttempts: new Map(),
  cache: new Map(),
});

const runtime = globalThis as typeof globalThis & { __linguaTubeStore?: MemoryStore };

export function getMemoryStore(): MemoryStore {
  if (runtime.__linguaTubeStore?.schemaVersion !== 3) {
    runtime.__linguaTubeStore = createMemoryStore();
  }
  return runtime.__linguaTubeStore;
}

export function resetMemoryStore(): MemoryStore {
  runtime.__linguaTubeStore = createMemoryStore();
  return runtime.__linguaTubeStore;
}

export const clone = <T>(value: T): T => structuredClone(value);
