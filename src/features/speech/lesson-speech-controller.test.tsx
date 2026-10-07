import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageCode } from "@/domain/language";
import {
  LessonSpeechProvider,
  LessonSpeechControls,
  useLessonSpeech,
  type LessonSpeechController,
} from "./lesson-speech-controller";

type FakeUtteranceHandler = (() => void) | null;

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: FakeUtteranceHandler = null;
  onend: FakeUtteranceHandler = null;
  onerror: FakeUtteranceHandler = null;

  constructor(public text: string) {
    FakeUtterance.instances.push(this);
  }
}

const voice = (lang: string, name = lang) => ({
  default: false,
  lang,
  localService: true,
  name,
  voiceURI: name,
}) as SpeechSynthesisVoice;

const makeSynthesis = (voices: SpeechSynthesisVoice[] = []) => {
  const listeners = new Set<EventListener>();
  return {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      if (event === "voiceschanged") listeners.add(listener);
    }),
    removeEventListener: vi.fn((event: string, listener: EventListener) => {
      if (event === "voiceschanged") listeners.delete(listener);
    }),
    emitVoicesChanged: () => listeners.forEach((listener) => listener(new Event("voiceschanged"))),
    listenerCount: () => listeners.size,
  };
};

function ControllerProbe() {
  const controller: LessonSpeechController = useLessonSpeech();
  return (
    <div>
      <button onClick={() => controller.speak({ text: "  Hello learner.  ", label: " câu 1 " })}>
        Đọc
      </button>
      <button onClick={() => controller.speak({ text: "Second request", label: "câu 2" })}>
        Đọc câu 2
      </button>
      <button onClick={() => controller.speak({ text: "   ", label: "blank" })}>
        Đọc trống
      </button>
      <button onClick={() => controller.speak({ text: "a".repeat(5_001), label: "long" })}>
        Đọc dài
      </button>
      <output data-testid="controller-state">{`${String(controller.supported)}:${controller.status}`}</output>
      <LessonSpeechControls />
    </div>
  );
}

function renderProvider(language: LanguageCode = "en", lessonId = "lesson-1") {
  return render(
    <LessonSpeechProvider lessonId={lessonId} learningLanguage={language}>
      <ControllerProbe />
    </LessonSpeechProvider>,
  );
}

describe("LessonSpeechProvider", () => {
  beforeEach(() => {
    FakeUtterance.instances = [];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "speechSynthesis");
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  });

  const installSpeechApi = (synthesis = makeSynthesis()) => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeUtterance,
    });
    return synthesis;
  };

  it.each([
    ["en", "en-US", 0.9],
    ["vi", "vi-VN", 0.9],
    ["zh", "zh-CN", 0.85],
    ["ja", "ja-JP", 0.85],
  ] satisfies Array<[LanguageCode, string, number]>) (
    "uses the expected locale and learning rate for %s",
    (language, locale, rate) => {
      const synthesis = installSpeechApi(makeSynthesis([voice(locale)]));
      renderProvider(language);

      fireEvent.click(screen.getByRole("button", { name: "Đọc" }));

      const utterance = FakeUtterance.instances[0];
      expect(utterance.text).toBe("  Hello learner.  ");
      expect(utterance.lang).toBe(locale);
      expect(utterance.rate).toBe(rate);
      expect(utterance.pitch).toBe(1);
      expect(utterance.volume).toBe(1);
      expect(utterance.voice?.lang).toBe(locale);
      expect(synthesis.cancel.mock.invocationCallOrder[0]).toBeLessThan(
        synthesis.speak.mock.invocationCallOrder[0],
      );
    },
  );

  it("prefers an exact locale voice, then falls back to the language prefix", () => {
    installSpeechApi(makeSynthesis([voice("en-GB", "British"), voice("en-US", "American")]));
    renderProvider("en");
    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    expect(FakeUtterance.instances[0].voice?.name).toBe("American");

    cleanup();
    FakeUtterance.instances = [];
    installSpeechApi(makeSynthesis([voice("en-GB", "British")]));
    renderProvider("en");
    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    expect(FakeUtterance.instances[0].voice?.name).toBe("British");
  });

  it("cancels the prior request and creates a new utterance for replay", () => {
    const synthesis = installSpeechApi();
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    const first = FakeUtterance.instances[0];
    fireEvent.click(screen.getByRole("button", { name: "Phát lại nội dung gần nhất" }));

    expect(synthesis.cancel).toHaveBeenCalledTimes(2);
    expect(synthesis.speak).toHaveBeenCalledTimes(2);
    expect(FakeUtterance.instances).toHaveLength(2);
    expect(FakeUtterance.instances[1]).not.toBe(first);
    expect(FakeUtterance.instances[1].text).toBe(first.text);
  });

  it("stops speech and ignores stale completion or error callbacks", () => {
    const synthesis = installSpeechApi();
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    const first = FakeUtterance.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "Đọc câu 2" }));
    const second = FakeUtterance.instances[1];
    act(() => {
      first.onend?.();
      first.onerror?.();
    });
    expect(screen.getByTestId("controller-state")).toHaveTextContent("true:speaking");
    expect(screen.getByText(/Đang đọc câu 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dừng giọng đọc" }));
    act(() => second.onend?.());
    expect(screen.getByTestId("controller-state")).toHaveTextContent("true:idle");
    expect(synthesis.cancel).toHaveBeenCalledTimes(3);
  });

  it("reports engine errors safely and can replay after an error", () => {
    const synthesis = installSpeechApi();
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));

    act(() => FakeUtterance.instances[0].onerror?.());
    expect(screen.getByTestId("controller-state")).toHaveTextContent("true:error");
    expect(screen.getByText("Không thể phát giọng đọc. Bạn có thể thử lại.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Phát lại nội dung gần nhất" }));
    expect(FakeUtterance.instances).toHaveLength(2);
    expect(synthesis.speak).toHaveBeenCalledTimes(2);
  });

  it("catches a synchronous speak failure without exposing the text", () => {
    const synthesis = makeSynthesis();
    synthesis.speak.mockImplementation(() => {
      throw new Error("engine failure with private details");
    });
    installSpeechApi(synthesis);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    expect(screen.getByTestId("controller-state")).toHaveTextContent("true:error");
    expect(screen.getByText("Không thể phát giọng đọc. Bạn có thể thử lại.")).toBeInTheDocument();
  });

  it("updates late voices and removes its listener on lesson navigation and unmount", () => {
    const voices: SpeechSynthesisVoice[] = [];
    const synthesis = makeSynthesis(voices);
    installSpeechApi(synthesis);
    const view = renderProvider("ja", "lesson-1");
    expect(synthesis.listenerCount()).toBe(1);

    voices.push(voice("ja-JP", "Japanese"));
    act(() => synthesis.emitVoicesChanged());
    view.rerender(
      <LessonSpeechProvider lessonId="lesson-2" learningLanguage="ja">
        <ControllerProbe />
      </LessonSpeechProvider>,
    );
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(synthesis.removeEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
    expect(synthesis.listenerCount()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Đọc" }));
    expect(FakeUtterance.instances[0].voice?.name).toBe("Japanese");
    view.unmount();
    expect(synthesis.listenerCount()).toBe(0);
    expect(synthesis.cancel).toHaveBeenCalledTimes(3);
  });

  it("renders a stable disabled fallback when the browser API is unavailable", () => {
    renderProvider();

    expect(screen.getByTestId("controller-state")).toHaveTextContent("false:unsupported");
    expect(screen.getByText("Trình duyệt này chưa hỗ trợ giọng đọc.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phát lại nội dung gần nhất" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dừng giọng đọc" })).toBeDisabled();
  });

  it("rejects blank and unreasonably long text without calling the speech engine", () => {
    const synthesis = installSpeechApi();
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Đọc trống" }));
    expect(screen.getByText("Nội dung đọc trống hoặc quá dài.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đọc dài" }));
    expect(synthesis.cancel).not.toHaveBeenCalled();
    expect(synthesis.speak).not.toHaveBeenCalled();
  });
});
