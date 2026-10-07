"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CirclePlay, Plus, Sparkles, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useVideos } from "@/features/videos/hooks";
import { VideoList } from "@/features/videos/video-list";

export default function DashboardPage() {
  const videosQuery = useVideos();
  const videos = videosQuery.data?.videos ?? [];
  const ready = videos.filter((video) => video.status === "ready").length;
  const processing = videos.filter((video) => video.status === "processing" || video.status === "pending").length;
  const recent = videos.slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-100 ring-1 ring-white/15"><Sparkles aria-hidden="true" size={15} /> Học từ nội dung bạn thực sự yêu thích</span>
          <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Biến một video YouTube thành bài học của riêng bạn.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">LinguaTube tạo transcript song ngữ, từ vựng, giải thích ngữ pháp và bài tập có phản hồi từ video bạn chọn.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/my-videos/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 text-sm font-black text-slate-950 transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"><Plus aria-hidden="true" size={19} /> Tạo bài học</Link>
            <Link href="/my-videos" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Video aria-hidden="true" size={19} /> Xem thư viện</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold text-[var(--brand-deep)]">Nhịp học của bạn</p><h2 id="overview-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Tổng quan</h2></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric icon={Video} label="Video đã thêm" value={videos.length} tone="teal" />
          <Metric icon={BookOpenCheck} label="Bài học sẵn sàng" value={ready} tone="emerald" />
          <Metric icon={CirclePlay} label="Đang chuẩn bị" value={processing} tone="sky" />
        </div>
      </section>

      <section aria-labelledby="recent-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold text-[var(--brand-deep)]">Quay lại đúng chỗ</p><h2 id="recent-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Video gần đây</h2></div>
          {videos.length > 0 && <Link href="/my-videos" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[var(--brand-deep)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Xem tất cả <ArrowRight aria-hidden="true" size={16} /></Link>}
        </div>
        {videosQuery.isPending ? <LoadingCards count={2} /> : videosQuery.isError ? <LoadError onRetry={() => videosQuery.refetch()} /> : <VideoList videos={recent} />}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Video; label: string; value: number; tone: "teal" | "emerald" | "sky" }) {
  const tones = { teal: "bg-teal-50 text-teal-700", emerald: "bg-emerald-50 text-emerald-700", sky: "bg-sky-50 text-sky-700" };
  return <Card><CardContent className="flex items-center gap-4"><span className={`grid size-12 place-items-center rounded-2xl ${tones[tone]}`}><Icon aria-hidden="true" size={23} /></span><div><p className="text-3xl font-black text-slate-950">{value}</p><p className="text-sm font-semibold text-slate-600">{label}</p></div></CardContent></Card>;
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-4" aria-label="Đang tải video">{Array.from({ length: count }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-950">Không thể tải danh sách video.</p><button className="mt-2 rounded-lg text-sm font-bold text-rose-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600" onClick={onRetry}>Thử tải lại</button></div>;
}
