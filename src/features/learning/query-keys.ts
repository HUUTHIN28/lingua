export const LESSON_KEYS = {
  all: ["lessons"] as const,
  detail: (lessonId: string) => ["lessons", "detail", lessonId] as const,
};

export const PROGRESS_KEYS = {
  all: ["progress"] as const,
};

export const VIDEO_KEYS = {
  all: ["videos"] as const,
  list: ["videos", "list"] as const,
  detail: (videoId: string) => ["videos", "detail", videoId] as const,
};
