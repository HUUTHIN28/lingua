"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreateVideoInput } from "@/domain/video";
import { useCreateVideo } from "@/features/videos/hooks";
import { VideoForm } from "@/features/videos/video-form";

export type TranscriptMode = "youtube" | "demo";

const copy = {
  youtube: {
    description: "Chọn một video YouTube công khai. Bài học sẽ dùng lời thoại thật: ưu tiên phụ đề của video, sau đó Gemini phiên âm nếu không có phụ đề phù hợp.",
    firstTitle: "Học từ nội dung video",
    firstText: "Từ vựng, ngữ pháp và năm dạng bài tập được tạo từ lời thoại đã lấy của video bạn chọn.",
    secondTitle: "Nguồn transcript rõ ràng",
    secondText: "Bài học ghi rõ nội dung đến từ phụ đề tác giả, phụ đề tự động hay Gemini phiên âm. Nếu không thể lấy đầy đủ, hệ thống sẽ báo lỗi.",
  },
  demo: {
    description: "Chọn một video YouTube để thử luồng học mẫu. Chế độ này dùng hội thoại mẫu và chưa lấy lời thoại từ video bạn gửi.",
    firstTitle: "Nội dung mẫu rõ ràng",
    firstText: "Từ vựng, ngữ pháp và năm dạng bài tập được tạo từ hội thoại mẫu để bạn thử luồng học.",
    secondTitle: "Chế độ thử nghiệm",
    secondText: "Bài học sẽ ghi rõ transcript mẫu để bạn không nhầm với lời thoại thật của video.",
  },
} satisfies Record<TranscriptMode, Record<string, string>>;

export function NewVideoDescription({ transcriptMode }: { transcriptMode: TranscriptMode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy[transcriptMode].description}</p>;
}

export function NewVideoInfoCards({ transcriptMode }: { transcriptMode: TranscriptMode }) {
  const content = copy[transcriptMode];
  return (
    <aside className="space-y-4" aria-label="Thông tin tạo bài học">
      <InfoCard icon={Sparkles} title={content.firstTitle} text={content.firstText} />
      <InfoCard icon={ShieldCheck} title={content.secondTitle} text={content.secondText} />
    </aside>
  );
}

export function NewVideoClient({ transcriptMode }: { transcriptMode: TranscriptMode }) {
  const router = useRouter();
  const createMutation = useCreateVideo();

  const handleSubmit = async (input: CreateVideoInput) => {
    const response = await createMutation.mutateAsync(input);
    router.push(`/my-videos/${response.video.id}/processing`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/my-videos" className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><ArrowLeft aria-hidden="true" size={17} /> Trở lại thư viện</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader><p className="text-sm font-bold text-[var(--brand-deep)]">Bắt đầu với một đường dẫn</p><CardTitle className="mt-1 text-2xl sm:text-3xl">Tạo bài học mới</CardTitle><NewVideoDescription transcriptMode={transcriptMode} /></CardHeader>
          <CardContent><VideoForm busy={createMutation.isPending} serverError={createMutation.error} onSubmit={(input) => handleSubmit(input as CreateVideoInput)} /></CardContent>
        </Card>
        <NewVideoInfoCards transcriptMode={transcriptMode} />
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Icon aria-hidden="true" size={20} /></span><h2 className="mt-4 font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p></div>;
}
