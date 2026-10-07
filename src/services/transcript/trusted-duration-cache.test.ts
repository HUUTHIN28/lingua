import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readTrustedDuration, saveTrustedDuration } from "./trusted-duration-cache";

const videoId = "NZxK3oIxI3Y";
let directory: string;

describe("verified YouTube duration cache", () => {
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "linguatube-duration-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("reads only yt-dlp-verified metadata for the matching video", async () => {
    await saveTrustedDuration(videoId, 706);
    expect(await readTrustedDuration(videoId)).toBe(706);
    expect(await readTrustedDuration("abcdefghijk")).toBeNull();
    const path = join(directory, ".local", "cache", "youtube-duration", `${videoId}.json`);
    const raw = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...raw, source: "model-estimate" }));
    expect(await readTrustedDuration(videoId)).toBeNull();
  });

  it("rejects expired or malformed cache records", async () => {
    await saveTrustedDuration(videoId, 706);
    const path = join(directory, ".local", "cache", "youtube-duration", `${videoId}.json`);
    const raw = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...raw, checkedAt: "2020-01-01T00:00:00.000Z" }));
    expect(await readTrustedDuration(videoId)).toBeNull();
    await writeFile(path, "bad-json");
    expect(await readTrustedDuration(videoId)).toBeNull();
  });
});
