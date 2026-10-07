import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProvenance, TranscriptSegment } from "@/domain/transcript";
import { LessonSpeechProvider } from "@/features/speech/lesson-speech-controller";
import { TranscriptPanel } from "./transcript-panel";

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  lang = ""; rate = 1; pitch = 1; volume = 1; voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) { FakeUtterance.instances.push(this); }
}

const synthesis = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() };
const transcript: TranscriptSegment[] = [{ id: "segment-1", videoId: "video-1", startTimeSeconds: 12.9, endTimeSeconds: 30.1, text: "Welcome to the lesson.", translation: "SECRET_TRANSLATION_SENTINEL" }];
const provenance: TranscriptProvenance = {
  kind: "youtube-manual-captions", sourceLanguage: "en", captionFormat: "vtt", translationKind: "gemini", nativeLanguage: "vi", model: "gemini-test", strategyVersion: "test-v1", durationSeconds: 120,
  coverage: { attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 120 }], firstSpeechSeconds: 12.9, lastSpeechSeconds: 30.1, method: "caption-timestamps" },
};

beforeEach(() => {
  FakeUtterance.instances = [];
  vi.clearAllMocks();
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FakeUtterance });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "speechSynthesis");
  Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
});

describe("TranscriptPanel speech", () => {
  it("speaks the exact source text without speaking its translation", () => {
    render(<LessonSpeechProvider lessonId="lesson-1" learningLanguage="en"><TranscriptPanel transcript={transcript} /></LessonSpeechProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Đọc đoạn transcript từ 0:12 đến 0:30 bằng giọng đọc máy" }));
    expect(FakeUtterance.instances[0].text).toBe("Welcome to the lesson.");
    expect(FakeUtterance.instances[0].text).not.toContain("SECRET_TRANSLATION_SENTINEL");
    expect(synthesis.cancel).toHaveBeenCalledBefore(synthesis.speak);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(screen.getByText("Transcript mẫu · không lấy từ video này")).toBeInTheDocument();
    expect(screen.queryByText("SECRET_TRANSLATION_SENTINEL")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Song ngữ" }));
    expect(screen.getByText("SECRET_TRANSLATION_SENTINEL")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Anh" }));
    expect(screen.queryByText("SECRET_TRANSLATION_SENTINEL")).not.toBeInTheDocument();
  });

  it("keeps a readable timestamp when speech is unavailable", () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
    render(<LessonSpeechProvider lessonId="lesson-1" learningLanguage="en"><TranscriptPanel transcript={transcript} /></LessonSpeechProvider>);
    expect(screen.getByText("0:12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đọc đoạn transcript/ })).not.toBeInTheDocument();
  });

  it.each([
    ["youtube-manual-captions", "Phụ đề do video cung cấp", "mốc thời gian theo phụ đề gốc"],
    ["youtube-auto-captions", "Phụ đề tự động của video", "mốc thời gian theo phụ đề gốc"],
    ["gemini-video", "Lời thoại phân tích từ video bằng Gemini", "mốc thời gian do AI ước lượng"],
  ] as const)("labels real transcript provenance %s", (kind, label, detail) => {
    render(<LessonSpeechProvider lessonId="lesson-1" learningLanguage="en"><TranscriptPanel transcript={transcript} transcriptProvenance={{ ...provenance, kind }} /></LessonSpeechProvider>);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(detail))).toBeInTheDocument();
    expect(screen.getByText(/Thời lượng video: 2:00/)).toBeInTheDocument();
    expect(screen.queryByText("Transcript mẫu · không lấy từ video này")).not.toBeInTheDocument();
  });
});
