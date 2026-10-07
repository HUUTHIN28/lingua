"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGenerateVideo, useVideoJob } from "@/features/videos/hooks";
import { ProcessingStatusCard } from "@/features/videos/processing-status";

export default function ProcessingPage() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const videoId = params.videoId;
  const jobQuery = useVideoJob(videoId);
  const generateMutation = useGenerateVideo(videoId);
  const navigatedLessonRef = useRef<string | null>(null);
  const lessonId = jobQuery.data?.job?.lessonId ?? jobQuery.data?.video.lessonId ?? null;
  const complete = jobQuery.data?.job?.status === "completed" || jobQuery.data?.video.status === "ready";

  useEffect(() => {
    if (!complete || !lessonId || navigatedLessonRef.current === lessonId) return;
    navigatedLessonRef.current = lessonId;
    router.replace(`/learn/${lessonId}`);
  }, [complete, lessonId, router]);

  const handleRetry = async () => {
    navigatedLessonRef.current = null;
    try {
      await generateMutation.mutateAsync({ scope: "lesson", force: true });
      await jobQuery.refetch();
    } catch {
      // ProcessingStatusCard renders the mutation error and keeps retry available.
    }
  };

  if (jobQuery.isPending) {
    return <div className="mx-auto h-[620px] max-w-4xl animate-pulse rounded-3xl border border-slate-200 bg-white" aria-label="Đang tải tiến trình" />;
  }
  if (jobQuery.isError) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-black text-rose-950">Không thể tải tiến trình</h1><p className="mt-2 text-sm text-rose-800">{jobQuery.error.message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={() => jobQuery.refetch()}><RefreshCw aria-hidden="true" size={17} /> Thử lại</Button><Link href="/my-videos" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-800 ring-1 ring-slate-300">Về thư viện</Link></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/my-videos/${videoId}`} className="mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><ArrowLeft aria-hidden="true" size={17} /> Xem thông tin video</Link>
      <ProcessingStatusCard
        video={jobQuery.data.video}
        job={jobQuery.data.job}
        transcriptMode={jobQuery.data.transcriptMode}
        retrying={generateMutation.isPending}
        retryError={generateMutation.error?.message}
        onRetry={handleRetry}
      />
      {complete && lessonId && <p role="status" aria-live="polite" className="mt-4 text-center text-sm font-bold text-[var(--brand-deep)]">Bài học đã sẵn sàng. Đang mở nội dung…</p>}
    </div>
  );
}
