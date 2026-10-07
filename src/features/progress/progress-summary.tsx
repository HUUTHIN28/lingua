import { BookCheck, Flame, Gauge, Trophy } from "lucide-react";
import type { LessonProgress, VideoProgress } from "@/domain/progress";

export function ProgressSummary({ lessons, videos }: { lessons: LessonProgress[]; videos: VideoProgress[] }) {
  const completedLessons = lessons.filter((lesson) => lesson.completed).length;
  const averageScore = lessons.length
    ? Math.round(lessons.reduce((total, lesson) => total + lesson.score, 0) / lessons.length)
    : 0;
  const exercises = lessons.reduce((total, lesson) => total + lesson.completedExercises, 0);
  const activeVideos = videos.filter((video) => video.progressPercent > 0).length;
  const cards = [
    { label: "Bài đã hoàn thành", value: completedLessons, detail: `trên ${lessons.length} bài`, icon: BookCheck, tone: "bg-emerald-50 text-emerald-800" },
    { label: "Điểm trung bình", value: `${averageScore}%`, detail: "mọi bài đã học", icon: Trophy, tone: "bg-amber-50 text-amber-800" },
    { label: "Câu đã luyện", value: exercises, detail: "lượt bài khác nhau", icon: Gauge, tone: "bg-sky-50 text-sky-800" },
    { label: "Video đang học", value: activeVideos, detail: "trong phiên hiện tại", icon: Flame, tone: "bg-violet-50 text-violet-800" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <article key={label} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={20} /></span>
          <p className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        </article>
      ))}
    </div>
  );
}
