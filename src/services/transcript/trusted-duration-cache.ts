import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";

const durationSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  durationSeconds: z.number().positive().max(3_600),
  source: z.literal("yt-dlp"),
  checkedAt: z.string().datetime(),
});
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

function cacheDirectory(): string {
  return join(process.cwd(), ".local", "cache", "youtube-duration");
}

export async function readTrustedDuration(videoId: string): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  try {
    const raw = await readFile(join(cacheDirectory(), `${videoId}.json`), "utf8");
    if (Buffer.byteLength(raw, "utf8") > 2_000) return null;
    const parsed = durationSchema.parse(JSON.parse(raw));
    const age = Date.now() - Date.parse(parsed.checkedAt);
    return parsed.videoId === videoId && age >= 0 && age <= MAX_AGE_MS ? parsed.durationSeconds : null;
  } catch {
    return null;
  }
}

export async function saveTrustedDuration(videoId: string, durationSeconds: number): Promise<void> {
  const value = durationSchema.parse({ videoId, durationSeconds, source: "yt-dlp", checkedAt: new Date().toISOString() });
  const directory = cacheDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `${videoId}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
  await rename(temporary, join(directory, `${videoId}.json`));
}
