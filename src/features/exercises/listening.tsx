import { useId } from "react";
import { Headphones, Play } from "lucide-react";
import { Input } from "@/components/ui/field";
import { formatTimestamp } from "@/lib/format";
import { LessonSpeechControls, useLessonSpeech } from "@/features/speech/lesson-speech-controller";
import type { ExerciseOfType, TimedExerciseInputProps } from "./types";

export function Listening({ exercise, value, onChange, disabled, speechText }: TimedExerciseInputProps<ExerciseOfType<"listening">>) {
  const inputId = useId();
  const { speak, supported } = useLessonSpeech();
  const canSpeak = supported && Boolean(speechText);
  return (
    <div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="flex items-center gap-2 font-bold text-sky-950"><Headphones aria-hidden="true" size={19} /> Nghe hiểu · Giọng đọc máy · {formatTimestamp(exercise.startTimeSeconds)}–{formatTimestamp(exercise.endTimeSeconds)}</p>
        <p className="mt-1 text-sm leading-6 text-sky-800">Nghe rồi trả lời ngắn gọn câu hỏi phía trên.</p>
        {canSpeak ? (
          <button
            type="button"
            onClick={() => speak({ text: speechText!, label: `bài nghe ${formatTimestamp(exercise.startTimeSeconds)}–${formatTimestamp(exercise.endTimeSeconds)}` })}
            aria-label={`Đọc bài nghe từ ${formatTimestamp(exercise.startTimeSeconds)} đến ${formatTimestamp(exercise.endTimeSeconds)} bằng giọng đọc máy`}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-700 px-3.5 text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"
          >
            <Play aria-hidden="true" size={16} fill="currentColor" /> Nghe bằng giọng đọc
          </button>
        ) : <p className="mt-2 text-sm text-sky-800">{supported ? "Không tìm thấy đoạn transcript để đọc. Bạn vẫn có thể trả lời câu hỏi." : "Trình duyệt chưa hỗ trợ giọng đọc. Bạn vẫn có thể trả lời câu hỏi."}</p>}
        <LessonSpeechControls className="border-sky-200 bg-white/70" />
      </div>
      <label htmlFor={inputId} className="mt-4 block text-sm font-bold text-slate-800">Câu trả lời của bạn</label>
      <Input id={inputId} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} autoComplete="off" placeholder="Nhập câu trả lời ngắn…" />
    </div>
  );
}
