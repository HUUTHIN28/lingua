import { getMemoryStore } from "@/repositories/memory-store";
import { MemoryVideoRepository } from "@/repositories/video/memory-video-repository";
import { MemoryLearningRepository } from "@/repositories/learning/memory-learning-repository";
import { MemoryProgressRepository } from "@/repositories/progress/memory-progress-repository";
import { MemoryJobRepository } from "@/repositories/job/memory-job-repository";
import { createTranscriptProvider } from "@/services/transcript/provider-factory";
import { createAIProvider } from "@/ai/providers/provider-factory";
import { LearningGenerationPipeline } from "@/ai/pipeline/learning-generation-pipeline";
import { GenerationRunner } from "@/services/learning/generation-runner";
import { InProcessGenerationScheduler } from "@/services/learning/generation-scheduler";
import { VideoService } from "@/services/video/video-service";
import { LearningService } from "@/services/learning/learning-service";

function createContainer() {
  const store = getMemoryStore();
  const videos = new MemoryVideoRepository(store);
  const learning = new MemoryLearningRepository(store);
  const progress = new MemoryProgressRepository(store);
  const jobs = new MemoryJobRepository(store);
  const transcriptProvider = createTranscriptProvider();
  const aiProvider = createAIProvider();
  const pipeline = new LearningGenerationPipeline(transcriptProvider, aiProvider);
  const delay = Number.parseInt(process.env.MOCK_JOB_STEP_DELAY_MS ?? "180", 10);
  const runner = new GenerationRunner(jobs, videos, learning, progress, pipeline, Number.isFinite(delay) ? Math.max(0, delay) : 180);
  const scheduler = new InProcessGenerationScheduler(runner, 0);
  const videoService = new VideoService(videos, learning, progress, jobs);
  const learningService = new LearningService(
    videoService,
    videos,
    learning,
    progress,
    jobs,
    scheduler,
    aiProvider.cacheIdentity,
    `${transcriptProvider.sourceKind}:${transcriptProvider.version}`,
    transcriptProvider.sourceKind,
  );
  return { videos, learning, progress, jobs, scheduler, videoService, learningService, transcriptProvider, aiProvider };
}

export type ServiceContainer = ReturnType<typeof createContainer>;
const runtime = globalThis as typeof globalThis & { __linguaTubeContainer?: ServiceContainer };

export function getServiceContainer(): ServiceContainer {
  runtime.__linguaTubeContainer ??= createContainer();
  return runtime.__linguaTubeContainer;
}
