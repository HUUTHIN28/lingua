"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { CreateVideoInput, UpdateVideoInput } from "@/domain/video";
import {
  createVideo,
  deleteVideo,
  generateVideo,
  getVideo,
  getVideoJob,
  listVideos,
  updateVideo,
} from "./api";
import { lessonDetailKey, progressKey, VIDEO_KEYS } from "./query-keys";

const invalidateVideoSurfaces = async (
  queryClient: QueryClient,
  videoId?: string,
  lessonId?: string | null,
) => {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: VIDEO_KEYS.list }),
    queryClient.invalidateQueries({ queryKey: progressKey }),
  ];
  if (videoId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: VIDEO_KEYS.detail(videoId) }),
      queryClient.invalidateQueries({ queryKey: VIDEO_KEYS.job(videoId) }),
    );
  }
  if (lessonId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: lessonDetailKey(lessonId) }),
    );
  }
  await Promise.all(invalidations);
};

export function useVideos() {
  return useQuery({ queryKey: VIDEO_KEYS.list, queryFn: listVideos });
}

export function useVideo(videoId: string) {
  return useQuery({
    queryKey: VIDEO_KEYS.detail(videoId),
    queryFn: () => getVideo(videoId),
    enabled: Boolean(videoId),
  });
}

export function useVideoJob(videoId: string) {
  return useQuery({
    queryKey: VIDEO_KEYS.job(videoId),
    queryFn: () => getVideoJob(videoId),
    enabled: Boolean(videoId),
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      if (query.state.data && !query.state.data.job) return false;
      const status = query.state.data?.job?.status;
      return status === "completed" || status === "failed" ? false : 500;
    },
  });
}

export function useCreateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVideoInput) => createVideo(input),
    onSuccess: async ({ video }) => {
      await invalidateVideoSurfaces(queryClient, video.id, video.lessonId);
    },
  });
}

export function useUpdateVideo(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVideoInput) => updateVideo(videoId, input),
    onSuccess: async ({ video }) => {
      queryClient.setQueryData(VIDEO_KEYS.detail(videoId), (current: unknown) => {
        if (!current || typeof current !== "object" || !("job" in current)) return current;
        return { ...current, video };
      });
      await invalidateVideoSurfaces(queryClient, videoId, video.lessonId);
    },
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId }: { videoId: string; lessonId: string | null }) =>
      deleteVideo(videoId),
    onSuccess: async (_, { videoId, lessonId }) => {
      queryClient.removeQueries({ queryKey: VIDEO_KEYS.detail(videoId) });
      queryClient.removeQueries({ queryKey: VIDEO_KEYS.job(videoId) });
      if (lessonId) queryClient.removeQueries({ queryKey: lessonDetailKey(lessonId) });
      await invalidateVideoSurfaces(queryClient);
    },
  });
}

export function useGenerateVideo(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { scope: "lesson" | "exercises"; force: boolean }) =>
      generateVideo(videoId, input),
    onSuccess: async ({ video }) => {
      await invalidateVideoSurfaces(queryClient, videoId, video.lessonId);
    },
  });
}
