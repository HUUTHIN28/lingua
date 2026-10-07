import { MAX_CAPTION_BYTES, normalizeCues, type CaptionCue } from "./common";

function parseTimestamp(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length !== 2 && parts.length !== 3) throw new Error("INVALID_CAPTIONS");
  const seconds = parts.length === 3
    ? parts[0] * 3_600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("INVALID_CAPTIONS");
  return seconds;
}

export function parseVttCaptions(source: string, durationSeconds: number | null): CaptionCue[] {
  if (Buffer.byteLength(source, "utf8") > MAX_CAPTION_BYTES || !source.trimStart().startsWith("WEBVTT")) {
    throw new Error("INVALID_CAPTIONS");
  }
  const blocks = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  const cues: CaptionCue[] = [];
  for (const block of blocks.slice(1)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length || /^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const timing = lines[timingIndex].match(/^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})(?:\s+.*)?$/);
    if (!timing) throw new Error("INVALID_CAPTIONS");
    cues.push({
      startTimeSeconds: parseTimestamp(timing[1]),
      endTimeSeconds: parseTimestamp(timing[2]),
      text: lines.slice(timingIndex + 1).join(" "),
    });
  }
  return normalizeCues(cues, durationSeconds);
}
