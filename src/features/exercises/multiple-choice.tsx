import { useId } from "react";
import type { ExerciseInputProps, ExerciseOfType } from "./types";

export function MultipleChoice({ exercise, value, onChange, disabled }: ExerciseInputProps<ExerciseOfType<"multiple-choice">>) {
  const groupId = useId();
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="sr-only">Chọn một đáp án</legend>
      {exercise.options.map((option, index) => {
        const optionId = `${groupId}-${index}`;
        return (
          <label key={option} htmlFor={optionId} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm font-semibold transition ${value === option ? "border-teal-500 bg-teal-50 text-teal-950 ring-1 ring-teal-400" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}>
            <input id={optionId} type="radio" name={`${groupId}-choice`} value={option} checked={value === option} onChange={() => onChange(option)} className="size-4 accent-teal-700" />
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
