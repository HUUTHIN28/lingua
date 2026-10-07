import { DEMO_USER_ID, type LessonProgress } from "@/domain/progress";
import type { ProgressRepository } from "../types";
import { clone, getMemoryStore, type MemoryStore, type StoredExerciseAnswer, type StoredExerciseAttempt } from "../memory-store";

export class MemoryProgressRepository implements ProgressRepository {
  constructor(
    private readonly store: MemoryStore = getMemoryStore(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  private empty(lessonId: string, totalExercises: number): LessonProgress {
    return {
      userId: DEMO_USER_ID,
      lessonId,
      completed: false,
      score: 0,
      completedExercises: 0,
      totalExercises,
      answeredExerciseIds: [],
      lastStudiedAt: this.now().toISOString(),
    };
  }

  async get(lessonId: string) {
    const progress = this.store.lessonProgress.get(lessonId);
    return progress ? clone(progress) : null;
  }

  async list() {
    return [...this.store.lessonProgress.values()]
      .sort((left, right) => right.lastStudiedAt.localeCompare(left.lastStudiedAt))
      .map(clone);
  }

  async getAttempts(lessonId: string) {
    const attempts = this.store.exerciseAttempts.get(lessonId) ?? new Map();
    return new Map([...attempts.entries()].map(([key, value]) => [key, clone(value)]));
  }

  async recordAnswer(
    lessonId: string,
    exerciseId: string,
    answer: StoredExerciseAnswer,
    total: number,
  ) {
    const attempts = this.store.exerciseAttempts.get(lessonId) ?? new Map<string, StoredExerciseAttempt[]>();
    const history = attempts.get(exerciseId) ?? [];
    history.push({ ...clone(answer), submittedAt: this.now().toISOString() });
    attempts.set(exerciseId, history);
    this.store.exerciseAttempts.set(lessonId, attempts);
    const correct = [...attempts.values()].filter((entries) => entries[0]?.correct).length;
    const completedExercises = attempts.size;
    const progress: LessonProgress = {
      userId: DEMO_USER_ID,
      lessonId,
      completed: total > 0 && completedExercises >= total,
      score: completedExercises === 0 ? 0 : Math.round((correct / completedExercises) * 100),
      completedExercises,
      totalExercises: total,
      answeredExerciseIds: [...attempts.keys()],
      lastStudiedAt: this.now().toISOString(),
    };
    this.store.lessonProgress.set(lessonId, clone(progress));
    return clone(progress);
  }

  async reset(lessonId: string, total: number) {
    this.store.exerciseAttempts.delete(lessonId);
    const progress = this.empty(lessonId, total);
    this.store.lessonProgress.set(lessonId, clone(progress));
    return clone(progress);
  }

  async deleteByLesson(lessonId: string) {
    this.store.lessonProgress.delete(lessonId);
    this.store.exerciseAttempts.delete(lessonId);
  }
}
