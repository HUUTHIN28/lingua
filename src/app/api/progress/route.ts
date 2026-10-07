import { apiSuccess } from "@/lib/api-contract";
import { getServiceContainer } from "@/services/container";
import { errorResponse } from "@/services/learning/errors";

export async function GET() {
  try {
    const progress = await getServiceContainer().learningService.getProgressOverview();
    return Response.json(apiSuccess(progress));
  } catch (error) {
    return errorResponse(error);
  }
}
