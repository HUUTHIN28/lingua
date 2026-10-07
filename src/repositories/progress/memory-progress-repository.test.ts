import { describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/repositories/memory-store";
import { MemoryProgressRepository } from "./memory-progress-repository";

describe("MemoryProgressRepository", () => {
  it("appends immutable attempts and scores unique exercises from the first attempt", async () => {
    const repository = new MemoryProgressRepository(resetMemoryStore(), () => new Date("2026-10-06T00:00:00.000Z"));
    await repository.recordAnswer("lesson-1", "one", { answer: "wrong", correct: false }, 2);
    const replacement = await repository.recordAnswer("lesson-1", "one", { answer: "right", correct: true }, 2);
    expect(replacement.completedExercises).toBe(1);
    expect(replacement.score).toBe(0);
    expect(replacement.completed).toBe(false);
    const finished = await repository.recordAnswer("lesson-1", "two", { answer: "right", correct: true }, 2);
    expect(finished).toMatchObject({ completedExercises: 2, score: 50, completed: true });
    expect(await repository.getAttempts("lesson-1")).toEqual(new Map([
      ["one", [
        { answer: "wrong", correct: false, submittedAt: "2026-10-06T00:00:00.000Z" },
        { answer: "right", correct: true, submittedAt: "2026-10-06T00:00:00.000Z" },
      ]],
      ["two", [{ answer: "right", correct: true, submittedAt: "2026-10-06T00:00:00.000Z" }]],
    ]));
  });

  it("returns cloned histories and clears them on reset and delete", async () => {
    const repository = new MemoryProgressRepository(resetMemoryStore());
    await repository.recordAnswer("lesson-1", "one", { answer: "first", correct: true }, 1);
    const histories = await repository.getAttempts("lesson-1");
    histories.get("one")![0].answer = "mutated";
    expect((await repository.getAttempts("lesson-1")).get("one")![0].answer).toBe("first");
    await repository.reset("lesson-1", 1);
    expect(await repository.getAttempts("lesson-1")).toEqual(new Map());
    await repository.recordAnswer("lesson-1", "one", { answer: "again", correct: true }, 1);
    await repository.deleteByLesson("lesson-1");
    expect(await repository.getAttempts("lesson-1")).toEqual(new Map());
  });
});
