import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { CampaignService } from "~/lib/services/CampaignService";
// import { authenticateUser } from "~/lib/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // await authenticateUser(request);

    if (!params.id) {
      return json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // const campaignService = new CampaignService();
    // const history = await campaignService.getTriggerHistory(params.id, limit);

    // Mock response for now
    const history = [
      {
        id: "trigger_1",
        campaignId: params.id,
        triggeredAt: new Date(),
        triggerReason: "Competitor price change detected",
        productIds: ["prod_1", "prod_2"],
        priceChanges: 2,
        successful: true,
        errorMessage: undefined,
        processingTime: 245
      },
      {
        id: "trigger_2", 
        campaignId: params.id,
        triggeredAt: new Date(Date.now() - 60 * 60 * 1000),
        triggerReason: "Inventory level change",
        productIds: ["prod_3"],
        priceChanges: 1,
        successful: false,
        errorMessage: "Failed to update product pricing",
        processingTime: 1200
      }
    ];

    return json({ success: true, history });
  } catch (error: any) {
    console.error("Failed to get trigger history:", error);
    return json(
      { error: error.message || "Failed to get trigger history" },
      { status: error.message?.includes("not found") ? 404 : 500 }
    );
  }
}
