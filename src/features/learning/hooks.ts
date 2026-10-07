"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkExercise,
  getLesson,
  getProgress,
  getVideoDetail,
  type ExerciseCheckResponse,
  type LessonResponse,
} from "./api";
import { LESSON_KEYS, PROGRESS_KEYS, VIDEO_KEYS } from "./query-keys";

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: LESSON_KEYS.detail(lessonId),
    queryFn: () => getLesson(lessonId),
    enabled: Boolean(lessonId),
  });
}

export function useLessonVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: VIDEO_KEYS.detail(videoId ?? ""),
    queryFn: () => getVideoDetail(videoId ?? ""),
    enabled: Boolean(videoId),
  });
}

export function useProgress() {
  return useQuery({ queryKey: PROGRESS_KEYS.all, queryFn: getProgress });
}

export function useCheckExercise(lessonId: string, videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exerciseId, answer }: { exerciseId: string; answer: string }) =>
      checkExercise(lessonId, exerciseId, { answer }),
    onSuccess: (response: ExerciseCheckResponse) => {
      queryClient.setQueryData<LessonResponse>(LESSON_KEYS.detail(lessonId), (current) =>
        current ? { ...current, progress: response.progress, exerciseStates: response.exerciseStates, assessment: response.assessment } : current,
      );
      void queryClient.invalidateQueries({ queryKey: PROGRESS_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: VIDEO_KEYS.list });
      void queryClient.invalidateQueries({ queryKey: VIDEO_KEYS.detail(videoId) });
    },
  });
}
