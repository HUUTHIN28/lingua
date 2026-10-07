import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PublicExercise } from "@/domain/exercise";
import { LessonSpeechProvider } from "@/features/speech/lesson-speech-controller";
import { Dictation } from "./dictation";
import { Listening } from "./listening";

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  lang = ""; rate = 1; pitch = 1; volume = 1; voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) { FakeUtterance.instances.push(this); }
}
const synthesis = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() };
const base = { lessonId: "lesson-1", question: "What did you hear?", sourceSegmentIds: ["segment-1"], startTimeSeconds: 12.9, endTimeSeconds: 30.1 };
const listening = { ...base, id: "listening-1", type: "listening" } satisfies PublicExercise;
const dictation = { ...base, id: "dictation-1", type: "dictation" } satisfies PublicExercise;

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

const wrap = (child: ReactNode) => render(<LessonSpeechProvider lessonId="lesson-1" learningLanguage="en">{child}</LessonSpeechProvider>);

describe("timed exercise speech", () => {
  it("speaks only resolved public transcript text for listening", () => {
    wrap(<Listening exercise={listening} value="" onChange={vi.fn()} speechText="First source. Second source." />);
    fireEvent.click(screen.getByRole("button", { name: "Đọc bài nghe từ 0:12 đến 0:30 bằng giọng đọc máy" }));
    expect(FakeUtterance.instances[0].text).toBe("First source. Second source.");
    expect(FakeUtterance.instances[0].text).not.toContain("SECRET_EXPECTED_ANSWER");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Nghe rồi trả lời ngắn gọn câu hỏi phía trên.")).toBeInTheDocument();
    expect(screen.getByText(/Nghe hiểu · Giọng đọc máy/)).toBeInTheDocument();
  });

  it("uses the same shared controller for dictation", () => {
    wrap(<Dictation exercise={dictation} value="" onChange={vi.fn()} speechText="Exact dictation source." />);
    fireEvent.click(screen.getByRole("button", { name: "Đọc bài chính tả từ 0:12 đến 0:30 bằng giọng đọc máy" }));
    expect(FakeUtterance.instances[0].text).toBe("Exact dictation source.");
    expect(synthesis.cancel).toHaveBeenCalledBefore(synthesis.speak);
    expect(screen.getByText(/Nghe kỹ rồi chép lại nguyên câu/)).toBeInTheDocument();
    expect(screen.getByText(/Chính tả · Giọng đọc máy/)).toBeInTheDocument();
  });

  it("fails closed on missing source text while keeping the answer input enabled", () => {
    wrap(<Listening exercise={listening} value="draft" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("draft")).toBeEnabled();
    expect(screen.getByText("Không tìm thấy đoạn transcript để đọc. Bạn vẫn có thể trả lời câu hỏi.")).toBeInTheDocument();
    expect(synthesis.speak).not.toHaveBeenCalled();
  });
});
