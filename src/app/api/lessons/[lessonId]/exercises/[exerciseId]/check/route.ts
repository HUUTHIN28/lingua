import { exerciseSubmissionSchema } from "@/domain/exercise";
import { apiSuccess } from "@/lib/api-contract";
import { getServiceContainer } from "@/services/container";
import { errorResponse } from "@/services/learning/errors";

type Context = { params: Promise<{ lessonId: string; exerciseId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { lessonId, exerciseId } = await context.params;
    const { answer } = exerciseSubmissionSchema.parse(await request.json());
    const result = await getServiceContainer().learningService.checkExercise(lessonId, exerciseId, answer);
    return Response.json(apiSuccess(result));
  } catch (error) {
    return errorResponse(error);
  }
}
