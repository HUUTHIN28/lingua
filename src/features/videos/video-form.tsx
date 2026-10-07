"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, WandSparkles } from "lucide-react";
import type { LearningFocus, LearningLevel, LanguageCode } from "@/domain/language";
import {
  DEFAULT_LEARNING_FOCUS,
  DEFAULT_LANGUAGE_CONFIG,
  LANGUAGE_LABELS,
  LEARNING_FOCUS_LABELS,
} from "@/domain/language";
import type { CreateVideoInput, UpdateVideoInput, YouTubeVideo } from "@/domain/video";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ApiClientError } from "@/lib/api-contract";
import { validateYouTubeUrl } from "@/lib/youtube";

type SubmitInput = CreateVideoInput | UpdateVideoInput;
type VideoFormProps = {
  video?: YouTubeVideo;
  busy?: boolean;
  serverError?: Error | null;
  onSubmit: (input: SubmitInput) => Promise<void>;
};

const languageOptions = Object.entries(LANGUAGE_LABELS) as [LanguageCode, string][];
const focusOptions: LearningFocus[] = ["comprehensive", "speaking", "listening", "grammar"];

const levelOptions: Record<LanguageCode, { system: LearningLevel["system"]; values: string[] }> = {
  en: { system: "CEFR", values: ["A1", "A2", "B1", "B2", "C1", "C2"] },
  vi: { system: "CEFR", values: ["A1", "A2", "B1", "B2", "C1", "C2"] },
  zh: { system: "HSK", values: ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"] },
  ja: { system: "JLPT", values: ["N5", "N4", "N3", "N2", "N1"] },
};

const serializeLevel = (level: LearningLevel | null) =>
  level ? `${level.system}:${level.value}` : "auto";

const parseLevel = (value: string): LearningLevel | null => {
  if (value === "auto") return null;
  const [system, level] = value.split(":");
  if (system === "CEFR" && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(level)) {
    return { system, value: level as "A1" | "A2" | "B1" | "B2" | "C1" | "C2" };
  }
  if (system === "HSK" && ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"].includes(level)) {
    return { system, value: level as "HSK1" | "HSK2" | "HSK3" | "HSK4" | "HSK5" | "HSK6" };
  }
  if (system === "JLPT" && ["N5", "N4", "N3", "N2", "N1"].includes(level)) {
    return { system, value: level as "N5" | "N4" | "N3" | "N2" | "N1" };
  }
  return null;
};

export function VideoForm({ video, busy = false, serverError, onSubmit }: VideoFormProps) {
  const [youtubeUrl, setYoutubeUrl] = useState(video?.youtubeUrl ?? "");
  const [title, setTitle] = useState(video?.title ?? "");
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>(
    video?.learningLanguage ?? DEFAULT_LANGUAGE_CONFIG.learningLanguage,
  );
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(
    video?.nativeLanguage ?? DEFAULT_LANGUAGE_CONFIG.nativeLanguage,
  );
  const [targetLevel, setTargetLevel] = useState<LearningLevel | null>(
    video?.targetLevel ?? DEFAULT_LANGUAGE_CONFIG.targetLevel,
  );
  const [learningFocus, setLearningFocus] = useState<LearningFocus>(
    video?.learningFocus ?? DEFAULT_LEARNING_FOCUS,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const focusUrlInput = () => {
    const input = formRef.current?.querySelector('input[type="url"]');
    if (input instanceof HTMLInputElement) input.focus();
  };

  useEffect(() => {
    if (!targetLevel || targetLevel.system === levelOptions[learningLanguage].system) return;
    setTargetLevel(null);
  }, [learningLanguage, targetLevel]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!validateYouTubeUrl(youtubeUrl)) {
      nextErrors.youtubeUrl = "Hãy dùng URL youtube.com/watch, youtu.be hoặc youtube.com/embed hợp lệ.";
    }
    if (video && !title.trim()) nextErrors.title = "Tiêu đề không được để trống.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusUrlInput();
      return;
    }

    try {
      await onSubmit({
        youtubeUrl: youtubeUrl.trim(),
        learningLanguage,
        nativeLanguage,
        targetLevel,
        learningFocus,
        ...(video ? { title: title.trim() } : {}),
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors) {
        const fieldErrors = Object.fromEntries(
          Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages[0] ?? error.message]),
        );
        setErrors(fieldErrors);
        if (fieldErrors.youtubeUrl) focusUrlInput();
      }
    }
  };

  const options = levelOptions[learningLanguage];
  const visibleServerError = serverError && !(serverError instanceof ApiClientError && serverError.fieldErrors)
    ? serverError.message
    : null;

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={handleSubmit}
      aria-describedby={video ? "video-generation-change-warning" : undefined}
      noValidate
    >
      {visibleServerError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {visibleServerError}
        </div>
      )}

      {video && (
        <Field label="Tên video" error={errors.title}>
          {(props) => (
            <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
          )}
        </Field>
      )}

      <Field
        label="URL YouTube"
        error={errors.youtubeUrl}
        hint="Hỗ trợ youtube.com/watch, youtu.be và youtube.com/embed."
      >
        {(props) => (
          <Input
            {...props}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(event) => {
              setYoutubeUrl(event.target.value);
              if (errors.youtubeUrl) setErrors((current) => ({ ...current, youtubeUrl: "" }));
            }}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngôn ngữ muốn học" error={errors.learningLanguage}>
          {(props) => (
            <Select
              {...props}
              value={learningLanguage}
              onChange={(event) => setLearningLanguage(event.target.value as LanguageCode)}
            >
              {languageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Ngôn ngữ giải thích" error={errors.nativeLanguage}>
          {(props) => (
            <Select {...props} value={nativeLanguage} onChange={(event) => setNativeLanguage(event.target.value as LanguageCode)}>
              {languageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Trình độ mục tiêu" error={errors.targetLevel} hint="Chọn Tự động để LinguaTube tự cân chỉnh độ khó.">
        {(props) => (
          <Select {...props} value={serializeLevel(targetLevel)} onChange={(event) => setTargetLevel(parseLevel(event.target.value))}>
            <option value="auto">Tự động</option>
            {options.values.map((value) => (
              <option key={value} value={`${options.system}:${value}`}>
                {options.system === "HSK" ? value.replace("HSK", "HSK ") : value}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Trọng tâm học"
        error={errors.learningFocus}
        hint="Nội dung và bài tập sẽ ưu tiên kỹ năng bạn chọn."
      >
        {(props) => (
          <Select
            {...props}
            required
            value={learningFocus}
            onChange={(event) => setLearningFocus(event.target.value as LearningFocus)}
          >
            {focusOptions.map((value) => (
              <option key={value} value={value}>{LEARNING_FOCUS_LABELS[value]}</option>
            ))}
          </Select>
        )}
      </Field>

      {video && (
        <p id="video-generation-change-warning" className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Thay đổi URL, ngôn ngữ, trình độ hoặc trọng tâm học sẽ tách bài học hiện tại. Sau khi lưu, bạn cần chủ động tạo lại bài học.
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={19} /> : <WandSparkles aria-hidden="true" size={19} />}
        {busy ? "Đang lưu…" : video ? "Lưu thay đổi" : "Tạo bài học"}
      </Button>
    </form>
  );
}
