"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgress } from "@/features/learning/hooks";
import { ProgressSummary } from "@/features/progress/progress-summary";
import { ProgressList } from "@/features/progress/progress-list";

export default function ProgressPage() {
  const progressQuery = useProgress();

  if (progressQuery.isPending) {
    return (
      <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Đang tải tiến độ">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        <div className="mt-8 h-72 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (progressQuery.isError) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Chưa thể tải tiến độ</h1>
        <p className="mt-2 text-slate-600">{progressQuery.error.message}</p>
        <Button onClick={() => progressQuery.refetch()} className="mt-5"><RefreshCw aria-hidden="true" size={16} /> Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7">
        <p className="text-sm font-bold text-[var(--brand)]">Hành trình của bạn</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">Tiến độ học tập</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">Theo dõi điểm số, bài đã hoàn thành và tiếp tục đúng nơi bạn dừng lại trong phiên học hiện tại.</p>
      </header>
      <ProgressSummary lessons={progressQuery.data.lessons} videos={progressQuery.data.videos} />
      <div className="mt-9"><ProgressList lessons={progressQuery.data.lessons} videos={progressQuery.data.videos} /></div>
    </div>
  );
}
