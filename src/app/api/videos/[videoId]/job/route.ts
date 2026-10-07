import { apiSuccess } from "@/lib/api-contract";
import { getServiceContainer } from "@/services/container";
import { errorResponse } from "@/services/learning/errors";

type Context = { params: Promise<{ videoId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { videoId } = await context.params;
    return Response.json(apiSuccess(await getServiceContainer().learningService.getVideoWithJob(videoId)));
  } catch (error) {
    return errorResponse(error);
  }
}
