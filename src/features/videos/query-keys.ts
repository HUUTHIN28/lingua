export const VIDEO_KEYS = {
  all: ["videos"] as const,
  list: ["videos", "list"] as const,
  detail: (videoId: string) => ["videos", "detail", videoId] as const,
  job: (videoId: string) => ["videos", "detail", videoId, "job"] as const,
};

export const lessonDetailKey = (lessonId: string) =>
  ["lessons", "detail", lessonId] as const;

export const progressKey = ["progress"] as const;
