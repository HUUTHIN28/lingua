import type { LearningGenerationJob } from "@/domain/job";
import type { CreateVideoInput, UpdateVideoInput, YouTubeVideo } from "@/domain/video";
import { apiRequest } from "@/lib/api-contract";

export type VideoListResponse = { videos: YouTubeVideo[] };
export type VideoDetailResponse = {
  video: YouTubeVideo;
  job: LearningGenerationJob | null;
  transcriptMode: "youtube" | "demo";
};
export type CreateVideoResponse = {
  video: YouTubeVideo;
  job: LearningGenerationJob;
};
export type GenerateVideoResponse = {
  video: YouTubeVideo;
  job: LearningGenerationJob;
  reused: boolean;
};

export const listVideos = (): Promise<VideoListResponse> =>
  apiRequest<VideoListResponse>("/api/videos");

export const getVideo = (videoId: string): Promise<VideoDetailResponse> =>
  apiRequest<VideoDetailResponse>(`/api/videos/${encodeURIComponent(videoId)}`);

export const createVideo = (input: CreateVideoInput): Promise<CreateVideoResponse> =>
  apiRequest<CreateVideoResponse>("/api/videos", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateVideo = (
  videoId: string,
  input: UpdateVideoInput,
): Promise<{ video: YouTubeVideo }> =>
  apiRequest<{ video: YouTubeVideo }>(`/api/videos/${encodeURIComponent(videoId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteVideo = (videoId: string): Promise<void> =>
  apiRequest<void>(`/api/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });

export const generateVideo = (
  videoId: string,
  input: { scope: "lesson" | "exercises"; force: boolean },
): Promise<GenerateVideoResponse> =>
  apiRequest<GenerateVideoResponse>(
    `/api/videos/${encodeURIComponent(videoId)}/generate`,
    { method: "POST", body: JSON.stringify(input) },
  );

export const getVideoJob = (videoId: string): Promise<VideoDetailResponse> =>
  apiRequest<VideoDetailResponse>(`/api/videos/${encodeURIComponent(videoId)}/job`);
