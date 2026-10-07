import { BookOpenCheck, Clock3, Layers3, Sparkles, Target } from "lucide-react";
import type { PublicLesson } from "@/domain/lesson";
import type { LessonProgress } from "@/domain/progress";
import { formatLearningLevel, LEARNING_FOCUS_LABELS, type LearningFocus } from "@/domain/language";

const FOCUS_GUIDANCE: Record<LearningFocus, string> = {
  speaking: "Đọc câu trả lời thành tiếng, sau đó nhập lại để kiểm tra nội dung.",
  listening: "Nghe để tìm ý chính và chi tiết; phần chính tả mới yêu cầu chép nguyên câu.",
  grammar: "Quan sát cấu trúc, cách dùng và ví dụ trong transcript trước khi làm bài.",
  comprehensive: "Kết hợp nghe, từ vựng, ngữ pháp và diễn đạt trong cùng một bài học.",
};

export function LessonOverview({ lesson, progress }: { lesson: PublicLesson; progress: LessonProgress }) {
  const sections = [...lesson.sections].sort((left, right) => left.order - right.order);
  const stats = [
    { label: "Trình độ", value: formatLearningLevel(lesson.level), icon: Sparkles },
    { label: "Chặng học", value: `${sections.length} phần`, icon: Layers3 },
    { label: "Thực hành", value: `${lesson.exercises.length} bài`, icon: BookOpenCheck },
    { label: "Tiến độ", value: `${progress.completedExercises}/${progress.totalExercises}`, icon: Clock3 },
  ];
  const started = progress.completedExercises > 0;

  return (
    <section id="overview" aria-labelledby="lesson-title" className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="relative px-5 py-7 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-16 -top-28 size-72 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2.5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Bài học theo ngữ cảnh</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/25 bg-teal-300/10 px-2.5 py-1 text-xs font-bold text-teal-200"><Target aria-hidden="true" size={14} />{LEARNING_FOCUS_LABELS[lesson.learningFocus]}</span>
        </div>
        <h1 id="lesson-title" className="relative mt-3 max-w-4xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">{lesson.title}</h1>
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm"><strong>Trình độ:</strong> {formatLearningLevel(lesson.level)}</span>
          <span className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm"><strong>Tiến độ:</strong> {progress.completedExercises}/{progress.totalExercises}</span>
          <a href="#practice" className="inline-flex min-h-11 items-center rounded-xl bg-teal-400 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{started ? "Tiếp tục học" : "Bắt đầu học"}</a>
        </div>
        <details className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <summary className="cursor-pointer font-bold text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">Xem chi tiết bài học</summary>
          <div className="mt-4 space-y-4">
            <p className="max-w-3xl leading-7 text-slate-300">{lesson.description}</p>
            <p className="max-w-3xl text-sm leading-6 text-slate-200">{FOCUS_GUIDANCE[lesson.learningFocus]}</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><Icon aria-hidden="true" className="text-teal-300" size={18} /><p className="mt-2 text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}
            </div>
            <p className="max-w-4xl leading-7 text-slate-200">{lesson.summary}</p>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Nội dung bài học">
              {sections.map((section, index) => <li key={section.id} className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3"><p className="text-xs font-bold text-teal-300">Phần {section.order > 0 ? section.order : index + 1}</p><p className="mt-1 text-sm font-bold">{section.title}</p></li>)}
            </ol>
          </div>
        </details>
      </div>
    </section>
  );
}
