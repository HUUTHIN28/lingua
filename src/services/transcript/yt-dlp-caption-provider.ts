import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { runYtDlp } from "./yt-dlp-runner";
import { parseJson3Captions } from "./parsers/json3";
import { parseVttCaptions } from "./parsers/vtt";
import { MAX_CAPTION_BYTES, type CaptionCue } from "./parsers/common";

const MAX_VIDEO_SECONDS = 3_600;
const trackSchema = z.object({ ext: z.string().min(1).max(20) }).passthrough();
const infoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  duration: z.number().positive().max(MAX_VIDEO_SECONDS).nullable().optional(),
  subtitles: z.record(z.string(), z.array(trackSchema)).optional(),
  automatic_captions: z.record(z.string(), z.array(trackSchema)).optional(),
}).passthrough();

export type CaptionResult = {
  cues: CaptionCue[];
  kind: "youtube-manual-captions" | "youtube-auto-captions";
  format: "json3" | "vtt";
  durationSeconds: number | null;
};
export type CaptionDiscovery = { result: CaptionResult | null; durationSeconds: number | null };
type TrackChoice = { language: string; kind: CaptionResult["kind"]; formats: Array<"json3" | "vtt"> };

export function canonicalYoutubeUrl(videoId: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("INVALID_VIDEO_ID");
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function languageCandidates(language: string): string[] {
  const exact = language.toLowerCase();
  const base = exact.split("-")[0];
  return exact === base ? [exact] : [exact, base];
}

export function selectCaptionTracks(metadata: z.infer<typeof infoSchema>, language: string): TrackChoice[] {
  const candidates = languageCandidates(language);
  const sources = [
    { tracks: metadata.subtitles ?? {}, kind: "youtube-manual-captions" as const },
    { tracks: metadata.automatic_captions ?? {}, kind: "youtube-auto-captions" as const },
  ];
  const result: TrackChoice[] = [];
  for (const source of sources) {
    const selectedLanguages = new Set<string>();
    for (const candidate of candidates) {
      const matching = Object.entries(source.tracks)
        .filter(([key]) => key.toLowerCase() === candidate || key.toLowerCase().startsWith(`${candidate}-`))
        .sort(([a], [b]) => Number(b.toLowerCase() === candidate) - Number(a.toLowerCase() === candidate));
      for (const [key, tracks] of matching) {
        const normalized = key.toLowerCase();
        if (normalized !== candidate && !normalized.startsWith(`${candidate}-`)) continue;
        if (selectedLanguages.has(normalized)) continue;
        // Prefer an exact track, then a regional variant. Ignore translations into a different language.
        const formats = (["json3", "vtt"] as const).filter((format) => tracks.some((track) => track.ext === format));
        if (formats.length) {
          result.push({ language: key, kind: source.kind, formats });
          selectedLanguages.add(normalized);
        }
      }
    }
  }
  return result;
}

async function downloadTrack(
  url: string,
  track: TrackChoice,
  format: "json3" | "vtt",
  durationSeconds: number | null,
  run: typeof runYtDlp,
): Promise<CaptionCue[] | null> {
  const directory = await mkdtemp(join(tmpdir(), "linguatube-captions-"));
  try {
    const switches = track.kind === "youtube-auto-captions" ? ["--write-auto-subs"] : ["--write-subs"];
    await run([
      "--skip-download", "--no-playlist", "--no-warnings", "--socket-timeout", "12",
      "--retries", "1", "--extractor-retries", "1",
      ...switches, "--sub-langs", track.language, "--sub-format", format,
      "--output", join(directory, "caption.%(ext)s"), "--", url,
    ], { timeoutMs: 90_000, maxOutputBytes: 100_000 });
    const files = await readdir(directory);
    const expected = files.filter((file) =>
      file.startsWith("caption.") && file.endsWith(`.${format}`) && !file.includes("/"));
    if (expected.length !== 1) return null;
    const path = join(directory, expected[0]);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_CAPTION_BYTES) return null;
    const content = await readFile(path, "utf8");
    return format === "json3"
      ? parseJson3Captions(content, durationSeconds)
      : parseVttCaptions(content, durationSeconds);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function discoverYoutubeCaptions(videoId: string, learningLanguage: string, run: typeof runYtDlp = runYtDlp): Promise<CaptionDiscovery> {
  const url = canonicalYoutubeUrl(videoId);
  const output = await run([
    "--skip-download", "--no-playlist", "--no-warnings", "--socket-timeout", "12",
    "--retries", "1", "--extractor-retries", "1", "--dump-single-json", "--", url,
  ], { timeoutMs: 90_000 });
  const metadata = infoSchema.parse(JSON.parse(output.stdout));
  if (metadata.id !== videoId) throw new Error("INVALID_VIDEO_METADATA");
  const durationSeconds = metadata.duration ?? null;
  for (const track of selectCaptionTracks(metadata, learningLanguage)) {
    for (const format of track.formats) {
      try {
        const cues = await downloadTrack(url, track, format, durationSeconds, run);
        if (cues?.length) {
          return { result: { cues, kind: track.kind, format, durationSeconds }, durationSeconds };
        }
      } catch {
        // Try the next supported track before falling back to Gemini video.
      }
    }
  }
  return { result: null, durationSeconds };
}
