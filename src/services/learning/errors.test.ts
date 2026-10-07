import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationError, errorResponse } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorResponse", () => {
  it("serializes a same-class application error from validated fields only", async () => {
    const error = new ApplicationError(
      "VALIDATION_ERROR",
      "Dữ liệu không hợp lệ.",
      400,
      { learningFocus: ["Trọng tâm học không hợp lệ."] },
    ) as ApplicationError & { secret?: string };
    error.secret = "must-not-leak";

    const response = errorResponse(error);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { learningFocus: ["Trọng tâm học không hợp lệ."] },
      },
    });
  });

  it("preserves a structurally equivalent application error across class identities", async () => {
    class ReloadedApplicationError extends Error {
      readonly code = "NOT_FOUND";
      readonly status = 404;

      constructor() {
        super("Không tìm thấy bài học.");
        this.name = "ApplicationError";
      }
    }

    const error = new ReloadedApplicationError();
    expect(error).not.toBeInstanceOf(ApplicationError);

    const response = errorResponse(error);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Không tìm thấy bài học." },
    });
  });

  it("maps an unknown error to the safe generic 500 response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse(new Error("database password must not leak"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
      },
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("rejects a forged application shape with a mismatched status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse({
      name: "ApplicationError",
      code: "NOT_FOUND",
      status: 200,
      message: "should not be trusted",
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
