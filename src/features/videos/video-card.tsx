import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Gauge, Languages, Target } from "lucide-react";
import type { YouTubeVideo } from "@/domain/video";
import { LANGUAGE_LABELS, LEARNING_FOCUS_LABELS } from "@/domain/language";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatLevel } from "@/lib/format";
import { VideoActions } from "./video-actions";

export function VideoCard({ video }: { video: YouTubeVideo }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid sm:grid-cols-[220px_1fr]">
        <Link href={`/my-videos/${video.id}`} className="relative block aspect-video overflow-hidden bg-slate-200 sm:aspect-auto sm:min-h-48">
          {video.thumbnailUrl ? (
            <Image src={video.thumbnailUrl} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, 220px" className="object-cover transition duration-300 hover:scale-[1.03]" />
          ) : (
            <span className="grid h-full place-items-center text-sm font-semibold text-slate-500">Chưa có ảnh xem trước</span>
          )}
        </Link>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <StatusBadge status={video.status} />
              <Link href={`/my-videos/${video.id}`} className="mt-2 block rounded-md text-xl font-black leading-tight tracking-tight text-slate-950 hover:text-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
                {video.title}
              </Link>
              {video.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{video.description}</p>}
            </div>
            {video.status === "processing" && (
              <span className="text-sm font-black tabular-nums text-sky-800">{video.processingProgress ?? 0}%</span>
            )}
          </div>

          {video.status === "processing" && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Đã xử lý ${video.processingProgress ?? 0}%`} role="progressbar" aria-valuenow={video.processingProgress ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${video.processingProgress ?? 0}%` }} />
            </div>
          )}
          {video.status === "failed" && video.errorMessage && (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">{video.errorMessage}</p>
          )}

          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-1.5"><Languages aria-hidden="true" size={16} /><dt className="sr-only">Ngôn ngữ</dt><dd>{LANGUAGE_LABELS[video.learningLanguage]}</dd></div>
            <div className="flex items-center gap-1.5"><Gauge aria-hidden="true" size={16} /><dt className="sr-only">Trình độ</dt><dd>{formatLevel(video.targetLevel)}</dd></div>
            <div className="flex items-center gap-1.5"><Target aria-hidden="true" size={16} /><dt className="sr-only">Trọng tâm học</dt><dd>{LEARNING_FOCUS_LABELS[video.learningFocus]}</dd></div>
            <div className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" size={16} /><dt className="sr-only">Ngày tạo</dt><dd>{formatDate(video.createdAt)}</dd></div>
          </dl>
          <VideoActions video={video} compact />
        </CardContent>
      </div>
    </Card>
  );
}
