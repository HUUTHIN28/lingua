import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join } from "node:path";

export const YT_DLP_STRATEGY_VERSION = "yt-dlp-captions-v2";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 8_000_000;

export class YtDlpFailure extends Error {
  constructor(readonly reason: "missing" | "process" | "timeout" | "output-limit") {
    super(`yt-dlp:${reason}`);
  }
}

export async function resolveYtDlpExecutable(): Promise<string> {
  const configured = process.env.YT_DLP_PATH?.trim();
  if (configured) {
    if (!isAbsolute(configured)) throw new YtDlpFailure("missing");
    await access(configured, constants.X_OK).catch(() => { throw new YtDlpFailure("missing"); });
    return configured;
  }
  const local = join(process.cwd(), ".local", "bin", "yt-dlp-local");
  const localPayload = join(process.cwd(), ".local", "bin", "yt-dlp");
  try {
    await access(local, constants.X_OK);
    await access(localPayload, constants.X_OK);
    return local;
  } catch {
    return "yt-dlp";
  }
}

export async function runYtDlp(
  args: readonly string[],
  options: { timeoutMs?: number; maxOutputBytes?: number; executable?: string } = {},
): Promise<{ stdout: string; version?: string }> {
  const executable = options.executable ?? await resolveYtDlpExecutable();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_OUTPUT_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 180_000 ||
      !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > MAX_OUTPUT_BYTES) {
    throw new YtDlpFailure("process");
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, ["--ignore-config", ...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let failed: YtDlpFailure | null = null;
    const timer = setTimeout(() => {
      failed = new YtDlpFailure("timeout");
      child.kill("SIGKILL");
    }, timeoutMs);
    const collect = (chunk: Buffer, keep: boolean) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        failed = new YtDlpFailure("output-limit");
        child.kill("SIGKILL");
      } else if (keep) chunks.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(chunk, true));
    child.stderr.on("data", (chunk: Buffer) => collect(chunk, false));
    child.once("error", () => {
      failed = new YtDlpFailure("missing");
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (failed) return reject(failed);
      if (code !== 0) return reject(new YtDlpFailure("process"));
      resolve({ stdout: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

export async function getYtDlpVersion(): Promise<string> {
  try {
    const result = await runYtDlp(["--version"], { timeoutMs: 5_000, maxOutputBytes: 1_000 });
    const version = result.stdout.trim();
    return /^\d{4}\.\d{2}\.\d{2}$/.test(version) ? version : "unknown";
  } catch {
    return "unavailable";
  }
}
