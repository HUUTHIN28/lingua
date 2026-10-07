import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LearningGenerationJob } from "@/domain/job";
import type { YouTubeVideo } from "@/domain/video";
import { ProcessingStatusCard } from "./processing-status";

afterEach(cleanup);
const video: YouTubeVideo = {
  id: "video-1", youtubeVideoId: "NZxK3oIxI3Y", youtubeUrl: "https://www.youtube.com/watch?v=NZxK3oIxI3Y", title: "Bài học theo ngữ cảnh", description: "Nội dung học", thumbnailUrl: null, durationSeconds: null, detectedLanguage: null, learningLanguage: "en", nativeLanguage: "vi", targetLevel: null, learningFocus: "comprehensive", lessonId: null, status: "processing", processingProgress: 10, errorMessage: null, createdAt: "2026-10-06T00:00:00.000Z", updatedAt: "2026-10-06T00:00:00.000Z",
};
const job: LearningGenerationJob = { id: "job-1", videoId: "video-1", lessonId: null, status: "fetching-transcript", progress: 10, currentStep: "Đang chuẩn bị", error: null, createdAt: "2026-10-06T00:00:00.000Z", updatedAt: "2026-10-06T00:00:00.000Z", completedAt: null };

describe("ProcessingStatusCard transcript provenance", () => {
  it("states clearly that demo processing uses sample content rather than the submitted video", () => {
    render(<ProcessingStatusCard video={video} job={job} transcriptMode="demo" retrying={false} onRetry={vi.fn()} />);
    expect(screen.getByText("Chế độ nội dung mẫu")).toBeInTheDocument();
    expect(screen.getByText(/không phân tích âm thanh hay lời thoại của video bạn gửi/)).toBeInTheDocument();
    expect(screen.getByText("Chuẩn bị transcript mẫu")).toBeInTheDocument();
    expect(screen.getByText(/chưa lấy lời thoại từ video này/)).toBeInTheDocument();
    expect(screen.queryByText("Lấy lời thoại từ video")).not.toBeInTheDocument();
    expect(screen.queryByText("Tìm cấu trúc xuất hiện trong video.")).not.toBeInTheDocument();
  });

  it("states yt-dlp priority for real video processing", () => {
    render(<ProcessingStatusCard video={video} job={job} transcriptMode="youtube" retrying={false} onRetry={vi.fn()} />);
    expect(screen.getByText("Đang lấy nội dung video thật")).toBeInTheDocument();
    expect(screen.getByText("Lấy lời thoại từ video")).toBeInTheDocument();
    expect(screen.getByText(/yt-dlp trước/)).toBeInTheDocument();
    expect(screen.queryByText("Chế độ nội dung mẫu")).not.toBeInTheDocument();
  });
});
