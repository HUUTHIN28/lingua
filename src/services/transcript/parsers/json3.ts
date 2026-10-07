import { z } from "zod";
import { MAX_CAPTION_BYTES, normalizeCues, type CaptionCue } from "./common";

const schema = z.object({
  events: z.array(z.object({
    tStartMs: z.number().finite().nonnegative(),
    dDurationMs: z.number().finite().positive().optional(),
    segs: z.array(z.object({ utf8: z.string() })).optional(),
  }).passthrough()).max(4_000),
});

export function parseJson3Captions(source: string, durationSeconds: number | null): CaptionCue[] {
  if (Buffer.byteLength(source, "utf8") > MAX_CAPTION_BYTES) throw new Error("INVALID_CAPTIONS");
  const parsed = schema.parse(JSON.parse(source));
  const cues = parsed.events.flatMap((event, index) => {
    const text = event.segs?.map((segment) => segment.utf8).join("") ?? "";
    if (!text.trim()) return [];
    const nextStart = parsed.events[index + 1]?.tStartMs;
    const duration = event.dDurationMs ?? (nextStart !== undefined ? nextStart - event.tStartMs : 2_000);
    return [{
      startTimeSeconds: event.tStartMs / 1_000,
      endTimeSeconds: (event.tStartMs + duration) / 1_000,
      text,
    }];
  });
  return normalizeCues(cues, durationSeconds);
}
