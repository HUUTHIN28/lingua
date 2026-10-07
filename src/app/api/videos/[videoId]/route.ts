import { updateVideoInputSchema } from "@/domain/video";
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

export async function PATCH(request: Request, context: Context) {
  try {
    const { videoId } = await context.params;
    const input = updateVideoInputSchema.parse(await request.json());
    const video = await getServiceContainer().videoService.update(videoId, input);
    return Response.json(apiSuccess({ video }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { videoId } = await context.params;
    await getServiceContainer().videoService.delete(videoId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
