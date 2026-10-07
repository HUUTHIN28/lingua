import Link from "next/link";
import { ArrowUpRight, BookOpen, Video } from "lucide-react";
import type { LessonProgress, VideoProgress } from "@/domain/progress";
import { formatDate } from "@/lib/format";

export function ProgressList({ lessons, videos }: { lessons: LessonProgress[]; videos: VideoProgress[] }) {
  if (lessons.length === 0 && videos.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><BookOpen aria-hidden="true" /></span>
        <h2 className="mt-4 text-xl font-black text-slate-950">Chưa có tiến độ học</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Tạo bài học từ một video rồi hoàn thành bài tập đầu tiên. Kết quả sẽ xuất hiện tại đây.</p>
        <Link href="/my-videos/new" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white hover:bg-[var(--brand-deep)]">Tạo bài học đầu tiên</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="lesson-progress-title">
        <h2 id="lesson-progress-title" className="text-lg font-black text-slate-950">Tiến độ bài học</h2>
        <div className="mt-3 space-y-3">
          {lessons.length === 0 ? <EmptyRow label="Bạn chưa bắt đầu bài học nào." /> : lessons.map((lesson, index) => (
            <article key={lesson.lessonId} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Bài học {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Cập nhật {formatDate(lesson.lastStudiedAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.completed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{lesson.completed ? "Hoàn thành" : "Đang học"}</span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div><p className="text-2xl font-black text-slate-950">{lesson.score}%</p><p className="text-xs text-slate-500">{lesson.completedExercises}/{lesson.totalExercises} câu</p></div>
                <Link href={`/learn/${lesson.lessonId}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Tiếp tục <ArrowUpRight aria-hidden="true" size={15} /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="video-progress-title">
        <h2 id="video-progress-title" className="text-lg font-black text-slate-950">Theo video</h2>
        <div className="mt-3 space-y-3">
          {videos.length === 0 ? <EmptyRow label="Chưa có video nào được học." /> : videos.map((video, index) => (
            <article key={video.videoId} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Video aria-hidden="true" size={19} /></span>
                  <div><p className="font-extrabold text-slate-900">Video {index + 1}</p><p className="text-xs text-slate-500">{video.lastStudiedAt ? formatDate(video.lastStudiedAt) : "Chưa bắt đầu"}</p></div>
                </div>
                <span className="text-lg font-black text-teal-800">{video.progressPercent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${video.progressPercent}%` }} /></div>
              <Link href={`/my-videos/${video.videoId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:underline">Mở video <ArrowUpRight aria-hidden="true" size={14} /></Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{label}</p>;
}
