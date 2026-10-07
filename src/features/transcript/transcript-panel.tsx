"use client";

import { useState } from "react";
import { BadgeInfo, Languages, Play } from "lucide-react";
import type { TranscriptProvenance, TranscriptSegment } from "@/domain/transcript";
import { LessonSpeechControls, useLessonSpeech } from "@/features/speech/lesson-speech-controller";
import { formatTimestamp } from "@/lib/format";

export function TranscriptPanel({
  transcript,
  transcriptProvenance,
}: {
  transcript: TranscriptSegment[];
  transcriptProvenance?: TranscriptProvenance;
}) {
  const { speak, supported } = useLessonSpeech();
  const [bilingual, setBilingual] = useState(false);
  const kind = transcriptProvenance?.kind ?? "demo";
  const sourceLabel = kind === "youtube-manual-captions"
    ? "Phụ đề do video cung cấp"
    : kind === "youtube-auto-captions"
      ? "Phụ đề tự động của video"
      : kind === "gemini-video"
        ? "Lời thoại phân tích từ video bằng Gemini"
        : "Transcript mẫu · không lấy từ video này";
  const sourceDescription = kind === "gemini-video"
    ? "Không lấy được phụ đề phù hợp; mốc thời gian do AI ước lượng và có thể sai lệch."
    : kind === "demo"
      ? "Nội dung minh họa, không phản ánh lời thoại của video bạn gửi."
      : "Nội dung được lấy từ phụ đề video bằng yt-dlp; mốc thời gian theo phụ đề gốc.";
  return (
    <section id="transcript" aria-labelledby="transcript-title" className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--brand)]">Nghe và đọc</p>
          <h2 id="transcript-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Transcript</h2>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1" aria-label="Chế độ hiển thị transcript">
          <button type="button" aria-pressed={!bilingual} onClick={() => setBilingual(false)} className={`min-h-9 rounded-lg px-3 text-sm font-bold ${!bilingual ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Tiếng Anh</button>
          <button type="button" aria-pressed={bilingual} onClick={() => setBilingual(true)} className={`min-h-9 rounded-lg px-3 text-sm font-bold ${bilingual ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Languages aria-hidden="true" className="mr-1 inline" size={15} />Song ngữ</button>
        </div>
      </div>

      <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${kind === "demo" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-teal-200 bg-teal-50 text-teal-950"}`}>
        <BadgeInfo aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        <p>
          <strong>{sourceLabel}</strong><br />
          {sourceDescription} Âm thanh ở các nút nghe được phát bằng giọng đọc máy của trình duyệt.
          {transcriptProvenance?.durationSeconds != null && (
            <> Thời lượng video: {formatTimestamp(transcriptProvenance.durationSeconds)}.</>
          )}
          {transcript.length > 0 && kind !== "demo" && (
            <> {transcript.length} đoạn lời thoại, từ {formatTimestamp(transcript[0].startTimeSeconds)} đến {formatTimestamp(transcript[transcript.length - 1].endTimeSeconds)}.</>
          )}
        </p>
      </div>
      <LessonSpeechControls />

      <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        {transcript.map((segment, index) => (
          <li key={segment.id} id={`segment-${segment.id}`} className={`grid gap-3 p-4 sm:grid-cols-[6.5rem_1fr] sm:p-5 ${index > 0 ? "border-t border-slate-100" : ""}`}>
            <div>
              {supported ? (
                <button
                  type="button"
                  onClick={() => speak({
                    text: segment.text,
                    label: `đoạn transcript ${formatTimestamp(segment.startTimeSeconds)}–${formatTimestamp(segment.endTimeSeconds)}`,
                  })}
                  aria-label={`Đọc đoạn transcript từ ${formatTimestamp(segment.startTimeSeconds)} đến ${formatTimestamp(segment.endTimeSeconds)} bằng giọng đọc máy`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 text-sm font-extrabold text-teal-800 transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  <Play aria-hidden="true" size={14} fill="currentColor" />
                  {formatTimestamp(segment.startTimeSeconds)}
                </button>
              ) : (
                <span className="text-sm font-bold text-slate-500" title="Trình duyệt chưa hỗ trợ giọng đọc">{formatTimestamp(segment.startTimeSeconds)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-7 text-slate-900">{segment.text}</p>
              {bilingual && <p lang="vi" className="mt-1.5 border-l-2 border-teal-200 pl-3 text-sm leading-6 text-slate-600">
                {segment.translation ?? "Chưa có bản dịch cho đoạn này."}
              </p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
