import type { Exercise, PublicExercise } from "./schemas";

export function toPublicExercise(exercise: Exercise): PublicExercise {
  switch (exercise.type) {
    case "multiple-choice": {
      const { correctAnswer: _answer, ...publicExercise } = exercise;
      void _answer;
      return publicExercise;
    }
    case "fill-blank": {
      const { correctAnswer: _answer, ...publicExercise } = exercise;
      void _answer;
      return publicExercise;
    }
    case "translation":
    case "listening":
    case "dictation": {
      const { expectedAnswer: _answer, ...publicExercise } = exercise;
      void _answer;
      return publicExercise;
    }
  }
}

export const toPublicExercises = (exercises: Exercise[]): PublicExercise[] =>
  exercises.map(toPublicExercise);
