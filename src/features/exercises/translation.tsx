import { useId } from "react";
import { Languages } from "lucide-react";
import { Textarea } from "@/components/ui/field";
import type { ExerciseInputProps, ExerciseOfType } from "./types";

export function Translation({ exercise, value, onChange, disabled }: ExerciseInputProps<ExerciseOfType<"translation">>) {
  const inputId = useId();
  return (
    <div>
      <div className="rounded-xl bg-slate-950 p-4 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300"><Languages aria-hidden="true" size={15} /> Câu cần dịch</p>
        <p className="mt-2 text-lg font-semibold leading-8">{exercise.sourceText}</p>
      </div>
      <label htmlFor={inputId} className="mt-4 block text-sm font-bold text-slate-800">Bản dịch của bạn</label>
      <Textarea id={inputId} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder="Viết bản dịch đầy đủ…" />
    </div>
  );
}
