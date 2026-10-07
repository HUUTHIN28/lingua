import type { YouTubeVideo } from "@/domain/video";
import type { VideoRepository } from "../types";
import { clone, getMemoryStore, type MemoryStore } from "../memory-store";

export class MemoryVideoRepository implements VideoRepository {
  constructor(private readonly store: MemoryStore = getMemoryStore()) {}

  async list() {
    return [...this.store.videos.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  async get(id: string) {
    const value = this.store.videos.get(id);
    return value ? clone(value) : null;
  }

  async save(video: YouTubeVideo) {
    this.store.videos.set(video.id, clone(video));
    return clone(video);
  }

  async delete(id: string) {
    return this.store.videos.delete(id);
  }
}
