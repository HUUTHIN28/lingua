import type { Exercise } from "@/domain/exercise";

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\p{P}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expectedAnswer(exercise: Exercise): string {
  return exercise.type === "multiple-choice" || exercise.type === "fill-blank"
    ? exercise.correctAnswer
    : exercise.expectedAnswer;
}

export function scoreExercise(exercise: Exercise, answer: string): boolean {
  if (!answer.trim()) return false;
  const expected = expectedAnswer(exercise);
  return exercise.type === "multiple-choice"
    ? answer === expected
    : normalizeAnswer(answer) === normalizeAnswer(expected);
}
