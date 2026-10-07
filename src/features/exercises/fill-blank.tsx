import { useId } from "react";
import { Input } from "@/components/ui/field";
import type { ExerciseInputProps, ExerciseOfType } from "./types";

export function FillBlank({ exercise, value, onChange, disabled }: ExerciseInputProps<ExerciseOfType<"fill-blank">>) {
  const inputId = useId();
  return (
    <div>
      <p className="rounded-xl bg-slate-50 p-4 text-lg font-bold leading-8 text-slate-900">{exercise.sentence}</p>
      <label htmlFor={inputId} className="mt-4 block text-sm font-bold text-slate-800">Từ hoặc cụm từ còn thiếu</label>
      <Input id={inputId} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} autoComplete="off" placeholder="Nhập đáp án…" />
    </div>
  );
}
