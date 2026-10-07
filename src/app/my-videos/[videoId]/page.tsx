"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { UpdateVideoInput } from "@/domain/video";
import { LANGUAGE_LABELS, LEARNING_FOCUS_LABELS } from "@/domain/language";
import { useGenerateVideo, useUpdateVideo, useVideo } from "@/features/videos/hooks";
import { VideoActions } from "@/features/videos/video-actions";
import { VideoForm } from "@/features/videos/video-form";
import { formatDate, formatLevel } from "@/lib/format";

export default function VideoDetailPage() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const videoId = params.videoId;
  const videoQuery = useVideo(videoId);
  const updateMutation = useUpdateVideo(videoId);
  const generateMutation = useGenerateVideo(videoId);

  if (videoQuery.isPending) {
    return <div className="mx-auto h-[560px] max-w-5xl animate-pulse rounded-3xl border border-slate-200 bg-white" aria-label="Đang tải thông tin video" />;
  }
  if (videoQuery.isError) {
    return <ErrorState message={videoQuery.error.message} onRetry={() => videoQuery.refetch()} />;
  }

  const { video } = videoQuery.data;
  const handleUpdate = async (input: UpdateVideoInput) => {
    await updateMutation.mutateAsync(input);
  };
  const handleRegenerate = async () => {
    try {
      await generateMutation.mutateAsync({ scope: "lesson", force: true });
      router.push(`/my-videos/${video.id}/processing`);
    } catch {
      // The mutation error is exposed below through the action state.
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/my-videos" className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><ArrowLeft aria-hidden="true" size={17} /> Trở lại thư viện</Link>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><StatusBadge status={video.status} /><CardTitle className="mt-3 text-2xl sm:text-3xl">{video.title}</CardTitle><a href={video.youtubeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-deep)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Mở trên YouTube <ExternalLink aria-hidden="true" size={15} /></a></div>
          <VideoActions video={video} onDeleted={() => router.push("/my-videos")} />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Ngôn ngữ học" value={LANGUAGE_LABELS[video.learningLanguage]} />
            <Meta label="Trình độ" value={formatLevel(video.targetLevel)} />
            <Meta label="Trọng tâm học" value={LEARNING_FOCUS_LABELS[video.learningFocus]} />
            <Meta label="Cập nhật" value={formatDate(video.updatedAt)} />
          </dl>
          {video.status === "failed" && video.errorMessage && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{video.errorMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chỉnh sửa cấu hình</CardTitle><p className="mt-1 text-sm leading-relaxed text-slate-600">Điều chỉnh tiêu đề và cách bài học được cá nhân hóa.</p></CardHeader>
        <CardContent>
          {updateMutation.isSuccess && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Đã lưu thay đổi.</p>}
          <VideoForm key={video.updatedAt} video={video} busy={updateMutation.isPending} serverError={updateMutation.error} onSubmit={(input) => handleUpdate(input as UpdateVideoInput)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tạo lại nội dung</CardTitle></CardHeader>
        <CardContent className="pt-4"><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-2xl text-sm leading-relaxed text-slate-600">Tạo một phiên bản bài học mới bằng cấu hình hiện tại. Tiến độ bài tập của bài học cũ có thể được đặt lại.</p><Button variant="secondary" onClick={handleRegenerate} disabled={generateMutation.isPending || video.status === "processing"}>{generateMutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" size={17} /> : <RotateCcw aria-hidden="true" size={17} />} Tạo lại bài học</Button></div>{generateMutation.isError && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{generateMutation.error.message}</p>}</CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 font-black text-slate-900">{value}</dd></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"><h1 className="text-xl font-black text-rose-950">Không tìm thấy video</h1><p className="mt-2 text-sm text-rose-800">{message}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={onRetry}><RefreshCw aria-hidden="true" size={17} /> Thử lại</Button><Link href="/my-videos" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-800 ring-1 ring-slate-300">Về thư viện</Link></div></div>;
}
