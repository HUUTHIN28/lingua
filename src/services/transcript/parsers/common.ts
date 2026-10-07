export type CaptionCue = { startTimeSeconds: number; endTimeSeconds: number; text: string };
export const MAX_CAPTION_BYTES = 2_000_000;
export const MAX_CAPTION_CUES = 4_000;

export function decodeCaptionText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      const key = entity.slice(1, -1).toLowerCase();
      if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      return named[key] ?? entity;
    })
    .replace(/\s+/g, " ").trim();
}

export function normalizeCues(cues: CaptionCue[], durationSeconds: number | null): CaptionCue[] {
  if (cues.length === 0 || cues.length > MAX_CAPTION_CUES) throw new Error("INVALID_CAPTIONS");
  const result: CaptionCue[] = [];
  for (const cue of cues) {
    if (!Number.isFinite(cue.startTimeSeconds) || !Number.isFinite(cue.endTimeSeconds) ||
        cue.startTimeSeconds < 0 || cue.endTimeSeconds <= cue.startTimeSeconds ||
        cue.endTimeSeconds - cue.startTimeSeconds > 120 ||
        (durationSeconds !== null && cue.endTimeSeconds > durationSeconds + 10) ||
        cue.text.length > 1_000) throw new Error("INVALID_CAPTIONS");
    const text = decodeCaptionText(cue.text);
    if (!text) continue;
    const prev = result.at(-1);
    if (prev && cue.startTimeSeconds < prev.startTimeSeconds - 0.25) throw new Error("INVALID_CAPTIONS");
    // Rolling captions repeat their earlier prefix while the old cue is still on screen.
    if (prev && cue.startTimeSeconds < prev.endTimeSeconds &&
        text.startsWith(prev.text) && text.length > prev.text.length) {
      prev.text = text;
      prev.endTimeSeconds = Math.max(prev.endTimeSeconds, cue.endTimeSeconds);
    } else if (prev && cue.startTimeSeconds < prev.endTimeSeconds &&
        prev.text === text) {
      prev.endTimeSeconds = Math.max(prev.endTimeSeconds, cue.endTimeSeconds);
    } else {
      result.push({ ...cue, text });
    }
  }
  if (result.length === 0) throw new Error("INVALID_CAPTIONS");
  return result;
}
