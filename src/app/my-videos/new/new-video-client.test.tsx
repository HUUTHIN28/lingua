import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NewVideoDescription, NewVideoInfoCards } from "./new-video-client";

afterEach(cleanup);

describe("new video transcript mode copy", () => {
  it("describes real video content and caption-first extraction in YouTube mode", () => {
    render(<><NewVideoDescription transcriptMode="youtube" /><NewVideoInfoCards transcriptMode="youtube" /></>);
    expect(screen.getByText(/ưu tiên phụ đề của video, sau đó Gemini phiên âm/)).toBeInTheDocument();
    expect(screen.getByText("Học từ nội dung video")).toBeInTheDocument();
    expect(screen.getByText(/Nếu không thể lấy đầy đủ, hệ thống sẽ báo lỗi/)).toBeInTheDocument();
    expect(screen.queryByText(/hội thoại mẫu/)).not.toBeInTheDocument();
  });

  it("labels the explicit demo as sample content", () => {
    render(<><NewVideoDescription transcriptMode="demo" /><NewVideoInfoCards transcriptMode="demo" /></>);
    expect(screen.getByText(/dùng hội thoại mẫu và chưa lấy lời thoại từ video bạn gửi/)).toBeInTheDocument();
    expect(screen.getByText("Chế độ thử nghiệm")).toBeInTheDocument();
    expect(screen.queryByText(/ưu tiên phụ đề của video/)).not.toBeInTheDocument();
  });
});
