"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCcw, Square, Volume2 } from "lucide-react";
import type { LanguageCode } from "@/domain/language";
import { Button } from "@/components/ui/button";

const MAX_SPEECH_TEXT_LENGTH = 5_000;

const SPEECH_LOCALES: Record<LanguageCode, string> = {
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
  ja: "ja-JP",
};

const SPEECH_RATES: Record<LanguageCode, number> = {
  en: 0.9,
  vi: 0.9,
  zh: 0.85,
  ja: 0.85,
};

export type LessonSpeechRequest = {
  text: string;
  label: string;
};

export type LessonSpeechStatus =
  | "checking"
  | "idle"
  | "speaking"
  | "finished"
  | "error"
  | "unsupported";

export type LessonSpeechController = {
  speak: (request: LessonSpeechRequest) => void;
  replay: () => void;
  stop: () => void;
  supported: boolean;
  status: LessonSpeechStatus;
  activeLabel: string | null;
  errorMessage: string | null;
  hasReplay: boolean;
};

type LessonSpeechProviderProps = {
  lessonId: string;
  learningLanguage?: LanguageCode;
  children: ReactNode;
};

const LessonSpeechContext = createContext<LessonSpeechController | null>(null);

const selectVoice = (voices: SpeechSynthesisVoice[], locale: string) => {
  const normalizedLocale = locale.toLowerCase();
  const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === normalizedLocale);
  if (exactVoice) return exactVoice;

  const languagePrefix = normalizedLocale.split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().split("-")[0] === languagePrefix);
};

const normalizeRequest = (request: LessonSpeechRequest): LessonSpeechRequest | null => {
  const text = request.text;
  if (text.trim().length === 0 || text.length > MAX_SPEECH_TEXT_LENGTH) return null;

  const label = request.label.trim();
  return { text, label: label || "nội dung đã chọn" };
};

export function LessonSpeechProvider({
  lessonId,
  learningLanguage,
  children,
}: LessonSpeechProviderProps) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<LessonSpeechStatus>("checking");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasReplay, setHasReplay] = useState(false);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const lastRequestRef = useRef<LessonSpeechRequest | null>(null);
  const requestGenerationRef = useRef(0);

  const safelyCancel = useCallback(() => {
    try {
      synthesisRef.current?.cancel();
    } catch {
      // A browser speech engine can become unavailable during navigation.
    }
  }, []);

  /* Speech support and the active lesson are external state. Resetting the UI
     here keeps the server markup deterministic and prevents cross-lesson replay. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!learningLanguage) {
      requestGenerationRef.current += 1;
      safelyCancel();
      synthesisRef.current = null;
      voicesRef.current = [];
      setSupported(false);
      setStatus("checking");
      setActiveLabel(null);
      setErrorMessage(null);
      setHasReplay(false);
      lastRequestRef.current = null;
      return;
    }

    const browserSupportsSpeech =
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance === "function";

    if (!browserSupportsSpeech) {
      synthesisRef.current = null;
      voicesRef.current = [];
      setSupported(false);
      setStatus("unsupported");
      setActiveLabel(null);
      setErrorMessage(null);
      setHasReplay(false);
      lastRequestRef.current = null;
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesisRef.current = synthesis;
    setSupported(true);
    setStatus("idle");
    setActiveLabel(null);
    setErrorMessage(null);
    setHasReplay(false);
    lastRequestRef.current = null;

    const updateVoices = () => {
      try {
        voicesRef.current = synthesis.getVoices();
      } catch {
        voicesRef.current = [];
      }
    };

    updateVoices();
    if (typeof synthesis.addEventListener === "function") {
      synthesis.addEventListener("voiceschanged", updateVoices);
    }

    return () => {
      requestGenerationRef.current += 1;
      safelyCancel();
      utteranceRef.current = null;
      synthesisRef.current = null;
      voicesRef.current = [];
      if (typeof synthesis.removeEventListener === "function") {
        synthesis.removeEventListener("voiceschanged", updateVoices);
      }
    };
  }, [lessonId, learningLanguage, safelyCancel]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const startSpeech = useCallback(
    (request: LessonSpeechRequest) => {
      const synthesis = synthesisRef.current;
      if (!learningLanguage || !supported || !synthesis || typeof window.SpeechSynthesisUtterance !== "function") {
        setStatus("unsupported");
        setErrorMessage(null);
        return;
      }

      const generation = requestGenerationRef.current + 1;
      requestGenerationRef.current = generation;
      safelyCancel();
      utteranceRef.current = null;

      try {
        const utterance = new window.SpeechSynthesisUtterance(request.text);
        utteranceRef.current = utterance;
        const locale = SPEECH_LOCALES[learningLanguage];
        utterance.lang = locale;
        utterance.rate = SPEECH_RATES[learningLanguage];
        utterance.pitch = 1;
        utterance.volume = 1;

        let voices = voicesRef.current;
        try {
          const currentVoices = synthesis.getVoices();
          if (currentVoices.length > 0) {
            voices = currentVoices;
            voicesRef.current = currentVoices;
          }
        } catch {
          // The locale still lets the browser choose its default matching voice.
        }
        utterance.voice = selectVoice(voices, locale) ?? null;

        utterance.onstart = () => {
          if (requestGenerationRef.current !== generation) return;
          setStatus("speaking");
          setErrorMessage(null);
        };
        utterance.onend = () => {
          if (requestGenerationRef.current !== generation) return;
          utteranceRef.current = null;
          setStatus("finished");
          setErrorMessage(null);
        };
        utterance.onerror = () => {
          if (requestGenerationRef.current !== generation) return;
          requestGenerationRef.current += 1;
          safelyCancel();
          utteranceRef.current = null;
          setStatus("error");
          setErrorMessage("Không thể phát giọng đọc. Bạn có thể thử lại.");
        };

        setActiveLabel(request.label);
        setErrorMessage(null);
        setStatus("speaking");
        synthesis.speak(utterance);
      } catch {
        if (requestGenerationRef.current === generation) {
          requestGenerationRef.current += 1;
          safelyCancel();
          utteranceRef.current = null;
          setStatus("error");
          setErrorMessage("Không thể phát giọng đọc. Bạn có thể thử lại.");
        }
      }
    },
    [learningLanguage, safelyCancel, supported],
  );

  const speak = useCallback(
    (request: LessonSpeechRequest) => {
      const normalizedRequest = normalizeRequest(request);
      if (!normalizedRequest) {
        setStatus("error");
        setErrorMessage("Nội dung đọc trống hoặc quá dài.");
        return;
      }

      lastRequestRef.current = normalizedRequest;
      setHasReplay(true);
      startSpeech(normalizedRequest);
    },
    [startSpeech],
  );

  const replay = useCallback(() => {
    const request = lastRequestRef.current;
    if (request) startSpeech(request);
  }, [startSpeech]);

  const stop = useCallback(() => {
    requestGenerationRef.current += 1;
    safelyCancel();
    utteranceRef.current = null;
    setStatus(supported ? "idle" : "unsupported");
    setErrorMessage(null);
  }, [safelyCancel, supported]);

  const controller = useMemo<LessonSpeechController>(
    () => ({ speak, replay, stop, supported, status, activeLabel, errorMessage, hasReplay }),
    [speak, replay, stop, supported, status, activeLabel, errorMessage, hasReplay],
  );

  return (
    <LessonSpeechContext.Provider value={controller}>
      {children}
    </LessonSpeechContext.Provider>
  );
}

export function LessonSpeechControls({ className = "" }: { className?: string }) {
  const controller = useLessonSpeech();
  const { hasReplay } = controller;
  const { activeLabel, errorMessage, replay, status, stop, supported } = controller;
  const statusText = (() => {
    if (status === "checking") return "Đang kiểm tra hỗ trợ giọng đọc…";
    if (status === "unsupported") return "Trình duyệt này chưa hỗ trợ giọng đọc.";
    if (status === "error") return errorMessage ?? "Không thể phát giọng đọc.";
    if (status === "speaking") return `Đang đọc ${activeLabel ?? "nội dung đã chọn"}…`;
    if (status === "finished") return `Đã đọc xong ${activeLabel ?? "nội dung đã chọn"}.`;
    return "Sẵn sàng đọc transcript và bài nghe.";
  })();

  return (
    <aside
      aria-label="Điều khiển giọng đọc máy"
      className={`mt-4 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-slate-700 ${className}`}
    >
      <Volume2 aria-hidden="true" className="shrink-0 text-teal-700" size={18} />
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-slate-900">Giọng đọc máy</p>
        <p aria-live="polite" aria-atomic="true" className="break-words text-xs leading-5">
          {statusText}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-label="Phát lại nội dung gần nhất"
          disabled={!supported || !hasReplay}
          onClick={replay}
          size="sm"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" size={15} />
          Phát lại
        </Button>
        <Button
          aria-label="Dừng giọng đọc"
          disabled={!supported || status !== "speaking"}
          onClick={stop}
          size="sm"
          variant="secondary"
        >
          <Square aria-hidden="true" size={14} />
          Dừng
        </Button>
      </div>
    </aside>
  );
}

export function useLessonSpeech(): LessonSpeechController {
  const controller = useContext(LessonSpeechContext);
  if (!controller) {
    throw new Error("useLessonSpeech must be used within LessonSpeechProvider");
  }
  return controller;
}
