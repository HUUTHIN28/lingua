"use client";

import Link from "next/link";
import { Check, Circle, CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import type { LearningGenerationJob, ProcessingStatus } from "@/domain/job";
import type { YouTubeVideo } from "@/domain/video";
import { Button } from "@/components/ui/button";

type TranscriptMode = "youtube" | "demo";

const youtubeStages: { status: ProcessingStatus; label: string; description: string }[] = [
  { status: "fetching-transcript", label: "Lấy lời thoại từ video", description: "Ưu tiên phụ đề bằng yt-dlp, sau đó xử lý nguồn dự phòng nếu cần." },
  { status: "analyzing", label: "Phân tích nội dung", description: "Nhận diện chủ đề và độ khó." },
  { status: "generating-vocabulary", label: "Chọn từ vựng", description: "Lọc các từ đáng học trong ngữ cảnh." },
  { status: "generating-grammar", label: "Giải thích ngữ pháp", description: "Tìm cấu trúc xuất hiện trong video." },
  { status: "generating-lesson", label: "Soạn bài học", description: "Sắp xếp nội dung thành từng phần." },
  { status: "generating-exercises", label: "Tạo bài luyện tập", description: "Chuẩn bị năm dạng bài tập." },
];

const demoStages: typeof youtubeStages = [
  { status: "fetching-transcript", label: "Chuẩn bị transcript mẫu", description: "Dùng hội thoại mẫu và mốc thời gian minh họa; chưa lấy lời thoại từ video này." },
  { status: "analyzing", label: "Phân tích nội dung mẫu", description: "Nhận diện chủ đề và độ khó trong hội thoại mẫu." },
  { status: "generating-vocabulary", label: "Chọn từ vựng", description: "Lọc các từ đáng học trong hội thoại mẫu." },
  { status: "generating-grammar", label: "Giải thích ngữ pháp", description: "Tìm cấu trúc xuất hiện trong nội dung mẫu." },
  { status: "generating-lesson", label: "Soạn bài học", description: "Sắp xếp nội dung mẫu thành từng phần." },
  { status: "generating-exercises", label: "Tạo bài luyện tập", description: "Chuẩn bị năm dạng bài tập từ nội dung mẫu." },
];
const stagesFor = (mode: TranscriptMode) => mode === "demo" ? demoStages : youtubeStages;

const stageIndex = (status: ProcessingStatus) => {
  if (status === "pending") return -1;
  if (status === "completed") return youtubeStages.length;
  if (status === "failed") return -1;
  return youtubeStages.findIndex((stage) => stage.status === status);
};

export function ProcessingStatusCard({
  video,
  job,
  transcriptMode,
  retrying,
  retryError,
  onRetry,
}: {
  video: YouTubeVideo;
  job: LearningGenerationJob | null;
  transcriptMode: TranscriptMode;
  retrying: boolean;
  retryError?: string;
  onRetry: () => void;
}) {
  const currentIndex = job ? stageIndex(job.status) : -1;
  const failed = job?.status === "failed" || video.status === "failed";
  const needsStart = !job && video.status === "pending";
  const progress = job?.progress ?? video.processingProgress ?? 0;
  const stages = stagesFor(transcriptMode);

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] sm:p-8">
      <div aria-live="polite" aria-atomic="true" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--brand-deep)]">Tiến trình bài học</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{video.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{failed ? "Quá trình đã dừng và có thể thử lại." : job?.currentStep ?? "Đang chuẩn bị tác vụ…"}</p>
        </div>
        <span className="text-3xl font-black tabular-nums text-slate-950">{progress}%</span>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Tiến độ tạo bài học" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${failed ? "bg-rose-500" : "bg-[var(--brand)]"}`} style={{ width: `${progress}%` }} />
      </div>

      <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${transcriptMode === "demo" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-teal-200 bg-teal-50 text-teal-950"}`}>
        <p className="font-extrabold">{transcriptMode === "demo" ? "Chế độ nội dung mẫu" : "Đang lấy nội dung video thật"}</p>
        <p>{transcriptMode === "demo" ? "Bản hiện tại dùng transcript mẫu để tạo bài học và không phân tích âm thanh hay lời thoại của video bạn gửi." : "Hệ thống thử phụ đề của video bằng yt-dlp trước. Nếu video không có phụ đề phù hợp, nguồn dự phòng sẽ được ghi rõ trong bài học."}</p>
      </div>

      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {stages.map((stage, index) => {
          const complete = job?.status === "completed" || (!failed && index < currentIndex);
          const current = !failed && index === currentIndex;
          return (
            <li key={stage.status} aria-current={current ? "step" : undefined} className={`flex gap-3 rounded-2xl border p-4 ${current ? "border-teal-300 bg-teal-50" : complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60"}`}>
              <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${current ? "bg-[var(--brand)] text-white" : complete ? "bg-emerald-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-300"}`}>
                {complete ? <Check aria-hidden="true" size={16} /> : current ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Circle aria-hidden="true" size={14} />}
              </span>
              <div><p className="font-extrabold text-slate-900">{stage.label}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{stage.description}</p></div>
            </li>
          );
        })}
      </ol>

      {failed && (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex gap-3"><CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-rose-700" size={21} /><div><p className="font-black text-rose-950">Chưa thể tạo bài học</p><p className="mt-1 text-sm leading-relaxed text-rose-800">{job?.error ?? video.errorMessage ?? "Đã xảy ra lỗi trong quá trình xử lý."}</p></div></div>
          {retryError && <p className="mt-3 text-sm font-medium text-rose-800">{retryError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onRetry} disabled={retrying}><RotateCcw aria-hidden="true" size={17} />{retrying ? "Đang khởi động lại…" : "Thử lại"}</Button>
            <Link href={`/my-videos/${video.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">Quay lại video</Link>
          </div>
        </div>
      )}
      {needsStart && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-black text-amber-950">Bài học chưa được khởi động</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">Cấu hình đã sẵn sàng. Bắt đầu quy trình để tạo nội dung học mới.</p>
          {retryError && <p role="alert" className="mt-3 text-sm font-medium text-rose-800">{retryError}</p>}
          <Button className="mt-4" onClick={onRetry} disabled={retrying}>
            <RotateCcw aria-hidden="true" size={17} />{retrying ? "Đang khởi động…" : "Bắt đầu tạo bài học"}
          </Button>
        </div>
      )}
    </div>
  );
}
