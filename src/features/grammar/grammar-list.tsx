import { Braces, Gauge } from "lucide-react";
import type { GrammarPoint } from "@/domain/lesson";
import type { TranscriptSegment } from "@/domain/transcript";
import type { LearningLevel } from "@/domain/language";
import { createTranscriptTimestampMap } from "@/features/transcript/source-links";

const formatDifficulty = (level: LearningLevel) => level.value.startsWith(level.system)
  ? level.value.replace(level.system, `${level.system} `)
  : `${level.system} ${level.value}`;

export function GrammarList({ items, transcript }: { items: GrammarPoint[]; transcript: TranscriptSegment[] }) {
  const timestamps = createTranscriptTimestampMap(transcript);
  return (
    <section id="grammar" aria-labelledby="grammar-title" className="scroll-mt-24">
      <p className="text-sm font-bold text-[var(--brand)]">Ngữ pháp ứng dụng</p>
      <h2 id="grammar-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Cấu trúc, cách dùng và ví dụ</h2>
      {items.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">Bài học này chưa có điểm ngữ pháp được trích xuất.</p> : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {items.map((point, index) => {
            const firstExample = point.examples[0];
            const secondaryExamples = point.examples.slice(1);
            const hasSecondary = secondaryExamples.length > 0 || point.sourceSegmentIds.length > 0;
            return (
              <article key={point.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-sm font-black text-teal-800">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-950">{point.title}</h3>
                        {point.difficulty && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900"><Gauge aria-hidden="true" size={13} />{formatDifficulty(point.difficulty)}</span>}
                      </div>
                      {point.pattern && <div className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-slate-100"><Braces aria-hidden="true" className="mt-0.5 shrink-0 text-teal-300" size={15} /><code className="break-words text-xs font-bold sm:text-sm">{point.pattern}</code></div>}
                    </div>
                  </div>

                  <p lang="vi" className="mt-4 text-sm leading-6 text-slate-700">{point.explanation}</p>

                  {firstExample && <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3">
                    <p className="text-sm font-semibold leading-6 text-slate-900">{firstExample.sentence}</p>
                    <p lang="vi" className="mt-1 border-l-2 border-teal-200 pl-2.5 text-sm leading-6 text-slate-600">{firstExample.translation}</p>
                  </div>}
                </div>

                {hasSecondary && <details className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
                  <summary className="cursor-pointer text-sm font-bold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">{secondaryExamples.length > 0 ? "Ví dụ khác và mốc ngữ cảnh" : "Mốc ngữ cảnh"}</summary>
                  {secondaryExamples.length > 0 && <div className="mt-3 space-y-2">{secondaryExamples.map((example, exampleIndex) => <div key={`${example.sourceSegmentId}-${exampleIndex + 1}`} className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-sm font-semibold leading-6 text-slate-900">{example.sentence}</p><p lang="vi" className="mt-1 text-sm leading-6 text-slate-600">{example.translation}</p></div>)}</div>}
                  {point.sourceSegmentIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Nguồn transcript">{point.sourceSegmentIds.map((sourceId) => <a key={sourceId} href={`#segment-${sourceId}`} aria-label={`Xem câu trong transcript tại ${timestamps.get(sourceId) ?? sourceId}`} className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100">{timestamps.get(sourceId) ?? "Nguồn"}</a>)}</div>}
                </details>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
