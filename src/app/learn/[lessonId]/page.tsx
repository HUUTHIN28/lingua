"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, BookOpenText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEARNING_FOCUS_LABELS } from "@/domain/language";
import { ApiClientError } from "@/lib/api-contract";
import { useLesson, useLessonVideo } from "@/features/learning/hooks";
import { LessonOverview } from "@/features/learning/lesson-overview";
import { TranscriptPanel } from "@/features/transcript/transcript-panel";
import { VocabularyList } from "@/features/vocabulary/vocabulary-list";
import { GrammarList } from "@/features/grammar/grammar-list";
import { ExerciseRunner } from "@/features/exercises/exercise-runner";
import { LessonSpeechProvider } from "@/features/speech/lesson-speech-controller";

const sections = [
  { href: "#overview", label: "Tổng quan" },
  { href: "#transcript", label: "Transcript" },
  { href: "#vocabulary", label: "Từ vựng" },
  { href: "#grammar", label: "Ngữ pháp" },
  { href: "#practice", label: "Luyện tập" },
];

export default function LearnPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;
  const lessonQuery = useLesson(lessonId);
  const videoQuery = useLessonVideo(lessonQuery.data?.lesson.videoId);

  if (lessonQuery.isPending) return <LessonLoading />;

  if (lessonQuery.isError || !lessonQuery.data) {
    const notFound = lessonQuery.error instanceof ApiClientError && lessonQuery.error.status === 404;
    return (
      <div className="mx-auto max-w-xl pt-10">
        <div role="alert" className="rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle aria-hidden="true" /></span>
          <h1 className="mt-4 text-2xl font-black text-slate-950">{notFound ? "Không tìm thấy bài học" : "Chưa thể tải bài học"}</h1>
          <p className="mt-2 leading-6 text-slate-600">{notFound ? "Bài học này có thể đã bị xoá hoặc đường dẫn không còn hợp lệ." : lessonQuery.error.message}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!notFound && <Button onClick={() => lessonQuery.refetch()}><RefreshCw aria-hidden="true" size={16} /> Thử lại</Button>}
            <Link href="/my-videos" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">Về thư viện</Link>
          </div>
        </div>
      </div>
    );
  }

  const { lesson, progress, exerciseStates, assessment } = lessonQuery.data;

  return (
    <LessonSpeechProvider lessonId={lesson.id} learningLanguage={videoQuery.data?.video.learningLanguage}>
    <div className="mx-auto min-w-0 max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href={`/my-videos/${lesson.videoId}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-950"><ArrowLeft aria-hidden="true" size={17} /> Quay lại video</Link>
        <span className="hidden items-center gap-2 text-sm font-semibold text-slate-500 sm:flex"><BookOpenText aria-hidden="true" size={17} /> {LEARNING_FOCUS_LABELS[lesson.learningFocus]}</span>
      </div>

      <LessonOverview lesson={lesson} progress={progress} />

      <nav aria-label="Mục trong bài học" className="sticky top-[4.1rem] z-10 -mx-2 mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white/95 p-2 shadow-sm backdrop-blur lg:top-3">
        <div className="flex min-w-max gap-1">
          {sections.map((section) => <a key={section.href} href={section.href} className="inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">{section.label}</a>)}
        </div>
      </nav>

      <div className="mt-10 space-y-14 pb-8">
        <TranscriptPanel transcript={lesson.transcript} transcriptProvenance={lesson.transcriptProvenance} />
        <VocabularyList items={lesson.vocabulary} transcript={lesson.transcript} />
        <GrammarList items={lesson.grammar} transcript={lesson.transcript} />
        <ExerciseRunner exercises={lesson.exercises} transcript={lesson.transcript} progress={progress} exerciseStates={exerciseStates} assessment={assessment} lessonId={lesson.id} videoId={lesson.videoId} />
      </div>
    </div>
    </LessonSpeechProvider>
  );
}

function LessonLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-busy="true" aria-label="Đang tải bài học">
      <div className="h-5 w-32 rounded bg-slate-200" />
      <div className="mt-5 rounded-3xl bg-slate-900 p-8">
        <div className="h-4 w-36 rounded bg-slate-700" />
        <div className="mt-5 h-10 max-w-2xl rounded bg-slate-700" />
        <div className="mt-4 h-5 max-w-3xl rounded bg-slate-800" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-2xl bg-slate-800" />)}</div>
      </div>
      <div className="mt-10 h-80 rounded-2xl bg-slate-200" />
      <p className="sr-only">Đang tải bài học…</p>
    </div>
  );
}
