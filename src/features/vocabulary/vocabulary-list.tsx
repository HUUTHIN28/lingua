import { AudioLines, BookMarked, Gauge } from "lucide-react";
import type { VocabularyItem } from "@/domain/lesson";
import type { TranscriptSegment } from "@/domain/transcript";
import type { LearningLevel } from "@/domain/language";
import { createTranscriptTimestampMap } from "@/features/transcript/source-links";

const formatDifficulty = (level: LearningLevel) => level.value.startsWith(level.system)
  ? level.value.replace(level.system, `${level.system} `)
  : `${level.system} ${level.value}`;

export function VocabularyList({ items, transcript }: { items: VocabularyItem[]; transcript: TranscriptSegment[] }) {
  const timestamps = createTranscriptTimestampMap(transcript);
  return (
    <section id="vocabulary" aria-labelledby="vocabulary-title" className="scroll-mt-24">
      <p className="text-sm font-bold text-[var(--brand)]">Từ vựng trọng tâm</p>
      <h2 id="vocabulary-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Từ, nghĩa và ví dụ trong ngữ cảnh</h2>
      {items.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">Bài học này chưa có từ vựng được trích xuất.</p> : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-black tracking-tight text-slate-950">{item.word}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold text-slate-600">
                      {item.partOfSpeech && <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.partOfSpeech}</span>}
                      {item.pronunciation && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-800"><AudioLines aria-hidden="true" size={13} />{item.pronunciation}</span>}
                      {item.difficulty && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-900"><Gauge aria-hidden="true" size={13} />{formatDifficulty(item.difficulty)}</span>}
                    </div>
                  </div>
                  <BookMarked aria-hidden="true" className="mt-0.5 shrink-0 text-teal-600" size={20} />
                </div>

                <div className="mt-4 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
                  <p className="text-sm font-bold text-teal-800">Nghĩa tiếng Việt</p>
                  <div><p className="font-bold text-slate-950">{item.translation}</p><p className="mt-0.5 text-sm leading-6 text-slate-600">{item.meaning}</p></div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3">
                  <p className="text-sm font-semibold leading-6 text-slate-900">{item.exampleSentence}</p>
                  <p lang="vi" className="mt-1 border-l-2 border-teal-200 pl-2.5 text-sm leading-6 text-slate-600">{item.exampleTranslation}</p>
                </div>
              </div>

              {item.sourceSegmentIds.length > 0 && <details className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
                <summary className="cursor-pointer text-sm font-bold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Mốc ngữ cảnh</summary>
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Nguồn transcript">{item.sourceSegmentIds.map((sourceId) => <a key={sourceId} href={`#segment-${sourceId}`} aria-label={`Xem ngữ cảnh tại ${timestamps.get(sourceId) ?? sourceId}`} className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100">{timestamps.get(sourceId) ?? "Nguồn"}</a>)}</div>
              </details>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
