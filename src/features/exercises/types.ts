import type { PublicExercise } from "@/domain/exercise";

export type ExerciseOfType<TType extends PublicExercise["type"]> = Extract<
  PublicExercise,
  { type: TType }
>;

export type ExerciseInputProps<TExercise extends PublicExercise> = {
  exercise: TExercise;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export type TimedExerciseInputProps<TExercise extends PublicExercise> =
  ExerciseInputProps<TExercise> & { speechText?: string };
