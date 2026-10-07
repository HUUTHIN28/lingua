import { describe, expect, it, vi, beforeEach } from "vitest";
import { dirname, join } from "node:path";
import { writeFile, symlink } from "node:fs/promises";

import { canonicalYoutubeUrl, discoverYoutubeCaptions, selectCaptionTracks } from "./yt-dlp-caption-provider";
import type { runYtDlp } from "./yt-dlp-runner";

const runMock = vi.fn() as unknown as ReturnType<typeof vi.fn> & typeof runYtDlp;

const videoId = "NZxK3oIxI3Y";
const cue = JSON.stringify({ events: [{ tStartMs: 1_000, dDurationMs: 2_000, segs: [{ utf8: "A real sentence." }] }] });

describe("yt-dlp caption discovery", () => {
  beforeEach(() => { runMock.mockReset(); });

  it("uses a canonical validated watch URL and rejects arbitrary input", () => {
    expect(canonicalYoutubeUrl(videoId)).toBe("https://www.youtube.com/watch?v=NZxK3oIxI3Y");
    expect(() => canonicalYoutubeUrl("../bad;$(id)")).toThrow();
  });

  it("prefers creator exact language before regional and automatic tracks", () => {
    const tracks = selectCaptionTracks({
      id: videoId,
      subtitles: { "en-US": [{ ext: "json3" }], en: [{ ext: "vtt" }] },
      automatic_captions: { en: [{ ext: "json3" }], vi: [{ ext: "json3" }] },
    }, "en");
    expect(tracks[0]).toMatchObject({ language: "en", kind: "youtube-manual-captions", formats: ["vtt"] });
    expect(tracks.at(-1)).toMatchObject({ language: "en", kind: "youtube-auto-captions" });
    expect(tracks.some((track) => track.language === "vi")).toBe(false);
  });

  it("keeps automatic base-language captions after an unusable manual regional track", async () => {
    const tracks = selectCaptionTracks({
      id: videoId,
      duration: 706,
      subtitles: { "en-US": [{ ext: "json3" }] },
      automatic_captions: { en: [{ ext: "json3" }] },
    }, "en-US");
    expect(tracks).toEqual([
      { language: "en-US", kind: "youtube-manual-captions", formats: ["json3"] },
      { language: "en", kind: "youtube-auto-captions", formats: ["json3"] },
    ]);

    runMock.mockImplementation(async (args: string[]) => {
      if (args.includes("--dump-single-json")) return { stdout: JSON.stringify({
        id: videoId,
        duration: 706,
        subtitles: { "en-US": [{ ext: "json3" }] },
        automatic_captions: { en: [{ ext: "json3" }] },
      }) };
      if (args.includes("--write-auto-subs")) {
        const template = args[args.indexOf("--output") + 1];
        await writeFile(join(dirname(template), "caption.en.json3"), cue);
      }
      return { stdout: "" };
    });
    const output = await discoverYoutubeCaptions(videoId, "en-US", runMock);
    expect(output.result).toMatchObject({ kind: "youtube-auto-captions", format: "json3" });
    expect(runMock.mock.calls.map(([args]) => args.includes("--write-auto-subs"))).toEqual([false, false, true]);
  });

  it("orders exact and base language choices within each caption source", () => {
    const tracks = selectCaptionTracks({
      id: videoId,
      subtitles: { en: [{ ext: "vtt" }], "en-US": [{ ext: "json3" }] },
      automatic_captions: { en: [{ ext: "vtt" }], "en-US": [{ ext: "json3" }] },
    }, "en-US");
    expect(tracks.map(({ language, kind }) => [language, kind])).toEqual([
      ["en-US", "youtube-manual-captions"],
      ["en", "youtube-manual-captions"],
      ["en-US", "youtube-auto-captions"],
      ["en", "youtube-auto-captions"],
    ]);
  });

  it("downloads the selected manual JSON3 track and preserves its source", async () => {
    runMock.mockImplementation(async (args: string[]) => {
      if (args.includes("--dump-single-json")) return { stdout: JSON.stringify({ id: videoId, duration: 706, subtitles: { en: [{ ext: "json3" }] }, automatic_captions: { en: [{ ext: "json3" }] } }) };
      const template = args[args.indexOf("--output") + 1];
      await writeFile(join(dirname(template), "caption.en.json3"), cue);
      return { stdout: "" };
    });
    const output = await discoverYoutubeCaptions(videoId, "en", runMock);
    expect(output.result).toMatchObject({ kind: "youtube-manual-captions", format: "json3", durationSeconds: 706 });
    expect(output.result?.cues).toHaveLength(1);
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(runMock.mock.calls[0][0]).toContain("--dump-single-json");
    expect(runMock.mock.calls[1][0]).toContain("--write-subs");
    expect(runMock.mock.calls[1][0]).not.toContain("--write-auto-subs");
    expect(runMock.mock.calls[1][0].slice(-2)).toEqual(["--", canonicalYoutubeUrl(videoId)]);
  });

  it("treats success without a subtitle file as unavailable", async () => {
    runMock.mockImplementation(async (args: string[]) => args.includes("--dump-single-json")
      ? { stdout: JSON.stringify({ id: videoId, duration: 706, automatic_captions: { en: [{ ext: "json3" }] } }) }
      : { stdout: "" });
    const output = await discoverYoutubeCaptions(videoId, "en", runMock);
    expect(output).toEqual({ result: null, durationSeconds: 706 });
  });

  it("rejects a symlinked subtitle and falls through", async () => {
    runMock.mockImplementation(async (args: string[]) => {
      if (args.includes("--dump-single-json")) return { stdout: JSON.stringify({ id: videoId, duration: 706, subtitles: { en: [{ ext: "json3" }] } }) };
      const template = args[args.indexOf("--output") + 1];
      await symlink("/etc/hosts", join(dirname(template), "caption.en.json3"));
      return { stdout: "" };
    });
    const output = await discoverYoutubeCaptions(videoId, "en", runMock);
    expect(output.result).toBeNull();
  });
});
