"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import type { ExerciseCheckResult, PublicExercise } from "@/domain/exercise";
import type { ExerciseAttemptState, LessonAssessmentReport, LessonProgress } from "@/domain/progress";
import type { TranscriptSegment } from "@/domain/transcript";
import { Button } from "@/components/ui/button";
import { useCheckExercise } from "@/features/learning/hooks";
import { MultipleChoice } from "./multiple-choice";
import { FillBlank } from "./fill-blank";
import { Translation } from "./translation";
import { Listening } from "./listening";
import { Dictation } from "./dictation";
import { ExerciseFeedback } from "./exercise-feedback";
import { ExerciseAssessment } from "./exercise-assessment";
import { createTranscriptTextMap, resolveExerciseSpeechText } from "./resolve-speech-text";

const TYPE_LABELS: Record<PublicExercise["type"], string> = {
  "multiple-choice": "Trắc nghiệm", "fill-blank": "Điền vào chỗ trống", translation: "Dịch câu", listening: "Nghe hiểu", dictation: "Chính tả",
};
const TYPE_ORDER: PublicExercise["type"][] = ["multiple-choice", "fill-blank", "translation", "listening", "dictation"];

export function ExerciseRunner({ exercises, transcript, progress, exerciseStates, assessment, lessonId, videoId }: {
  exercises: PublicExercise[];
  transcript: TranscriptSegment[];
  progress: LessonProgress;
  exerciseStates: ExerciseAttemptState[];
  assessment: LessonAssessmentReport | null;
  lessonId: string;
  videoId: string;
}) {
  const groups = useMemo(() => TYPE_ORDER.flatMap((type) => {
    const items = exercises.filter((exercise) => exercise.type === type);
    return items.length ? [{ type, items }] : [];
  }), [exercises]);
  const [activeType, setActiveType] = useState<PublicExercise["type"]>(groups[0]?.type ?? "multiple-choice");
  const [localIndex, setLocalIndex] = useState(() => {
    const answered = new Set(exerciseStates.map((state) => state.exerciseId));
    const firstUnanswered = groups[0]?.items.findIndex((exercise) => !answered.has(exercise.id)) ?? -1;
    return firstUnanswered >= 0 ? firstUnanswered : 0;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, ExerciseCheckResult>>({});
  const feedbackRef = useRef<HTMLDivElement>(null);
  const assessmentHeadingRef = useRef<HTMLHeadingElement>(null);
  const assessmentWasVisible = useRef(Boolean(assessment));
  const mutation = useCheckExercise(lessonId, videoId);
  const statesById = useMemo(() => new Map(exerciseStates.map((state) => [state.exerciseId, state])), [exerciseStates]);
  const activeGroup = groups.find((group) => group.type === activeType) ?? groups[0];
  const activeExercise = activeGroup?.items[localIndex] ?? activeGroup?.items[0];
  const transcriptTextById = useMemo(() => createTranscriptTextMap(transcript), [transcript]);
  const firstAttemptCorrectCount = exerciseStates.filter((state) => state.firstAttemptCorrect).length;

  useEffect(() => { if (mutation.isSuccess) feedbackRef.current?.focus(); }, [mutation.isSuccess, mutation.data]);
  useEffect(() => { if (assessment && !assessmentWasVisible.current) assessmentHeadingRef.current?.focus(); assessmentWasVisible.current = Boolean(assessment); }, [assessment]);

  if (!activeExercise || !activeGroup) return null;
  const answer = drafts[activeExercise.id] ?? "";
  const result = feedback[activeExercise.id];
  const setAnswer = (value: string) => {
    setDrafts((current) => ({ ...current, [activeExercise.id]: value }));
    if (feedback[activeExercise.id]) setFeedback((current) => { const next = { ...current }; delete next[activeExercise.id]; return next; });
    mutation.reset();
  };
  const submit = () => {
    const submittedAnswer = answer.trim();
    if (!submittedAnswer) return;
    mutation.mutate({ exerciseId: activeExercise.id, answer: submittedAnswer }, { onSuccess: ({ result: checkResult }) => setFeedback((current) => ({ ...current, [activeExercise.id]: checkResult })) });
  };
  const selectLocal = (index: number) => { setLocalIndex(index); mutation.reset(); };
  const selectType = (type: PublicExercise["type"]) => {
    const group = groups.find((candidate) => candidate.type === type);
    if (!group) return;
    const firstUnanswered = group.items.findIndex((item) => !statesById.has(item.id));
    setActiveType(type);
    setLocalIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    mutation.reset();
  };
  const nextUnanswered = activeGroup.items.findIndex((item) => !statesById.has(item.id));

  return (
    <section id="practice" aria-labelledby="practice-title" className="min-w-0 max-w-full scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-[var(--brand)]">Luyện tập</p><h2 id="practice-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Kiểm tra ngay điều vừa học</h2></div>
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-950">
          <p className="flex items-center gap-2 font-bold"><Trophy aria-hidden="true" size={18} />{progress.completedExercises === 0 ? "Chưa có điểm" : `Đúng ${firstAttemptCorrectCount}/${progress.completedExercises} câu đã trả lời`}</p>
          {progress.completedExercises > 0 && <p className="mt-0.5 text-xs">Tính theo câu trả lời đầu tiên</p>}
        </div>
      </div>
      {nextUnanswered >= 0 && nextUnanswered !== localIndex && <div className="mb-4 flex justify-end"><Button variant="secondary" size="sm" onClick={() => selectLocal(nextUnanswered)}>Câu chưa làm tiếp theo trong {TYPE_LABELS[activeType]} <ArrowRight aria-hidden="true" size={16} /></Button></div>}

      <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="min-w-0 max-w-full lg:hidden">
          <label htmlFor="exercise-type" className="mb-1.5 block text-sm font-bold text-slate-700">Dạng bài tập</label>
          <select id="exercise-type" value={activeType} onChange={(event) => selectType(event.target.value as PublicExercise["type"])} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
            {groups.map(({ type, items }) => <option key={type} value={type}>{TYPE_LABELS[type]} · {items.filter((item) => statesById.has(item.id)).length}/{items.length}</option>)}
          </select>
          <ol aria-label={`Các câu ${TYPE_LABELS[activeType]}`} className="mt-2 flex w-full gap-2 overflow-x-auto overscroll-x-contain py-1">
            {activeGroup.items.map((exercise, index) => <li key={exercise.id} className="shrink-0"><QuestionButton exercise={exercise} displayNumber={index + 1} active={index === localIndex} state={statesById.get(exercise.id)} onSelect={() => selectLocal(index)} /></li>)}
          </ol>
        </div>

        <nav aria-label="Danh sách bài tập theo dạng" className="hidden max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-24 lg:block">
          {groups.map(({ type, items }) => <section key={type} aria-labelledby={`exercise-group-${type}`}><button type="button" onClick={() => selectType(type)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><span id={`exercise-group-${type}`} className="text-sm font-black text-slate-900">{TYPE_LABELS[type]}</span><span className="text-xs font-bold text-slate-500">{items.filter((item) => statesById.has(item.id)).length}/{items.length}</span></button><ol className="mt-2 grid grid-cols-5 gap-1.5">{items.map((exercise, index) => <li key={exercise.id}><QuestionButton exercise={exercise} displayNumber={index + 1} active={type === activeType && index === localIndex} state={statesById.get(exercise.id)} onSelect={() => { setActiveType(type); selectLocal(index); }} compact /></li>)}</ol></section>)}
        </nav>

        <article className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6"><p className="text-sm font-extrabold text-teal-800">{TYPE_LABELS[activeExercise.type]} · Câu {localIndex + 1}/{activeGroup.items.length}</p><h3 className="mt-4 break-words text-xl font-black leading-8 text-slate-950">{activeExercise.question}</h3></div>
          <div className="p-5 sm:p-6">
            {renderExercise(activeExercise, answer, setAnswer, mutation.isPending, transcriptTextById)}
            {mutation.isError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{mutation.error.message || "Không thể kiểm tra đáp án. Vui lòng thử lại."}</p>}
            <div ref={feedbackRef} tabIndex={-1} className="outline-none">{result && <ExerciseFeedback result={result} onRetry={() => setAnswer("")} />}</div>
            {!result && <Button onClick={submit} disabled={!answer.trim() || mutation.isPending} className="mt-5 min-h-11 w-full sm:w-auto">{mutation.isPending ? "Đang kiểm tra…" : "Kiểm tra đáp án"}</Button>}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"><Button variant="ghost" size="sm" disabled={localIndex === 0} onClick={() => selectLocal(localIndex - 1)}><ArrowLeft aria-hidden="true" size={16} /> Câu trước</Button><Button variant="ghost" size="sm" disabled={localIndex === activeGroup.items.length - 1} onClick={() => selectLocal(localIndex + 1)}>Câu tiếp <ArrowRight aria-hidden="true" size={16} /></Button></div>
          </div>
        </article>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label={`Đã hoàn thành ${progress.completedExercises} trên ${progress.totalExercises} bài tập`}><div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700"><span>{progress.completed ? "Đã hoàn thành bài học" : "Tiến độ luyện tập"}</span><span>{progress.completedExercises}/{progress.totalExercises}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${progress.totalExercises ? Math.round((progress.completedExercises / progress.totalExercises) * 100) : 0}%` }} /></div></div>
      {assessment && <ExerciseAssessment assessment={assessment} headingRef={assessmentHeadingRef} />}
    </section>
  );
}

function QuestionButton({ exercise, displayNumber, active, state, onSelect, compact }: { exercise: PublicExercise; displayNumber: number; active: boolean; state?: ExerciseAttemptState; onSelect: () => void; compact?: boolean }) {
  const status = state ? (state.latestCorrect ? "lần gần nhất đúng" : "lần gần nhất sai") : "chưa làm";
  return <button type="button" onClick={onSelect} aria-current={active ? "step" : undefined} aria-label={`${TYPE_LABELS[exercise.type]} câu ${displayNumber}, ${status}`} className={`grid min-h-10 min-w-10 place-items-center rounded-lg border text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${active ? "border-teal-600 bg-teal-700 text-white" : state?.latestCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-800" : state ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} ${compact ? "w-full" : ""}`}>{state ? <><span aria-hidden="true">{state.latestCorrect ? "✓" : "×"}</span><span className="sr-only">{status}</span></> : displayNumber}</button>;
}

function renderExercise(exercise: PublicExercise, value: string, onChange: (value: string) => void, disabled: boolean, transcriptTextById: ReadonlyMap<string, string>) {
  const props = { value, onChange, disabled };
  switch (exercise.type) {
    case "multiple-choice": return <MultipleChoice {...props} exercise={exercise} />;
    case "fill-blank": return <FillBlank {...props} exercise={exercise} />;
    case "translation": return <Translation {...props} exercise={exercise} />;
    case "listening": return <Listening {...props} exercise={exercise} speechText={resolveExerciseSpeechText(exercise.sourceSegmentIds, transcriptTextById)} />;
    case "dictation": return <Dictation {...props} exercise={exercise} speechText={resolveExerciseSpeechText(exercise.sourceSegmentIds, transcriptTextById)} />;
  }
}
