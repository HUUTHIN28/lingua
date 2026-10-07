import type { GenerationRunner, GenerationTask } from "./generation-runner";

export interface GenerationScheduler {
  schedule(task: GenerationTask): void;
  isActive(jobId: string): boolean;
  waitForIdle?(): Promise<void>;
}

abstract class BaseScheduler implements GenerationScheduler {
  protected readonly activeJobs = new Set<string>();
  protected readonly promises = new Set<Promise<void>>();

  constructor(protected readonly runner: GenerationRunner) {}

  isActive(jobId: string) {
    return this.activeJobs.has(jobId);
  }

  protected execute(task: GenerationTask) {
    if (this.activeJobs.has(task.jobId)) return;
    this.activeJobs.add(task.jobId);
    const promise = this.runner.run(task).finally(() => {
      this.activeJobs.delete(task.jobId);
      this.promises.delete(promise);
    });
    this.promises.add(promise);
  }

  async waitForIdle() {
    await Promise.all([...this.promises]);
  }

  abstract schedule(task: GenerationTask): void;
}

export class InProcessGenerationScheduler extends BaseScheduler {
  constructor(runner: GenerationRunner, private readonly initialDelayMs = 0) {
    super(runner);
  }

  schedule(task: GenerationTask) {
    if (this.activeJobs.has(task.jobId)) return;
    this.activeJobs.add(task.jobId);
    setTimeout(() => {
      this.activeJobs.delete(task.jobId);
      this.execute(task);
    }, this.initialDelayMs);
  }
}

export class ImmediateGenerationScheduler extends BaseScheduler {
  schedule(task: GenerationTask) {
    this.execute(task);
  }
}
