import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "TRANSCRIPT_UNAVAILABLE",
  "GENERATION_FAILED",
  "INVALID_GENERATED_CONTENT",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export type ApiSuccess<T> = { data: T };
export type ApiFailure = {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export const apiFailureSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export const apiSuccess = <T>(data: T): ApiSuccess<T> => ({ data });

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, failure: ApiFailure) {
    super(failure.error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = failure.error.code;
    this.fieldErrors = failure.error.fieldErrors;
  }
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedFailure = apiFailureSchema.safeParse(payload);
    if (parsedFailure.success) throw new ApiClientError(response.status, parsedFailure.data);
    throw new ApiClientError(response.status, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
      },
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload)
  ) {
    throw new ApiClientError(response.status, {
      error: { code: "INTERNAL_ERROR", message: "Phản hồi từ máy chủ không hợp lệ." },
    });
  }
  return (payload as ApiSuccess<T>).data;
}

export const flattenZodFieldErrors = (
  error: z.ZodError,
): Record<string, string[]> => error.flatten().fieldErrors as Record<string, string[]>;
