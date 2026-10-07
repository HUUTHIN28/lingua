import { CheckCircle2, CircleAlert, Lightbulb, Target, Trophy } from "lucide-react";
import type { LessonAssessmentReport } from "@/domain/progress";

const BAND_LABELS: Record<LessonAssessmentReport["band"], string> = {
  "needs-review": "Cần ôn lại",
  developing: "Đang tiến bộ",
  strong: "Nắm khá chắc",
};

export function ExerciseAssessment({
  assessment,
  headingRef,
}: {
  assessment: LessonAssessmentReport;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const mistakesByType = assessment.byType.flatMap((typeAssessment) => {
    const mistakes = assessment.mistakes.filter((mistake) => mistake.type === typeAssessment.type);
    return mistakes.length ? [{ ...typeAssessment, mistakes }] : [];
  });
  const highestPriorityType = assessment.recommendations.find((item) => item.priority === "high")?.type;

  return (
    <section aria-labelledby="assessment-title" className="mt-8 overflow-hidden rounded-3xl border border-teal-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white sm:p-8">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-teal-200">Đánh giá sau bài học</p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="grid size-24 shrink-0 place-items-center rounded-full border-4 border-teal-300 bg-white/10" aria-label={`Tổng điểm ${assessment.score} phần trăm`}>
            <span className="text-3xl font-black">{assessment.score}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 ref={headingRef} tabIndex={-1} id="assessment-title" className="text-2xl font-black outline-none sm:text-3xl">
              {BAND_LABELS[assessment.band]}
            </h2>
            <p className="mt-2 max-w-3xl leading-7 text-teal-50">{assessment.summary}</p>
            <p className="mt-3 text-sm font-bold text-teal-100">Đúng ngay lần đầu {assessment.correctExercises}/{assessment.totalExercises} câu</p>
          </div>
        </div>
      </div>

      <div className="space-y-9 p-5 sm:p-8">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Trophy aria-hidden="true" className="text-amber-600" size={22} /> Điểm theo dạng bài</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assessment.byType.map((item) => (
              <article key={item.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-extrabold text-slate-900">{item.label}</h4>
                  <span className="text-lg font-black text-teal-800">{item.score}%</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">Đúng {item.correct}/{item.total} câu ngay lần đầu</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${item.score}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Target aria-hidden="true" className="text-rose-600" size={22} /> Bạn đang gặp khó khăn ở đâu?</h3>
          {assessment.mistakes.length === 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" />
              <p className="font-semibold">Không có câu sai ở lần làm đầu tiên. Bạn đã hoàn thành rất tốt tất cả dạng bài.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {mistakesByType.map((group) => (
                <details key={group.type} open={group.type === highestPriorityType} className="group rounded-2xl border border-rose-200 bg-rose-50/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-black text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]">
                    <span>{group.label}</span>
                    <span className="text-sm text-rose-800">{group.mistakes.length} câu cần xem lại · {group.score}%</span>
                  </summary>
                  <ol className="space-y-3 border-t border-rose-200 p-3 sm:p-4">
                    {group.mistakes.map((mistake, index) => (
                <li key={mistake.exerciseId} id={`assessment-mistake-${mistake.exerciseId}`} className="rounded-xl bg-white/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-rose-700 text-xs font-black text-white">{index + 1}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-rose-800">{mistake.typeLabel}</span>
                    {mistake.resolvedAfterRetry && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">Đã sửa đúng sau khi thử lại</span>}
                  </div>
                  <p className="mt-3 font-extrabold leading-6 text-slate-950">{mistake.question}</p>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl bg-white p-3"><dt className="font-bold text-slate-500">Câu trả lời đầu tiên</dt><dd className="mt-1 break-words font-semibold text-rose-800">{mistake.submittedAnswer}</dd></div>
                    <div className="min-w-0 rounded-xl bg-white p-3"><dt className="font-bold text-slate-500">Đáp án mẫu</dt><dd className="mt-1 break-words font-semibold text-emerald-800">{mistake.expectedAnswer}</dd></div>
                  </dl>
                  <p className="mt-3 text-sm leading-6 text-slate-700"><span className="font-bold">Giải thích:</span> {mistake.explanation}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">Số lần đã thử: {mistake.attemptCount}</p>
                </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Lightbulb aria-hidden="true" className="text-amber-600" size={22} /> Nên học gì để cải thiện?</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {assessment.recommendations.map((recommendation) => (
              <article key={recommendation.type ?? "maintenance"} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  {recommendation.priority === "high" && <CircleAlert aria-hidden="true" className="text-rose-700" size={20} />}
                  <h4 className="font-black text-slate-950">{recommendation.label}</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{recommendation.observation}</p>
                <h5 className="mt-4 text-sm font-extrabold text-slate-900">Nội dung nên học</h5>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{recommendation.studyTopics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
                <h5 className="mt-4 text-sm font-extrabold text-slate-900">Hành động luyện tập</h5>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">{recommendation.actions.map((action) => <li key={action}>{action}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
