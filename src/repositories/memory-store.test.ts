import { afterEach, describe, expect, it } from "vitest";
import { getMemoryStore, resetMemoryStore } from "./memory-store";

describe("memory store schema boundary", () => {
  afterEach(() => resetMemoryStore());

  it("creates schema version 3 stores", () => {
    expect(resetMemoryStore().schemaVersion).toBe(3);
  });

  it("discards a hot-reloaded store whose schema version is missing or stale", () => {
    const current = resetMemoryStore();
    current.videos.set("stale", {} as never);
    const stale = current as unknown as { schemaVersion?: number };
    stale.schemaVersion = 1;

    const migrated = getMemoryStore();
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated).not.toBe(current);
    expect(migrated.videos.size).toBe(0);

    delete (migrated as unknown as { schemaVersion?: number }).schemaVersion;
    expect(getMemoryStore()).not.toBe(migrated);
  });
});
