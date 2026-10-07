"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideos } from "@/features/videos/hooks";
import { VideoList } from "@/features/videos/video-list";

export default function MyVideosPage() {
  const videosQuery = useVideos();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-[var(--brand-deep)]">Không gian học tập</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Video của tôi</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Quản lý video, theo dõi tiến trình tạo bài và tiếp tục học.</p></div>
        <Link href="/my-videos/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white hover:bg-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"><Plus aria-hidden="true" size={18} /> Thêm video</Link>
      </header>

      {videosQuery.isPending ? (
        <div className="grid gap-5" aria-label="Đang tải thư viện">{[0, 1].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : videosQuery.isError ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><p className="font-black text-rose-950">Chưa thể tải thư viện</p><p className="mt-1 text-sm text-rose-800">{videosQuery.error.message}</p><Button className="mt-4" variant="secondary" onClick={() => videosQuery.refetch()}><RefreshCw aria-hidden="true" size={17} /> Thử lại</Button></div>
      ) : <VideoList videos={videosQuery.data.videos} />}
    </div>
  );
}
