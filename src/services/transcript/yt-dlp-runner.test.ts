import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runYtDlp } from "./yt-dlp-runner";

let directory: string;
const script = async (body: string) => {
  const path = join(directory, "fake-yt-dlp");
  await writeFile(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
  return path;
};

describe("bounded yt-dlp process", () => {
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "linguatube-process-test-")); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it("passes each argument literally and always prepends ignore-config", async () => {
    const executable = await script("printf '%s|%s|%s\\n' \"$1\" \"$2\" \"$3\"");
    const result = await runYtDlp(["first", "; touch /tmp/never-executed"], { executable, timeoutMs: 1_000 });
    expect(result.stdout.trim()).toBe("--ignore-config|first|; touch /tmp/never-executed");
  });

  it("redacts subprocess output on failure", async () => {
    const executable = await script("echo 'secret-test-value' >&2\nexit 7");
    await expect(runYtDlp([], { executable, timeoutMs: 1_000 })).rejects.toMatchObject({ reason: "process", message: "yt-dlp:process" });
  });

  it("stops a process that exceeds its output budget", async () => {
    const executable = await script("printf '%01000d' 1");
    await expect(runYtDlp([], { executable, timeoutMs: 1_000, maxOutputBytes: 20 })).rejects.toMatchObject({ reason: "output-limit" });
  });
});
