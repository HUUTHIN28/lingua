import type { ApiErrorCode, ApiFailure } from "@/lib/api-contract";
import { apiErrorCodeSchema, flattenZodFieldErrors } from "@/lib/api-contract";
import { z, ZodError } from "zod";

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TRANSCRIPT_UNAVAILABLE: 422,
  GENERATION_FAILED: 500,
  INVALID_GENERATED_CONTENT: 422,
  INTERNAL_ERROR: 500,
};

const applicationErrorShape = z
  .object({
    name: z.literal("ApplicationError"),
    code: apiErrorCodeSchema,
    status: z.number().int().min(400).max(599),
    message: z.string().trim().min(1).max(1_000),
    fieldErrors: z
      .record(
        z.string().min(1).max(100),
        z.array(z.string().min(1).max(500)).max(20),
      )
      .optional(),
  })
  .refine((error) => statusByCode[error.code] === error.status, {
    message: "Mã lỗi và HTTP status không khớp.",
  });

function parseApplicationError(error: unknown) {
  const parsed = applicationErrorShape.safeParse(error);
  return parsed.success ? parsed.data : null;
}

export class ApplicationError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function notFound(resource: string): ApplicationError {
  return new ApplicationError("NOT_FOUND", `Không tìm thấy ${resource}.`, 404);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof SyntaxError) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "JSON gửi lên không hợp lệ." } } satisfies ApiFailure,
      { status: 400 },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Dữ liệu gửi lên không hợp lệ.", fieldErrors: flattenZodFieldErrors(error) } } satisfies ApiFailure,
      { status: 400 },
    );
  }
  const applicationError = parseApplicationError(error);
  if (applicationError) {
    return Response.json(
      {
        error: {
          code: applicationError.code,
          message: applicationError.message,
          ...(applicationError.fieldErrors ? { fieldErrors: applicationError.fieldErrors } : {}),
        },
      } satisfies ApiFailure,
      { status: applicationError.status },
    );
  }
  console.error("LinguaTube server error", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Không thể hoàn tất yêu cầu. Vui lòng thử lại." } } satisfies ApiFailure,
    { status: 500 },
  );
}
