import { useId } from "react";
import { Keyboard, Play } from "lucide-react";
import { Textarea } from "@/components/ui/field";
import { formatTimestamp } from "@/lib/format";
import { LessonSpeechControls, useLessonSpeech } from "@/features/speech/lesson-speech-controller";
import type { ExerciseOfType, TimedExerciseInputProps } from "./types";

export function Dictation({ exercise, value, onChange, disabled, speechText }: TimedExerciseInputProps<ExerciseOfType<"dictation">>) {
  const inputId = useId();
  const { speak, supported } = useLessonSpeech();
  const canSpeak = supported && Boolean(speechText);
  return (
    <div>
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="flex items-center gap-2 font-bold text-violet-950"><Keyboard aria-hidden="true" size={19} /> Chính tả · Giọng đọc máy · {formatTimestamp(exercise.startTimeSeconds)}–{formatTimestamp(exercise.endTimeSeconds)}</p>
        <p className="mt-1 text-sm leading-6 text-violet-800">Nghe kỹ rồi chép lại nguyên câu. Dấu câu và chữ hoa không ảnh hưởng kết quả.</p>
        {canSpeak ? (
          <button
            type="button"
            onClick={() => speak({ text: speechText!, label: `bài chính tả ${formatTimestamp(exercise.startTimeSeconds)}–${formatTimestamp(exercise.endTimeSeconds)}` })}
            aria-label={`Đọc bài chính tả từ ${formatTimestamp(exercise.startTimeSeconds)} đến ${formatTimestamp(exercise.endTimeSeconds)} bằng giọng đọc máy`}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-700 px-3.5 text-sm font-bold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2"
          >
            <Play aria-hidden="true" size={16} fill="currentColor" /> Nghe bằng giọng đọc
          </button>
        ) : <p className="mt-2 text-sm text-violet-800">{supported ? "Không tìm thấy đoạn transcript để đọc. Bạn vẫn có thể trả lời câu hỏi." : "Trình duyệt chưa hỗ trợ giọng đọc. Bạn vẫn có thể trả lời câu hỏi."}</p>}
        <LessonSpeechControls className="border-violet-200 bg-white/70" />
      </div>
      <label htmlFor={inputId} className="mt-4 block text-sm font-bold text-slate-800">Nội dung bạn nghe được</label>
      <Textarea id={inputId} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} spellCheck={false} placeholder="Chép lại câu ở đây…" />
    </div>
  );
}
