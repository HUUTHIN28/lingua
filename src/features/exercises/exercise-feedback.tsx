import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { ExerciseCheckResult } from "@/domain/exercise";
import { Button } from "@/components/ui/button";

export function ExerciseFeedback({ result, onRetry }: { result: ExerciseCheckResult; onRetry: () => void }) {
  return (
    <div role="status" aria-live="polite" className={`mt-5 rounded-2xl border p-4 ${result.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <div className="flex items-start gap-3">
        {result.correct ? <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" /> : <XCircle aria-hidden="true" className="mt-0.5 shrink-0 text-rose-700" />}
        <div className="min-w-0">
          <p className={`font-extrabold ${result.correct ? "text-emerald-900" : "text-rose-900"}`}>{result.correct ? "Chính xác!" : "Chưa đúng, thử lại nhé."}</p>
          {!result.correct && <p className="mt-2 text-sm leading-6 text-rose-900"><span className="font-bold">Đáp án gợi ý:</span> {result.expectedAnswer}</p>}
          <p className={`mt-2 text-sm leading-6 ${result.correct ? "text-emerald-800" : "text-rose-800"}`}>{result.explanation}</p>
          <Button onClick={onRetry} variant="secondary" size="sm" className="mt-3 bg-white">
            <RotateCcw aria-hidden="true" size={15} /> {result.correct ? "Làm lại" : "Thử lại"}
          </Button>
        </div>
      </div>
    </div>
  );
}
