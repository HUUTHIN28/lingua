import type { GeneratedLesson } from "@/domain/lesson";
import type { TranscriptSegment } from "@/domain/transcript";
import type { LearningRepository } from "../types";
import { clone, getMemoryStore, type MemoryStore } from "../memory-store";

export class MemoryLearningRepository implements LearningRepository {
  constructor(private readonly store: MemoryStore = getMemoryStore()) {}

  async getTranscript(videoId: string) {
    const transcript = this.store.transcripts.get(videoId);
    return transcript ? clone(transcript) : null;
  }

  async saveTranscript(videoId: string, transcript: TranscriptSegment[]) {
    this.store.transcripts.set(videoId, clone(transcript));
  }

  async getLesson(lessonId: string) {
    const lesson = this.store.lessons.get(lessonId);
    return lesson ? clone(lesson) : null;
  }

  async getLessonsByVideo(videoId: string) {
    return [...this.store.lessons.values()].filter((lesson) => lesson.videoId === videoId).map(clone);
  }

  async saveLesson(lesson: GeneratedLesson) {
    this.store.lessons.set(lesson.id, clone(lesson));
    return clone(lesson);
  }

  async deleteLesson(lessonId: string) {
    this.store.lessons.delete(lessonId);
    for (const [key, cachedLessonId] of this.store.cache) {
      if (cachedLessonId === lessonId) this.store.cache.delete(key);
    }
  }

  async deleteByVideo(videoId: string) {
    this.store.transcripts.delete(videoId);
    const lessonIds = [...this.store.lessons.values()]
      .filter((lesson) => lesson.videoId === videoId)
      .map((lesson) => lesson.id);
    lessonIds.forEach((lessonId) => this.store.lessons.delete(lessonId));
    for (const [key, lessonId] of this.store.cache) {
      if (lessonIds.includes(lessonId)) this.store.cache.delete(key);
    }
  }

  async getCachedLessonId(key: string) {
    return this.store.cache.get(key) ?? null;
  }

  async setCachedLessonId(key: string, lessonId: string) {
    this.store.cache.set(key, lessonId);
  }
}
