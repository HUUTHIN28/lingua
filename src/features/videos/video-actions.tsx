"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, Pencil, Play, RotateCcw, Trash2, X } from "lucide-react";
import type { YouTubeVideo } from "@/domain/video";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-contract";
import { useDeleteVideo, useGenerateVideo } from "./hooks";

type VideoActionsProps = {
  video: YouTubeVideo;
  onDeleted?: () => void;
  compact?: boolean;
};

export function VideoActions({ video, onDeleted, compact = false }: VideoActionsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteMutation = useDeleteVideo();
  const generateMutation = useGenerateVideo(video.id);
  const error = deleteMutation.error ?? generateMutation.error;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ videoId: video.id, lessonId: video.lessonId });
      onDeleted?.();
    } catch {
      // The mutation error is rendered next to the confirmation controls.
    }
  };

  if (confirmingDelete) {
    return (
      <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3" role="group" aria-label={`Xác nhận xóa ${video.title}`}>
        <p className="text-sm font-bold text-rose-900">Xóa video và toàn bộ tiến độ liên quan?</p>
        {deleteMutation.error && <p role="alert" className="mt-1 text-sm text-rose-800">{deleteMutation.error.message}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" size={16} /> : <Trash2 aria-hidden="true" size={16} />}
            Xác nhận xóa
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleteMutation.isPending}>
            <X aria-hidden="true" size={16} /> Hủy
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:justify-end"}`}>
        {video.status === "ready" && video.lessonId ? (
          <Link
            href={`/learn/${video.lessonId}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-bold text-white transition hover:bg-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
          >
            <Play aria-hidden="true" size={16} /> Học tiếp
          </Link>
        ) : video.status === "processing" ? (
          <Link
            href={`/my-videos/${video.id}/processing`}
            className="inline-flex min-h-9 items-center justify-center rounded-xl bg-sky-700 px-3 text-sm font-bold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            Xem tiến trình
          </Link>
        ) : (
          <Button
            size="sm"
            onClick={() => generateMutation.mutate({ scope: "lesson", force: video.status === "failed" })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" size={16} /> : <RotateCcw aria-hidden="true" size={16} />}
            {video.status === "failed" ? "Thử lại" : "Tạo bài học"}
          </Button>
        )}
        <Link
          href={`/my-videos/${video.id}`}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <Pencil aria-hidden="true" size={16} /> Chỉnh sửa
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)} aria-label={`Xóa ${video.title}`}>
          <Trash2 aria-hidden="true" size={16} /> Xóa
        </Button>
      </div>
      {generateMutation.isSuccess && video.status !== "ready" && (
        <Link className="block text-sm font-bold text-[var(--brand-deep)] underline underline-offset-4" href={`/my-videos/${video.id}/processing`}>
          Mở tiến trình tạo bài học
        </Link>
      )}
      {error && !deleteMutation.isPending && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error instanceof ApiClientError ? error.message : "Không thể hoàn tất thao tác."}
        </p>
      )}
    </div>
  );
}
