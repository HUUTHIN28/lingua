import type { VideoStatus } from "@/domain/video";

const statusStyles: Record<VideoStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  processing: "bg-sky-50 text-sky-800 ring-sky-200",
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-200",
};
const statusLabels: Record<VideoStatus, string> = {
  pending: "Đang chờ",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Thất bại",
};

export function StatusBadge({ status, label }: { status: VideoStatus; label?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[status]}`}>{label ?? statusLabels[status]}</span>;
}
