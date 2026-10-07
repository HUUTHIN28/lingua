import type { ExerciseType } from "@/domain/exercise";
import type { GeneratedLesson } from "@/domain/lesson";
import {
  lessonAssessmentReportSchema,
  type AssessmentBand,
  type AssessmentRecommendation,
  type LessonAssessmentReport,
} from "@/domain/progress";
import type { StoredExerciseAttempt } from "@/repositories/memory-store";
import { expectedAnswer } from "./exercise-scoring";

const TYPE_ORDER: ExerciseType[] = [
  "multiple-choice",
  "fill-blank",
  "translation",
  "listening",
  "dictation",
];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  "multiple-choice": "Trắc nghiệm",
  "fill-blank": "Điền vào chỗ trống",
  translation: "Dịch câu",
  listening: "Nghe hiểu",
  dictation: "Chính tả",
};

const GUIDANCE: Record<ExerciseType, { studyTopics: string[]; actions: string[] }> = {
  "multiple-choice": {
    studyTopics: ["Từ khóa và ngữ cảnh trong hội thoại", "Cách loại trừ phương án gây nhiễu"],
    actions: ["Đọc lại câu nguồn và gạch chân từ khóa trước khi chọn.", "Giải thích vì sao từng phương án đúng hoặc sai."],
  },
  "fill-blank": {
    studyTopics: ["Mẫu câu và từ loại", "Cụm từ thường đi cùng nhau"],
    actions: ["Xác định từ loại cần điền trước khi xem đáp án mẫu.", "Viết thêm hai câu mới dùng cùng mẫu câu."],
  },
  translation: {
    studyTopics: ["Trật tự từ và cụm từ theo ngữ cảnh", "Cách đối chiếu với đáp án mẫu"],
    actions: ["Chia câu thành từng cụm nghĩa rồi dịch lại.", "Nói lại câu trước khi nhập và so sánh từng cụm với đáp án mẫu."],
  },
  listening: {
    studyTopics: ["Từ khóa và chi tiết trong câu nghe", "Liên kết âm với ý nghĩa"],
    actions: ["Nghe lại đúng đoạn thời gian ít nhất hai lần và ghi từ khóa.", "Tóm tắt ý chính bằng một câu trước khi trả lời lại."],
  },
  dictation: {
    studyTopics: ["Ranh giới từ và chính tả", "Dạng rút gọn trong câu nói"],
    actions: ["Nghe theo từng cụm ngắn, tạm dừng rồi viết lại.", "Đối chiếu các từ bị thiếu hoặc sai chính tả với câu nguồn."],
  },
};

const bandFor = (score: number): AssessmentBand =>
  score < 50 ? "needs-review" : score < 80 ? "developing" : "strong";

const summaryFor = (score: number, mistakes: number): string => {
  if (score === 100) return "Bạn đã trả lời đúng ngay lần đầu ở tất cả câu. Hãy duy trì bằng cách ôn lại theo lịch và tự diễn đạt nội dung.";
  if (score >= 80) return `Bạn nắm khá chắc nội dung. ${mistakes} câu chưa khớp đáp án mẫu cho thấy một vài điểm cần củng cố thêm.`;
  if (score >= 50) return `Bạn đã nắm được một phần nội dung, nhưng ${mistakes} câu chưa khớp đáp án mẫu. Hãy ưu tiên các nhóm kỹ năng có điểm thấp.`;
  return `${mistakes} câu chưa khớp đáp án mẫu. Bạn nên học lại từng nhóm yếu theo kế hoạch bên dưới trước khi làm lại.`;
};

export function buildLessonAssessment(
  lesson: GeneratedLesson,
  attempts: Map<string, StoredExerciseAttempt[]>,
): LessonAssessmentReport {
  const firstAttempts = lesson.exercises.map((exercise) => ({
    exercise,
    history: attempts.get(exercise.id) ?? [],
  }));
  if (firstAttempts.some(({ history }) => history.length === 0)) {
    throw new Error("Cannot build an assessment before every exercise has an attempt.");
  }

  const correctExercises = firstAttempts.filter(({ history }) => history[0].correct).length;
  const score = Math.round((correctExercises / lesson.exercises.length) * 100);
  const byType = TYPE_ORDER.flatMap((type) => {
    const entries = firstAttempts.filter(({ exercise }) => exercise.type === type);
    if (entries.length === 0) return [];
    const correct = entries.filter(({ history }) => history[0].correct).length;
    return [{ type, label: EXERCISE_TYPE_LABELS[type], correct, total: entries.length, score: Math.round((correct / entries.length) * 100) }];
  });

  const mistakes = firstAttempts.flatMap(({ exercise, history }) => {
    if (history[0].correct) return [];
    return [{
      exerciseId: exercise.id,
      type: exercise.type,
      typeLabel: EXERCISE_TYPE_LABELS[exercise.type],
      question: exercise.question,
      submittedAnswer: history[0].answer,
      expectedAnswer: expectedAnswer(exercise),
      explanation: exercise.explanation ?? "Câu trả lời đầu tiên chưa khớp đáp án mẫu.",
      attemptCount: history.length,
      resolvedAfterRetry: history.slice(1).some((attempt) => attempt.correct),
    }];
  });

  let recommendations: AssessmentRecommendation[];
  if (mistakes.length === 0) {
    recommendations = [{
      type: null,
      label: "Duy trì kết quả",
      priority: "maintenance",
      observation: "Bạn đã trả lời đúng ngay lần đầu ở toàn bộ dạng bài.",
      evidenceExerciseIds: [],
      studyTopics: ["Ôn giãn cách", "Tự diễn đạt lại nội dung"],
      actions: ["Ôn lại bài sau 1 ngày và 1 tuần.", "Tự tóm tắt hoặc nói lại nội dung mà không nhìn transcript."],
    }];
  } else {
    recommendations = byType
      .filter((item) => item.correct < item.total)
      .sort((left, right) => left.score - right.score || (right.total - right.correct) - (left.total - left.correct) || TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type))
      .slice(0, 3)
      .map((item, index) => {
        const evidenceExerciseIds = mistakes.filter((mistake) => mistake.type === item.type).map((mistake) => mistake.exerciseId);
        return {
          type: item.type,
          label: `Ưu tiên ${EXERCISE_TYPE_LABELS[item.type]}`,
          priority: index === 0 ? "high" as const : "medium" as const,
          observation: `Câu trả lời đầu tiên chưa khớp đáp án mẫu ở ${item.total - item.correct}/${item.total} câu ${EXERCISE_TYPE_LABELS[item.type].toLocaleLowerCase()}.`,
          evidenceExerciseIds,
          ...GUIDANCE[item.type],
        };
      });
  }

  return lessonAssessmentReportSchema.parse({
    lessonId: lesson.id,
    score,
    correctExercises,
    totalExercises: lesson.exercises.length,
    band: bandFor(score),
    summary: summaryFor(score, mistakes.length),
    byType,
    mistakes,
    recommendations,
  });
}
