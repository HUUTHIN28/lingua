import Link from "next/link";
import { Plus, Video } from "lucide-react";
import type { YouTubeVideo } from "@/domain/video";
import { VideoCard } from "./video-card";

export function VideoList({ videos }: { videos: YouTubeVideo[] }) {
  if (videos.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center sm:px-10" aria-labelledby="empty-videos-title">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Video aria-hidden="true" size={27} /></span>
        <h2 id="empty-videos-title" className="mt-5 text-xl font-black text-slate-950">Thư viện đang chờ video đầu tiên</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">Dán một URL YouTube để tạo transcript song ngữ, từ vựng, ngữ pháp và bài luyện tập.</p>
        <Link href="/my-videos/new" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white hover:bg-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2">
          <Plus aria-hidden="true" size={18} /> Thêm video đầu tiên
        </Link>
      </section>
    );
  }

  return <div className="grid gap-5">{videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>;
}
