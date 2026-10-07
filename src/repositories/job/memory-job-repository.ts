import type { LearningGenerationJob, ProcessingStatus } from "@/domain/job";
import type { JobRepository } from "../types";
import { clone, getMemoryStore, type MemoryStore } from "../memory-store";
import { ApplicationError } from "@/services/learning/errors";

const rank: Record<ProcessingStatus, number> = {
  pending: 0,
  "fetching-transcript": 1,
  analyzing: 2,
  "generating-vocabulary": 3,
  "generating-grammar": 4,
  "generating-lesson": 5,
  "generating-exercises": 6,
  completed: 7,
  failed: 7,
};

const active = (status: ProcessingStatus) => status !== "completed" && status !== "failed";

export class MemoryJobRepository implements JobRepository {
  constructor(private readonly store: MemoryStore = getMemoryStore()) {}

  async get(id: string) {
    const job = this.store.jobs.get(id);
    return job ? clone(job) : null;
  }

  async getLatestForVideo(videoId: string) {
    const id = this.store.latestJobByVideo.get(videoId);
    return id ? this.get(id) : null;
  }

  async save(job: LearningGenerationJob) {
    const current = this.store.jobs.get(job.id);
    if (!current) {
      const latestId = this.store.latestJobByVideo.get(job.videoId);
      const latest = latestId ? this.store.jobs.get(latestId) : null;
      if (latest && active(latest.status)) {
        throw new ApplicationError("CONFLICT", "Video đang có một tác vụ xử lý.", 409);
      }
    } else if (rank[job.status] < rank[current.status] && current.status !== "failed") {
      throw new ApplicationError("CONFLICT", "Trạng thái xử lý không thể quay lùi.", 409);
    }
    this.store.jobs.set(job.id, clone(job));
    this.store.latestJobByVideo.set(job.videoId, job.id);
    return clone(job);
  }

  async deleteByVideo(videoId: string) {
    for (const [id, job] of this.store.jobs) {
      if (job.videoId === videoId) this.store.jobs.delete(id);
    }
    this.store.latestJobByVideo.delete(videoId);
  }
}
