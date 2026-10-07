import { generationRequestSchema } from "@/domain/job";
import { apiSuccess } from "@/lib/api-contract";
import { getServiceContainer } from "@/services/container";
import { errorResponse } from "@/services/learning/errors";

type Context = { params: Promise<{ videoId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { videoId } = await context.params;
    const input = generationRequestSchema.parse(await request.json());
    const result = await getServiceContainer().learningService.generate(videoId, input);
    return Response.json(apiSuccess(result), { status: result.reused ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
