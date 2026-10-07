import { createVideoInputSchema } from "@/domain/video";
import { apiSuccess } from "@/lib/api-contract";
import { getServiceContainer } from "@/services/container";
import { errorResponse } from "@/services/learning/errors";

export async function GET() {
  try {
    const videos = await getServiceContainer().videoService.list();
    return Response.json(apiSuccess({ videos }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createVideoInputSchema.parse(await request.json());
    const { video, job } = await getServiceContainer().learningService.createVideoAndGenerate(input);
    return Response.json(apiSuccess({ video, job }), { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
