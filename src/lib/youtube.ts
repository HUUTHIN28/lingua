const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const LONG_FORM_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

const parseUrl = (input: string): URL | null => {
  try {
    const url = new URL(input.trim());
    if (!(["http:", "https:"] as string[]).includes(url.protocol)) return null;
    if (url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
};

export function extractYouTubeVideoId(input: string): string | null {
  const url = parseUrl(input);
  if (!url) return null;

  let candidate: string | null = null;
  if (url.hostname === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1) candidate = parts[0];
  } else if (LONG_FORM_HOSTS.has(url.hostname)) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2 && parts[0] === "embed") candidate = parts[1];
    }
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

export const validateYouTubeUrl = (input: string): boolean =>
  extractYouTubeVideoId(input) !== null;

export const getYouTubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
