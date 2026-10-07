import { describe, expect, it } from "vitest";
import {
  extractYouTubeVideoId,
  validateYouTubeUrl,
} from "./youtube";

const videoId = "dQw4w9WgXcQ";

describe("YouTube URL validation", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${videoId}`, videoId],
    [`https://youtube.com/watch?v=${videoId}&list=abc`, videoId],
    [`https://m.youtube.com/watch?v=${videoId}`, videoId],
    [`https://youtu.be/${videoId}?si=share`, videoId],
    [`https://www.youtube.com/embed/${videoId}`, videoId],
  ])("extracts the ID from %s", (url, expected) => {
    expect(extractYouTubeVideoId(url)).toBe(expected);
    expect(validateYouTubeUrl(url)).toBe(true);
  });

  it.each([
    "",
    "not a url",
    `https://example.com/watch?v=${videoId}`,
    `https://youtube.com.evil.test/watch?v=${videoId}`,
    `https://evil.test/?next=https://youtube.com/watch?v=${videoId}`,
    `javascript:https://youtube.com/watch?v=${videoId}`,
    "https://youtube.com/watch?v=short",
    `https://youtube.com/shorts/${videoId}`,
    `https://youtu.be/${videoId}/extra`,
    `https://user:password@youtube.com/watch?v=${videoId}`,
  ])("rejects malformed or spoofed input %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
    expect(validateYouTubeUrl(url)).toBe(false);
  });
});
